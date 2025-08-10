import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { MultiAgentOrchestrator } from './orchestrator/multi-agent-orchestrator';
import { logger, stream } from './utils/logger';

const app = express();
const port = process.env.PORT || 3003;

// Initialize Multi-Agent Orchestrator
const orchestrator = new MultiAgentOrchestrator();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream }));

// Health check endpoint
app.get('/health', (req, res) => {
  const health = orchestrator.healthCheck();
  res.json(health);
});

// Project Management API Routes
app.post('/api/projects/requirements', async (req, res) => {
  try {
    const requirement = req.body;
    await orchestrator.processProjectRequirement(requirement);
    res.json({
      success: true,
      message: 'Requirement processed successfully',
      requirementId: requirement.id
    });
  } catch (error: any) {
    logger.error('Error processing requirement', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to process requirement'
    });
  }
});

// Get project backlog
app.get('/api/projects/backlog', (req, res) => {
  try {
    const backlog = orchestrator.getProjectBacklog();
    res.json({
      success: true,
      data: backlog
    });
  } catch (error: any) {
    logger.error('Error fetching backlog', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch backlog'
    });
  }
});

// Get active sprints
app.get('/api/projects/sprints', (req, res) => {
  try {
    const sprints = orchestrator.getActiveSprints();
    const sprintsData = Array.from(sprints.entries()).map(([sprintId, tasks]) => ({
      sprintId,
      tasks: tasks.length,
      taskList: tasks
    }));

    res.json({
      success: true,
      data: sprintsData
    });
  } catch (error: any) {
    logger.error('Error fetching sprints', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sprints'
    });
  }
});

// Get orchestrator status
app.get('/api/orchestrator/status', (req, res) => {
  try {
    const status = orchestrator.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    logger.error('Error fetching orchestrator status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch status'
    });
  }
});

// Get A2A message history
app.get('/api/orchestrator/messages', (req, res) => {
  try {
    const messages = orchestrator.getA2AMessageHistory();
    res.json({
      success: true,
      data: messages
    });
  } catch (error: any) {
    logger.error('Error fetching A2A messages', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
});

// Assign task endpoint
app.post('/api/tasks/assign', async (req, res) => {
  try {
    const task = req.body;
    const result = await orchestrator.assignTask(task);
    
    res.json({
      success: result.success,
      data: result
    });
  } catch (error: any) {
    logger.error('Error assigning task', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to assign task'
    });
  }
});

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack
  });

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start server
app.listen(port, () => {
  logger.info(`PM Agent Orchestrator Service started`);
  logger.info(`Listening on port ${port}`);
  logger.info(`http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received, closing server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received, closing server');
  process.exit(0);
});

export default app;
