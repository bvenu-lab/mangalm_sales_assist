/**
 * World-class WebSocket Service
 * Real-time updates with automatic reconnection
 */

import { EventEmitter } from 'events';

export type WebSocketEvent = 
  | 'connect'
  | 'disconnect'
  | 'error'
  | 'reconnecting'
  | 'message'
  | 'store.update'
  | 'order.created'
  | 'order.updated'
  | 'performance.update'
  | 'notification'
  | 'user.status'
  | 'data.sync';

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
  id: string;
}

interface WebSocketConfig {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  enableCompression?: boolean;
  debug?: boolean;
}

class WebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private isConnected = false;
  private subscribers = new Map<string, Set<Function>>();
  private lastActivity = Date.now();
  private metrics = {
    messagesReceived: 0,
    messagesSent: 0,
    reconnections: 0,
    errors: 0,
    latency: 0,
  };

  constructor(config: WebSocketConfig = {}) {
    super();
    
    this.config = {
      url: config.url || this.getWebSocketUrl(),
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000,
      enableCompression: config.enableCompression !== false,
      debug: config.debug || false,
    };
  }

  /**
   * Get WebSocket URL based on current location
   */
  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = process.env.REACT_APP_WS_PORT || '3006';
    return `${protocol}//${host}:${port}/ws`;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.log('Already connected');
      return;
    }

    this.log('Connecting to WebSocket server...');

    try {
      this.ws = new WebSocket(this.config.url);
      this.setupEventHandlers();
    } catch (error) {
      this.handleError(error as Error);
      this.scheduleReconnect();
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.log('Connected to WebSocket server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // No authentication needed

      // Process queued messages
      this.processMessageQueue();

      // Start heartbeat
      this.startHeartbeat();

      // Emit connect event
      this.emit('connect');
      
      // Request initial data sync
      this.send('sync', { type: 'initial' });
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event);
    };

    this.ws.onerror = (error) => {
      this.handleError(new Error('WebSocket error'));
    };

    this.ws.onclose = (event) => {
      this.log(`WebSocket closed: ${event.code} - ${event.reason}`);
      this.isConnected = false;
      this.stopHeartbeat();
      this.emit('disconnect', { code: event.code, reason: event.reason });

      // Auto-reconnect if not intentionally closed
      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(event: MessageEvent): void {
    this.lastActivity = Date.now();
    this.metrics.messagesReceived++;

    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      this.log('Received message:', message.type);

      // Calculate latency if this is a pong response
      if (message.type === 'pong' && message.payload.timestamp) {
        this.metrics.latency = Date.now() - message.payload.timestamp;
      }

      // Emit typed events
      this.emit('message', message);
      this.emit(message.type as WebSocketEvent, message.payload);

      // Notify subscribers
      const subscribers = this.subscribers.get(message.type);
      if (subscribers) {
        subscribers.forEach(callback => callback(message.payload));
      }

      // Handle specific message types
      this.handleSpecificMessage(message);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Handle specific message types
   */
  private handleSpecificMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'store.update':
        // Update local store cache
        this.updateLocalCache('stores', message.payload);
        break;

      case 'order.created':
      case 'order.updated':
        // Update local order cache
        this.updateLocalCache('orders', message.payload);
        break;

      case 'performance.update':
        // Update performance metrics
        this.updateLocalCache('performance', message.payload);
        break;

      case 'notification':
        // Show notification to user
        this.showNotification(message.payload);
        break;

      case 'user.status':
        // Update user presence
        this.updateUserPresence(message.payload);
        break;

      case 'data.sync':
        // Handle data synchronization
        this.handleDataSync(message.payload);
        break;
    }
  }

  /**
   * Send message to server
   */
  send(type: string, payload: any = {}): void {
    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: Date.now(),
      id: this.generateMessageId(),
    };

    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      this.metrics.messagesSent++;
      this.log('Sent message:', type);
    } else {
      // Queue message if not connected
      this.messageQueue.push(message);
      this.log('Queued message:', type);
    }
  }

  /**
   * Subscribe to specific message types
   */
  subscribe(type: string, callback: Function): () => void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    
    this.subscribers.get(type)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const subscribers = this.subscribers.get(type);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.subscribers.delete(type);
        }
      }
    };
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws?.send(JSON.stringify(message));
        this.metrics.messagesSent++;
      }
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.log('Max reconnection attempts reached');
      this.emit('error', new Error('Failed to reconnect to WebSocket server'));
      return;
    }

    this.reconnectAttempts++;
    this.metrics.reconnections++;
    
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1),
      30000
    );

    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send('ping', { timestamp: Date.now() });
        
        // Check for stale connection
        if (Date.now() - this.lastActivity > this.config.heartbeatInterval * 2) {
          this.log('Connection appears stale, reconnecting...');
          this.disconnect();
          this.connect();
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    this.log('Disconnecting from WebSocket server');
    
    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    
    // Close connection
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.isConnected = false;
  }

  /**
   * Update local cache
   */
  private updateLocalCache(type: string, data: any): void {
    // This would integrate with your state management (Redux, Context, etc.)
    const event = new CustomEvent(`cache.update.${type}`, { detail: data });
    window.dispatchEvent(event);
  }

  /**
   * Show notification
   */
  private showNotification(notification: any): void {
    const event = new CustomEvent('app.notification', { detail: notification });
    window.dispatchEvent(event);
  }

  /**
   * Update user presence
   */
  private updateUserPresence(presence: any): void {
    const event = new CustomEvent('user.presence', { detail: presence });
    window.dispatchEvent(event);
  }

  /**
   * Handle data synchronization
   */
  private handleDataSync(syncData: any): void {
    const event = new CustomEvent('data.sync', { detail: syncData });
    window.dispatchEvent(event);
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    this.metrics.errors++;
    this.log('WebSocket error:', error);
    this.emit('error', error);
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log messages (debug mode)
   */
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[WebSocket]', ...args);
    }
  }

  /**
   * Get connection status
   */
  getStatus(): {
    connected: boolean;
    reconnectAttempts: number;
    metrics: {
      messagesReceived: number;
      messagesSent: number;
      errors: number;
      reconnections: number;
      latency: number;
    };
  } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      metrics: { ...this.metrics },
    };
  }

  /**
   * Request specific data update
   */
  requestUpdate(resource: string, id?: string): void {
    this.send('request.update', { resource, id });
  }

  /**
   * Join a room for targeted updates
   */
  joinRoom(room: string): void {
    this.send('room.join', { room });
  }

  /**
   * Leave a room
   */
  leaveRoom(room: string): void {
    this.send('room.leave', { room });
  }
}

// Create singleton instance
const wsService = new WebSocketService();

// Auto-connect when window gains focus
window.addEventListener('focus', () => {
  if (!wsService.getStatus().connected) {
    wsService.connect();
  }
});

// Disconnect when window loses focus (optional)
// window.addEventListener('blur', () => {
//   wsService.disconnect();
// });

export default wsService;