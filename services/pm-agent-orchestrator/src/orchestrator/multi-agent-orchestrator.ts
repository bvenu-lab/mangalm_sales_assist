import { EventEmitter } from 'events';
import { BaseAgent, AgentTask, A2AMessage } from '../agents/base-agent';
import { PMAgent, ProjectRequirement } from '../agents/pm-agent';
import { logger } from '../utils/logger';

export interface AgentRegistration {
  agentId: string;
  agentType: string;
  capabilities: string[];
  maxConcurrentTasks: number;
  status: 'active' | 'inactive' | 'error';
}

export interface TaskAssignmentResult {
  taskId: string;
  assignedAgent: string;
  success: boolean;
  reason?: string;
}

export class MultiAgentOrchestrator extends EventEmitter {
  private agents: Map<string, BaseAgent> = new Map();
  private agentRegistry: Map<string, AgentRegistration> = new Map();
  private taskQueue: AgentTask[] = [];
  private completedTasks: Map<string, AgentTask> = new Map();
  private a2aMessageHistory: A2AMessage[] = [];
  private pmAgent: PMAgent;

  constructor() {
    super();
    
    // Initialize core PM Agent
    this.pmAgent = new PMAgent();
    this.registerAgent(this.pmAgent);
    
    logger.info('Multi-Agent Orchestrator initialized');
  }

  // Register an agent with the orchestrator
  public registerAgent(agent: BaseAgent): void {
    const agentId = agent.getId();
    const agentType = agent.getType();

    this.agents.set(agentId, agent);
    
    const registration: AgentRegistration = {
      agentId,
      agentType,
      capabilities: this.getAgentCapabilities(agentType),
      maxConcurrentTasks: (agent as any).getMaxConcurrentTasks?.() || 1,
      status: 'active'
    };
    
    this.agentRegistry.set(agentId, registration);

    // Set up A2A message routing
    agent.on('a2a_message', (message: A2AMessage) => {
      this.routeA2AMessage(message);
    });

    // Set up task completion handling
    agent.on('task_completed', (event: any) => {
      this.handleTaskCompletion(event);
    });

    agent.on('task_failed', (event: any) => {
      this.handleTaskFailure(event);
    });

    logger.info('Agent registered', {
      agentId,
      agentType,
      capabilities: registration.capabilities
    });
  }

  private getAgentCapabilities(agentType: string): string[] {
    const capabilityMap: Record<string, string[]> = {
      'PMAgent': ['requirement_processing', 'sprint_planning', 'task_decomposition', 'backlog_management'],
      'TechLeadAgent': ['architecture_design', 'code_review', 'technical_planning'],
      'UIAgent': ['ui_design', 'frontend_implementation', 'component_development'],
      'BackendAgent': ['api_development', 'database_design', 'server_logic'],
      'QAAgent': ['test_automation', 'quality_assurance', 'bug_tracking'],
      'DevOpsAgent': ['deployment', 'infrastructure', 'monitoring']
    };

    return capabilityMap[agentType] || ['general'];
  }

  // Route A2A messages between agents
  private routeA2AMessage(message: A2AMessage): void {
    this.a2aMessageHistory.push(message);

    // Log A2A communication
    logger.info('Routing A2A message', {
      messageId: message.messageId,
      fromAgent: message.fromAgent,
      toAgent: message.toAgent,
      messageType: message.messageType
    });

    if (message.toAgent === 'all-agents') {
      // Broadcast to all agents except sender
      this.agents.forEach((agent, agentId) => {
        if (agentId !== message.fromAgent) {
          agent.receiveA2AMessage(message);
        }
      });
    } else {
      // Route to specific agent
      const targetAgent = this.agents.get(message.toAgent);
      if (targetAgent) {
        targetAgent.receiveA2AMessage(message);
      } else {
        logger.warn('Target agent not found for A2A message', {
          targetAgent: message.toAgent,
          messageId: message.messageId
        });
      }
    }
  }

