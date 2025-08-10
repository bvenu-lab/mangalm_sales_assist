import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface AgentTask {
  id: string;
  type: string;
  description: string;
  metadata: Record<string, any>;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedAgent?: string;
  createdAt: Date;
  updatedAt: Date;
  deadline?: Date;
}

export interface A2AMessage {
  messageId: string;
  fromAgent: string;
  toAgent: string;
  messageType: 'task_assignment' | 'status_update' | 'request' | 'response';
  payload: any;
  timestamp: Date;
}

export abstract class BaseAgent extends EventEmitter {
  protected agentId: string;
  protected agentType: string;
  protected status: 'idle' | 'busy' | 'error' = 'idle';
  protected currentTasks: Map<string, AgentTask> = new Map();

  constructor(agentType: string) {
    super();
    this.agentId = `${agentType}_${uuidv4()}`;
    this.agentType = agentType;
    
    logger.info(`${this.agentType} agent initialized`, {
      agentId: this.agentId,
      agentType: this.agentType
    });
  }

  public getId(): string {
    return this.agentId;
  }

  public getType(): string {
    return this.agentType;
  }

  public getStatus(): string {
    return this.status;
  }

  public getCurrentTasks(): AgentTask[] {
    return Array.from(this.currentTasks.values());
  }

  // A2A Protocol: Send message to another agent
  protected sendA2AMessage(toAgent: string, messageType: A2AMessage['messageType'], payload: any): void {
    const message: A2AMessage = {
      messageId: uuidv4(),
      fromAgent: this.agentId,
      toAgent,
      messageType,
      payload,
      timestamp: new Date()
    };

    logger.info('A2A message sent', {
      fromAgent: this.agentId,
      toAgent,
      messageType,
      messageId: message.messageId
    });

    this.emit('a2a_message', message);
  }

  // A2A Protocol: Receive message from another agent
  public receiveA2AMessage(message: A2AMessage): void {
    logger.info('A2A message received', {
      fromAgent: message.fromAgent,
      toAgent: this.agentId,
      messageType: message.messageType,
      messageId: message.messageId
    });

    this.handleA2AMessage(message);
  }

  // Abstract method for handling A2A messages - must be implemented by subclasses
  protected abstract handleA2AMessage(message: A2AMessage): void;

  // Task assignment
  public async assignTask(task: AgentTask): Promise<boolean> {
    try {
      if (this.status === 'busy' && this.currentTasks.size >= this.getMaxConcurrentTasks()) {
        return false; // Agent is at capacity
      }

      task.assignedAgent = this.agentId;
      task.status = 'in_progress';
      task.updatedAt = new Date();

      this.currentTasks.set(task.id, task);
      this.status = 'busy';

      logger.info('Task assigned to agent', {
        agentId: this.agentId,
        taskId: task.id,
        taskType: task.type
      });

      // Execute the task
      this.executeTask(task);
      return true;
    } catch (error: any) {
      logger.error('Error assigning task', {
        agentId: this.agentId,
        taskId: task.id,
        error: error.message
      });
      return false;
    }
  }

  // Abstract method for task execution - must be implemented by subclasses
  protected abstract executeTask(task: AgentTask): Promise<void>;

  // Complete a task
  protected completeTask(taskId: string, result?: any): void {
    const task = this.currentTasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.updatedAt = new Date();
      
      this.currentTasks.delete(taskId);
      
      if (this.currentTasks.size === 0) {
        this.status = 'idle';
      }

      logger.info('Task completed', {
        agentId: this.agentId,
        taskId,
        taskType: task.type
      });

      // Send completion message
      this.emit('task_completed', { task, result });
    }
  }

  // Fail a task
  protected failTask(taskId: string, error: string): void {
    const task = this.currentTasks.get(taskId);
    if (task) {
      task.status = 'failed';
      task.updatedAt = new Date();
      task.metadata.error = error;

      this.currentTasks.delete(taskId);
      
      if (this.currentTasks.size === 0) {
        this.status = 'idle';
      }

      logger.error('Task failed', {
        agentId: this.agentId,
        taskId,
        taskType: task.type,
        error
      });

      this.emit('task_failed', { task, error });
    }
  }

  // Get maximum concurrent tasks (default 1, override in subclasses)
  protected getMaxConcurrentTasks(): number {
    return 1;
  }

  // Health check
  public getHealthStatus() {
    return {
      agentId: this.agentId,
      agentType: this.agentType,
      status: this.status,
      activeTasks: this.currentTasks.size,
      maxConcurrentTasks: this.getMaxConcurrentTasks(),
      uptime: process.uptime()
    };
  }
}