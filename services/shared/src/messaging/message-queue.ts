/**
 * World-class Message Queue Implementation
 * RabbitMQ-based async messaging with patterns
 */

import amqp, { Connection, Channel, ConsumeMessage } from 'amqplib';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface MessageQueueConfig {
  url?: string;
  prefetch?: number;
  heartbeat?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  defaultExchange?: string;
  defaultExchangeType?: 'direct' | 'topic' | 'fanout' | 'headers';
}

export interface Message<T = any> {
  id: string;
  correlationId?: string;
  timestamp: Date;
  type: string;
  payload: T;
  metadata?: Record<string, any>;
  retryCount?: number;
  maxRetries?: number;
}

export interface PublishOptions {
  exchange?: string;
  routingKey?: string;
  persistent?: boolean;
  priority?: number;
  expiration?: number;
  correlationId?: string;
  replyTo?: string;
  headers?: Record<string, any>;
}

export interface ConsumeOptions {
  queue: string;
  exchange?: string;
  routingKey?: string;
  prefetch?: number;
  noAck?: boolean;
  exclusive?: boolean;
  priority?: number;
  arguments?: Record<string, any>;
}

export type MessageHandler<T = any> = (
  message: Message<T>,
  ack: () => void,
  nack: (requeue?: boolean) => void,
  reject: (requeue?: boolean) => void
) => Promise<void> | void;

export class MessageQueue extends EventEmitter {
  private config: Required<MessageQueueConfig>;
  private connection?: Connection;
  private channel?: Channel;
  private consumers: Map<string, MessageHandler> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer?: NodeJS.Timeout;

  constructor(config: MessageQueueConfig = {}) {
    super();

    this.config = {
      url: config.url || process.env.RABBITMQ_URL || 'amqp://localhost',
      prefetch: config.prefetch || 10,
      heartbeat: config.heartbeat || 60,
      reconnectDelay: config.reconnectDelay || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      defaultExchange: config.defaultExchange || 'mangalm.events',
      defaultExchangeType: config.defaultExchangeType || 'topic',
    };

    this.connect().catch(console.error);
  }

