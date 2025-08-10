import { BaseAgent, AgentTask, A2AMessage } from './base-agent';
import { logger } from '../utils/logger';

export interface ProjectRequirement {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  tags: string[];
  acceptanceCriteria: string[];
  estimatedHours: number;
  dependencies: string[];
}

export interface SMARTObjective {
  specific: string;
  measurable: string;
  achievable: string;
  relevant: string;
  timeBound: string;
  metadata: Record<string, any>;
}

export class PMAgent extends BaseAgent {
  private projectBacklog: Map<string, ProjectRequirement> = new Map();
  private activeSprints: Map<string, AgentTask[]> = new Map();

  constructor() {
    super('PMAgent');
  }

  protected handleA2AMessage(message: A2AMessage): void {
    switch (message.messageType) {
      case 'status_update':
        this.handleStatusUpdate(message);
        break;
      case 'request':
        this.handleAgentRequest(message);
        break;
      default:
        logger.warn('Unknown A2A message type', {
          messageType: message.messageType,
          fromAgent: message.fromAgent
        });
    }
  }

  protected async executeTask(task: AgentTask): Promise<void> {
    try {
      switch (task.type) {
        case 'process_requirement':
          await this.processRequirement(task);
          break;
        case 'create_sprint':
          await this.createSprint(task);
          break;
        case 'decompose_task':
          await this.decomposeTask(task);
          break;
        case 'prioritize_backlog':
          await this.prioritizeBacklog(task);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
    } catch (error: any) {
      this.failTask(task.id, error.message);
    }
  }

  // Convert high-level requirements into SMART objectives
  public async processRequirement(task: AgentTask): Promise<void> {
    const requirement = task.metadata.requirement as ProjectRequirement;
    
    logger.info('Processing requirement', {
      requirementId: requirement.id,
      title: requirement.title
    });

    // Convert to SMART objective
    const smartObjective = this.convertToSMARTObjective(requirement);
    
    // Decompose into actionable tasks
    const subTasks = await this.decomposeRequirement(requirement);
    
    // Add to project backlog
    this.projectBacklog.set(requirement.id, requirement);
    
    // Create tasks for downstream agents
    for (const subTask of subTasks) {
      const agentTask: AgentTask = {
        id: subTask.id,
        type: subTask.type,
        description: subTask.description,
        metadata: {
          parentRequirement: requirement.id,
          priority: requirement.priority,
          ...subTask.metadata
        },
        priority: requirement.priority,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        deadline: subTask.deadline
      };

      // Send task to appropriate agent
      this.sendA2AMessage('tech-lead-agent', 'task_assignment', agentTask);
    }

    this.completeTask(task.id, {
      smartObjective,
      subTasks: subTasks.length,
      backlogSize: this.projectBacklog.size
    });
  }

  private convertToSMARTObjective(requirement: ProjectRequirement): SMARTObjective {
    return {
      specific: requirement.description,
      measurable: this.generateMeasurableCriteria(requirement),
      achievable: `Based on team capacity and estimated ${requirement.estimatedHours} hours`,
      relevant: `Aligns with project goals and user needs: ${requirement.tags.join(', ')}`,
      timeBound: this.calculateDeadline(requirement.estimatedHours),
      metadata: {
        requirementId: requirement.id,
        priority: requirement.priority,
        tags: requirement.tags
      }
    };
  }

  private generateMeasurableCriteria(requirement: ProjectRequirement): string {
    const criteria = requirement.acceptanceCriteria.map((criterion, index) => 
      `${index + 1}. ${criterion}`
    ).join('; ');
    
    return `Success criteria: ${criteria}`;
  }

  private calculateDeadline(estimatedHours: number): string {
    const daysToComplete = Math.ceil(estimatedHours / 8); // Assuming 8 hours per day
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + daysToComplete);
    
    return `Complete by ${deadline.toISOString().split('T')[0]}`;
  }