  // Process a new project requirement
  public async processProjectRequirement(requirement: ProjectRequirement): Promise<void> {
    logger.info('Processing new project requirement', {
      requirementId: requirement.id,
      title: requirement.title,
      priority: requirement.priority
    });

    // Create task for PM Agent
    const pmTask: AgentTask = {
      id: `req_${requirement.id}`,
      type: 'process_requirement',
      description: `Process requirement: ${requirement.title}`,
      metadata: { requirement },
      priority: requirement.priority,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Assign directly to PM Agent
    await this.pmAgent.assignTask(pmTask);
  }

  // Assign task to most suitable agent
  public async assignTask(task: AgentTask): Promise<TaskAssignmentResult> {
    const suitableAgent = this.findSuitableAgent(task);
    
    if (!suitableAgent) {
      logger.warn('No suitable agent found for task', {
        taskId: task.id,
        taskType: task.type
      });
      
      // Add to queue
      this.taskQueue.push(task);
      
      return {
        taskId: task.id,
        assignedAgent: '',
        success: false,
        reason: 'No suitable agent available'
      };
    }

    const success = await suitableAgent.assignTask(task);
    
    if (success) {
      logger.info('Task assigned successfully', {
        taskId: task.id,
        assignedAgent: suitableAgent.getId()
      });
      
      return {
        taskId: task.id,
        assignedAgent: suitableAgent.getId(),
        success: true
      };
    } else {
      // Agent at capacity, add to queue
      this.taskQueue.push(task);
      
      return {
        taskId: task.id,
        assignedAgent: suitableAgent.getId(),
        success: false,
        reason: 'Agent at capacity'
      };
    }
  }

  // Find the most suitable agent for a task
  private findSuitableAgent(task: AgentTask): BaseAgent | null {
    const requiredCapability = this.getRequiredCapability(task.type);
    
    // Find agents with the required capability
    const suitableAgents = Array.from(this.agents.values()).filter(agent => {
      const registration = this.agentRegistry.get(agent.getId());
      return registration?.capabilities.includes(requiredCapability) &&
             registration?.status === 'active' &&
             agent.getStatus() === 'idle';
    });

    if (suitableAgents.length === 0) {
      return null;
    }

    // Return the first available agent (could be enhanced with load balancing)
    return suitableAgents[0];
  }

  private getRequiredCapability(taskType: string): string {
    const capabilityMap: Record<string, string> = {
      'process_requirement': 'requirement_processing',
      'ui_design': 'ui_design',
      'frontend_implementation': 'frontend_implementation',
      'backend_implementation': 'api_development',
      'database_design': 'database_design',
      'test_implementation': 'test_automation',
      'code_review': 'code_review',
      'deployment': 'deployment'
    };

    return capabilityMap[taskType] || 'general';
  }

  // Handle task completion
  private handleTaskCompletion(event: any): void {
    const task = event.task;
    const result = event.result;

    this.completedTasks.set(task.id, task);

    logger.info('Task completed in orchestrator', {
      taskId: task.id,
      taskType: task.type,
      assignedAgent: task.assignedAgent
    });

    // Process queued tasks
    this.processTaskQueue();

    // Emit completion event for external listeners
    this.emit('task_completed', { task, result });
  }

  // Handle task failure
  private handleTaskFailure(event: any): void {
    const task = event.task;
    const error = event.error;

    logger.error('Task failed in orchestrator', {
      taskId: task.id,
      taskType: task.type,
      assignedAgent: task.assignedAgent,
      error
    });

    // Could implement retry logic here
    this.emit('task_failed', { task, error });
  }

  // Process queued tasks
  private async processTaskQueue(): Promise<void> {
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (task) {
        const result = await this.assignTask(task);
        if (!result.success) {
          // Put it back in queue if still can't assign
          this.taskQueue.unshift(task);
          break; // Stop processing to avoid infinite loop
        }
      }
    }
  }

  // Get orchestrator status
  public getStatus() {
    const agentStatuses = Array.from(this.agents.values()).map(agent => agent.getHealthStatus());
    
    return {
      totalAgents: this.agents.size,
      activeAgents: agentStatuses.filter(status => status.status !== 'error').length,
      queuedTasks: this.taskQueue.length,
      completedTasks: this.completedTasks.size,
      a2aMessages: this.a2aMessageHistory.length,
      agents: agentStatuses
    };
  }

  // Get project backlog from PM Agent
  public getProjectBacklog(): ProjectRequirement[] {
    return this.pmAgent.getProjectBacklog();
  }

  // Get active sprints from PM Agent
  public getActiveSprints() {
    return this.pmAgent.getActiveSprints();
  }

  // Get A2A message history
  public getA2AMessageHistory(): A2AMessage[] {
    return this.a2aMessageHistory.slice(-100); // Return last 100 messages
  }

  // Health check
  public healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date(),
      orchestrator: this.getStatus()
    };
  }
}