  /**
   * Connect to RabbitMQ
   */
  public async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.config.url, {
        heartbeat: this.config.heartbeat,
      });

      this.connection.on('error', (error) => {
        console.error('[MessageQueue] Connection error:', error.message);
        this.handleConnectionError();
      });

      this.connection.on('close', () => {
        console.log('[MessageQueue] Connection closed');
        this.handleConnectionClose();
      });

      this.channel = await this.connection.createChannel();
      await this.channel.prefetch(this.config.prefetch);

      // Create default exchange
      await this.channel.assertExchange(
        this.config.defaultExchange,
        this.config.defaultExchangeType,
        { durable: true }
      );

      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      this.emit('connected');
      console.log('[MessageQueue] Connected to RabbitMQ');

      // Re-establish consumers
      await this.reestablishConsumers();
    } catch (error) {
      console.error('[MessageQueue] Failed to connect:', (error as Error).message);
      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * Disconnect from RabbitMQ
   */
  public async disconnect(): Promise<void> {
    this.isConnected = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.channel) {
      await this.channel.close();
      this.channel = undefined;
    }

    if (this.connection) {
      await this.connection.close();
      this.connection = undefined;
    }

    this.emit('disconnected');
  }

  /**
   * Publish a message
   */
  public async publish<T = any>(
    type: string,
    payload: T,
    options: PublishOptions = {}
  ): Promise<void> {
    if (!this.isConnected || !this.channel) {
      throw new Error('Not connected to message queue');
    }

    const message: Message<T> = {
      id: uuidv4(),
      correlationId: options.correlationId || uuidv4(),
      timestamp: new Date(),
      type,
      payload,
      metadata: options.headers,
    };

    const exchange = options.exchange || this.config.defaultExchange;
    const routingKey = options.routingKey || type;

    const messageBuffer = Buffer.from(JSON.stringify(message));

    const publishOptions: amqp.Options.Publish = {
      persistent: options.persistent !== false,
      correlationId: message.correlationId,
      timestamp: Date.now(),
      contentType: 'application/json',
      headers: options.headers,
    };

    if (options.priority !== undefined) {
      publishOptions.priority = options.priority;
    }

    if (options.expiration !== undefined) {
      publishOptions.expiration = options.expiration.toString();
    }

    if (options.replyTo) {
      publishOptions.replyTo = options.replyTo;
    }

    const published = this.channel.publish(
      exchange,
      routingKey,
      messageBuffer,
      publishOptions
    );

    if (!published) {
      throw new Error('Failed to publish message - channel buffer full');
    }

    this.emit('message:published', { type, exchange, routingKey });
  }

  /**
   * Subscribe to messages
   */
  public async subscribe<T = any>(
    handler: MessageHandler<T>,
    options: ConsumeOptions
  ): Promise<string> {
    if (!this.isConnected || !this.channel) {
      throw new Error('Not connected to message queue');
    }

    const { queue, exchange, routingKey, prefetch, noAck, exclusive, priority } = options;

    // Assert queue
    await this.channel.assertQueue(queue, {
      durable: true,
      exclusive: exclusive || false,
      arguments: options.arguments,
    });

    // Bind to exchange if specified
    if (exchange && routingKey) {
      await this.channel.bindQueue(queue, exchange, routingKey);
    }

    // Set prefetch for this consumer
    if (prefetch !== undefined) {
      await this.channel.prefetch(prefetch);
    }

    // Consume messages
    const { consumerTag } = await this.channel.consume(
      queue,
      async (msg) => {
        if (!msg) return;

        try {
          const message = this.parseMessage<T>(msg);
          
          await handler(
            message,
            () => this.ack(msg),
            (requeue) => this.nack(msg, requeue),
            (requeue) => this.reject(msg, requeue)
          );

          if (noAck) {
            this.emit('message:processed', { queue, type: message.type });
          }
        } catch (error) {
          console.error('[MessageQueue] Error processing message:', error);
          
          if (!noAck) {
            this.handleMessageError(msg, error as Error);
          }
        }
      },
      {
        noAck: noAck || false,
        exclusive: exclusive || false,
        priority,
      }
    );

    // Store consumer for reconnection
    this.consumers.set(consumerTag, handler);

    this.emit('consumer:created', { queue, consumerTag });
    
    return consumerTag;
  }

  /**
   * Unsubscribe from messages
   */
  public async unsubscribe(consumerTag: string): Promise<void> {
    if (!this.channel) {
      return;
    }

    await this.channel.cancel(consumerTag);
    this.consumers.delete(consumerTag);
    
    this.emit('consumer:cancelled', { consumerTag });
  }

  /**
   * RPC call pattern
   */
  public async call<TRequest = any, TResponse = any>(
    type: string,
    payload: TRequest,
    timeout: number = 30000
  ): Promise<TResponse> {
    if (!this.isConnected || !this.channel) {
      throw new Error('Not connected to message queue');
    }

    const correlationId = uuidv4();
    const replyQueue = await this.channel.assertQueue('', { exclusive: true });

    return new Promise<TResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`RPC call timeout after ${timeout}ms`));
      }, timeout);

      // Consume reply
      this.channel!.consume(
        replyQueue.queue,
        (msg) => {
          if (msg && msg.properties.correlationId === correlationId) {
            clearTimeout(timer);
            
            try {
              const response = JSON.parse(msg.content.toString());
              resolve(response);
            } catch (error) {
              reject(error);
            }
          }
        },
        { noAck: true }
      ).then(() => {
        // Send request
        this.publish(type, payload, {
          correlationId,
          replyTo: replyQueue.queue,
          expiration: timeout,
        });
      });
    });
  }

  /**
   * RPC reply pattern
   */
  public async reply<TRequest = any, TResponse = any>(
    type: string,
    handler: (request: TRequest) => Promise<TResponse>
  ): Promise<void> {
    await this.subscribe<TRequest>(
      async (message, ack) => {
        try {
          const response = await handler(message.payload);
          
          // Send reply if replyTo is specified
          const replyTo = message.metadata?.replyTo;
          if (replyTo && this.channel) {
            const replyBuffer = Buffer.from(JSON.stringify(response));
            
            this.channel.sendToQueue(replyTo, replyBuffer, {
              correlationId: message.correlationId,
            });
          }
          
          ack();
        } catch (error) {
          console.error('[MessageQueue] RPC handler error:', error);
          ack(); // Acknowledge anyway to prevent redelivery
        }
      },
      {
        queue: `rpc.${type}`,
        exchange: this.config.defaultExchange,
        routingKey: type,
      }
    );
  }

  /**
   * Implement work queue pattern
   */
  public async createWorkQueue<T = any>(
    queueName: string,
    handler: MessageHandler<T>,
    options?: {
      concurrency?: number;
      retryDelay?: number;
      maxRetries?: number;
    }
  ): Promise<void> {
    const concurrency = options?.concurrency || 1;
    const maxRetries = options?.maxRetries || 3;

    await this.subscribe<T>(
      async (message, ack, nack) => {
        try {
          await handler(message, ack, nack, nack);
        } catch (error) {
          const retryCount = message.retryCount || 0;
          
          if (retryCount < maxRetries) {
            // Retry with delay
            setTimeout(() => {
              this.publish(message.type, message.payload, {
                headers: {
                  ...message.metadata,
                  retryCount: retryCount + 1,
                },
              });
            }, options?.retryDelay || 5000);
            
            ack(); // Remove from queue
          } else {
            // Send to dead letter queue
            await this.sendToDeadLetter(message, error as Error);
            ack();
          }
        }
      },
      {
        queue: queueName,
        prefetch: concurrency,
      }
    );
  }

  /**
   * Implement publish/subscribe pattern
   */
  public async createTopic<T = any>(
    topicName: string
  ): Promise<{
    publish: (payload: T) => Promise<void>;
    subscribe: (handler: MessageHandler<T>) => Promise<string>;
  }> {
    const exchangeName = `topic.${topicName}`;

    // Create fanout exchange for pub/sub
    if (this.channel) {
      await this.channel.assertExchange(exchangeName, 'fanout', {
        durable: true,
      });
    }

    return {
      publish: async (payload: T) => {
        await this.publish(topicName, payload, {
          exchange: exchangeName,
          routingKey: '',
        });
      },
      subscribe: async (handler: MessageHandler<T>) => {
        const queueName = `${topicName}.${uuidv4()}`;
        
        return this.subscribe(handler, {
          queue: queueName,
          exchange: exchangeName,
          routingKey: '',
          exclusive: true,
        });
      },
    };
  }

  /**
   * Send message to dead letter queue
   */
  private async sendToDeadLetter(message: Message, error: Error): Promise<void> {
    if (!this.channel) return;

    const dlxExchange = 'mangalm.dlx';
    const dlqQueue = 'mangalm.dlq';

    // Create dead letter exchange and queue
    await this.channel.assertExchange(dlxExchange, 'direct', { durable: true });
    await this.channel.assertQueue(dlqQueue, { durable: true });
    await this.channel.bindQueue(dlqQueue, dlxExchange, '');

    // Send to DLQ with error info
    const dlqMessage = {
      ...message,
      error: {
        message: error.message,
        stack: error.stack,
        timestamp: new Date(),
      },
    };

    const messageBuffer = Buffer.from(JSON.stringify(dlqMessage));
    
    this.channel.publish(dlxExchange, '', messageBuffer, {
      persistent: true,
    });

    this.emit('message:dead-lettered', { type: message.type, error: error.message });
  }

  // Private helper methods

  private parseMessage<T>(msg: ConsumeMessage): Message<T> {
    try {
      const content = JSON.parse(msg.content.toString());
      
      // Handle both Message format and plain payloads
      if (content.id && content.type && content.payload) {
        return content as Message<T>;
      }

      // Create Message wrapper for plain payloads
      return {
        id: msg.properties.messageId || uuidv4(),
        correlationId: msg.properties.correlationId,
        timestamp: new Date(msg.properties.timestamp || Date.now()),
        type: msg.fields.routingKey || 'unknown',
        payload: content as T,
        metadata: msg.properties.headers,
        retryCount: msg.properties.headers?.retryCount || 0,
      };
    } catch (error) {
      throw new Error(`Failed to parse message: ${error}`);
    }
  }

  private ack(msg: ConsumeMessage): void {
    if (this.channel) {
      this.channel.ack(msg);
      this.emit('message:acked');
    }
  }

  private nack(msg: ConsumeMessage, requeue: boolean = true): void {
    if (this.channel) {
      this.channel.nack(msg, false, requeue);
      this.emit('message:nacked', { requeue });
    }
  }

  private reject(msg: ConsumeMessage, requeue: boolean = false): void {
    if (this.channel) {
      this.channel.reject(msg, requeue);
      this.emit('message:rejected', { requeue });
    }
  }

  private handleMessageError(msg: ConsumeMessage, error: Error): void {
    const retryCount = msg.properties.headers?.retryCount || 0;
    const maxRetries = msg.properties.headers?.maxRetries || 3;

    if (retryCount < maxRetries) {
      // Requeue for retry
      this.nack(msg, true);
    } else {
      // Max retries reached, don't requeue
      this.nack(msg, false);
      
      // Send to dead letter queue
      const message = this.parseMessage(msg);
      this.sendToDeadLetter(message, error).catch(console.error);
    }
  }

  private handleConnectionError(): void {
    this.isConnected = false;
    this.scheduleReconnect();
  }

  private handleConnectionClose(): void {
    this.isConnected = false;
    
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectDelay * this.reconnectAttempts,
      30000
    );

    console.log(`[MessageQueue] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      
      try {
        await this.connect();
      } catch (error) {
        console.error('[MessageQueue] Reconnection failed:', error);
      }
    }, delay);
  }

  private async reestablishConsumers(): Promise<void> {
    // Re-establish consumers after reconnection
    // This is simplified - in production, you'd store consumer options
    console.log('[MessageQueue] Re-establishing consumers...');
  }

  /**
   * Get connection status
   */
  public isReady(): boolean {
    return this.isConnected && !!this.channel;
  }

  /**
   * Get statistics
   */
  public async getStats(): Promise<any> {
    if (!this.connection) {
      return null;
    }

    // This would connect to RabbitMQ management API for stats
    return {
      connected: this.isConnected,
      consumers: this.consumers.size,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// Singleton instance
let queueInstance: MessageQueue | null = null;

export const getMessageQueue = (config?: MessageQueueConfig): MessageQueue => {
  if (!queueInstance) {
    queueInstance = new MessageQueue(config);
  }
  return queueInstance;
};

export default MessageQueue;