  private async decomposeRequirement(requirement: ProjectRequirement): Promise<any[]> {
    // Decompose based on requirement type and complexity
    const tasks = [];
    
    // Common task patterns based on requirement tags
    if (requirement.tags.includes('frontend')) {
      tasks.push({
        id: `${requirement.id}_ui_design`,
        type: 'ui_design',
        description: `Design UI components for ${requirement.title}`,
        metadata: { component: 'frontend', skill: 'ui_design' },
        deadline: this.addDays(new Date(), 2)
      });
      
      tasks.push({
        id: `${requirement.id}_frontend_impl`,
        type: 'frontend_implementation',
        description: `Implement frontend for ${requirement.title}`,
        metadata: { component: 'frontend', skill: 'react_development' },
        deadline: this.addDays(new Date(), 5)
      });
    }

    if (requirement.tags.includes('backend') || requirement.tags.includes('api')) {
      tasks.push({
        id: `${requirement.id}_api_design`,
        type: 'api_design',
        description: `Design API endpoints for ${requirement.title}`,
        metadata: { component: 'backend', skill: 'api_design' },
        deadline: this.addDays(new Date(), 1)
      });
      
      tasks.push({
        id: `${requirement.id}_backend_impl`,
        type: 'backend_implementation',
        description: `Implement backend logic for ${requirement.title}`,
        metadata: { component: 'backend', skill: 'node_development' },
        deadline: this.addDays(new Date(), 4)
      });
    }

    if (requirement.tags.includes('database')) {
      tasks.push({
        id: `${requirement.id}_db_schema`,
        type: 'database_design',
        description: `Design database schema for ${requirement.title}`,
        metadata: { component: 'database', skill: 'database_design' },
        deadline: this.addDays(new Date(), 1)
      });
    }

    if (requirement.tags.includes('testing')) {
      tasks.push({
        id: `${requirement.id}_testing`,
        type: 'test_implementation',
        description: `Create tests for ${requirement.title}`,
        metadata: { component: 'testing', skill: 'test_automation' },
        deadline: this.addDays(new Date(), 3)
      });
    }

    return tasks;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  // Sprint planning functionality
  public async createSprint(task: AgentTask): Promise<void> {
    const sprintData = task.metadata;
    const sprintId = sprintData.sprintId;
    const sprintTasks = sprintData.tasks || [];

    logger.info('Creating sprint', {
      sprintId,
      taskCount: sprintTasks.length
    });

    this.activeSprints.set(sprintId, sprintTasks);
    
    // Notify team agents about new sprint
    this.sendA2AMessage('all-agents', 'request', {
      type: 'sprint_start',
      sprintId,
      tasks: sprintTasks
    });

    this.completeTask(task.id, {
      sprintId,
      tasksAssigned: sprintTasks.length
    });
  }

  public async decomposeTask(task: AgentTask): Promise<void> {
    // Task decomposition logic
    const parentTask = task.metadata.parentTask;
    const decomposedTasks = this.breakDownComplexTask(parentTask);
    
    this.completeTask(task.id, {
      originalTask: parentTask.id,
      decomposedTasks: decomposedTasks.length
    });
  }

  private breakDownComplexTask(parentTask: any): any[] {
    // Smart task breakdown based on complexity and dependencies
    return [
      {
        id: `${parentTask.id}_analysis`,
        description: 'Analyze requirements and dependencies',
        estimatedHours: 2
      },
      {
        id: `${parentTask.id}_implementation`,
        description: 'Implement core functionality',
        estimatedHours: 6
      },
      {
        id: `${parentTask.id}_testing`,
        description: 'Create and run tests',
        estimatedHours: 3
      },
      {
        id: `${parentTask.id}_review`,
        description: 'Code review and documentation',
        estimatedHours: 1
      }
    ];
  }

  public async prioritizeBacklog(task: AgentTask): Promise<void> {
    // Prioritization algorithm based on business value, effort, and dependencies
    const backlogItems = Array.from(this.projectBacklog.values());
    
    const prioritized = backlogItems.sort((a, b) => {
      const scoreA = this.calculatePriorityScore(a);
      const scoreB = this.calculatePriorityScore(b);
      return scoreB - scoreA; // Higher scores first
    });

    this.completeTask(task.id, {
      totalItems: prioritized.length,
      highPriority: prioritized.filter(item => item.priority === 'high').length
    });
  }

  private calculatePriorityScore(requirement: ProjectRequirement): number {
    let score = 0;
    
    // Priority weight
    switch (requirement.priority) {
      case 'high': score += 10; break;
      case 'medium': score += 5; break;
      case 'low': score += 1; break;
    }
    
    // Business impact (estimated by tags)
    if (requirement.tags.includes('security')) score += 8;
    if (requirement.tags.includes('performance')) score += 6;
    if (requirement.tags.includes('user_experience')) score += 7;
    if (requirement.tags.includes('revenue')) score += 9;
    
    // Effort consideration (inverse relationship)
    score += Math.max(1, 10 - (requirement.estimatedHours / 10));
    
    return score;
  }

  private handleStatusUpdate(message: A2AMessage): void {
    logger.info('Received status update', {
      fromAgent: message.fromAgent,
      status: message.payload
    });
    
    // Update project tracking based on agent status
  }

  private handleAgentRequest(message: A2AMessage): void {
    const request = message.payload;
    
    switch (request.type) {
      case 'task_clarification':
        this.handleTaskClarification(message);
        break;
      case 'resource_request':
        this.handleResourceRequest(message);
        break;
      default:
        logger.warn('Unknown agent request', { requestType: request.type });
    }
  }

  private handleTaskClarification(message: A2AMessage): void {
    // Provide task clarification
    this.sendA2AMessage(message.fromAgent, 'response', {
      type: 'task_clarification_response',
      clarification: 'Task clarification provided'
    });
  }

  private handleResourceRequest(message: A2AMessage): void {
    // Handle resource allocation requests
    this.sendA2AMessage(message.fromAgent, 'response', {
      type: 'resource_approved',
      resources: message.payload.resources
    });
  }

  // Public API methods
  public getProjectBacklog(): ProjectRequirement[] {
    return Array.from(this.projectBacklog.values());
  }

  public getActiveSprints(): Map<string, AgentTask[]> {
    return this.activeSprints;
  }

  protected getMaxConcurrentTasks(): number {
    return 5; // PM Agent can handle multiple planning tasks
  }
}