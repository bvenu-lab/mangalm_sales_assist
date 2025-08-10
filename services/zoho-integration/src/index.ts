import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { ZohoSdkClient } from './services/zoho/zoho-sdk-client';
import { ZohoSyncService } from './services/zoho/zoho-sync-service';
import { DatabaseClient } from './services/database/database-client';
import { SyncScheduler } from './services/scheduler/sync-scheduler';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const port = process.env.PORT || 3002;

// Initialize Zoho SDK client
const zohoSdkClient = new ZohoSdkClient({
  clientId: process.env.ZOHO_CLIENT_ID || '',
  clientSecret: process.env.ZOHO_CLIENT_SECRET || '',
  refreshToken: process.env.ZOHO_REFRESH_TOKEN || '',
  apiDomain: process.env.ZOHO_API_DOMAIN || 'www.zohoapis.com',
  tokenRefreshIntervalMs: 3540000, // 59 minutes (token expires in 60 minutes)
  environment: 'PRODUCTION'
}, logger);

// Initialize the SDK
zohoSdkClient.initialize().catch(error => {
  logger.error('Failed to initialize Zoho SDK', { error });
  process.exit(1);
});

// Initialize Database client
const databaseClient = new DatabaseClient({
  databaseOrchestratorUrl: process.env.DATABASE_ORCHESTRATOR_URL || 'http://localhost:3001',
  apiKey: process.env.DATABASE_ORCHESTRATOR_API_KEY || ''
});

// Initialize Zoho Sync Service
const zohoSyncService = new ZohoSyncService({
  zohoClient: zohoSdkClient,
  databaseClient,
  databaseOrchestratorUrl: process.env.DATABASE_ORCHESTRATOR_URL || 'http://localhost:3001',
  aiPredictionServiceUrl: process.env.AI_PREDICTION_SERVICE_URL || 'http://localhost:3003',
  apiGatewayUrl: process.env.API_GATEWAY_URL || 'http://localhost:3000'
});

// Initialize Sync Scheduler
const syncScheduler = new SyncScheduler({
  zohoSyncService,
  logger,
  timezone: process.env.TIMEZONE || 'America/New_York'
});

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Routes
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Sync routes
app.post('/api/sync/stores', async (_req: Request, res: Response) => {
  try {
    const result = await zohoSyncService.syncStores();
    res.status(200).json(result);
  } catch (error) {
    logger.error('Failed to sync stores', { error });
    res.status(500).json({ error: 'Failed to sync stores' });
  }
});

app.post('/api/sync/products', async (_req: Request, res: Response) => {
  try {
    const result = await zohoSyncService.syncProducts();
    res.status(200).json(result);
  } catch (error) {
    logger.error('Failed to sync products', { error });
    res.status(500).json({ error: 'Failed to sync products' });
  }
});

app.post('/api/sync/invoices', async (_req: Request, res: Response) => {
  try {
    const result = await zohoSyncService.syncInvoices();
    res.status(200).json(result);
  } catch (error) {
    logger.error('Failed to sync invoices', { error });
    res.status(500).json({ error: 'Failed to sync invoices' });
  }
});

app.post('/api/sync/all', async (req: Request, res: Response) => {
  try {
    const { triggerAiUpdate = true } = req.body;
    const result = await zohoSyncService.syncAll(triggerAiUpdate);
    res.status(200).json(result);
  } catch (error) {
    logger.error('Failed to sync all data', { error });
    res.status(500).json({ error: 'Failed to sync all data' });
  }
});

// Trigger AI prediction update
app.post('/api/trigger/ai-prediction', async (_req: Request, res: Response) => {
  try {
    await zohoSyncService.triggerAiPredictionUpdate();
    res.status(200).json({ status: 'success' });
  } catch (error) {
    logger.error('Failed to trigger AI prediction update', { error });
    res.status(500).json({ error: 'Failed to trigger AI prediction update' });
  }
});

// Trigger call prioritization update
app.post('/api/trigger/call-prioritization', async (_req: Request, res: Response) => {
  try {
    await zohoSyncService.triggerCallPrioritizationUpdate();
    res.status(200).json({ status: 'success' });
  } catch (error) {
    logger.error('Failed to trigger call prioritization update', { error });
    res.status(500).json({ error: 'Failed to trigger call prioritization update' });
  }
});

// Scheduler routes
app.get('/api/scheduler/jobs', (_req: Request, res: Response) => {
  try {
    const jobs = syncScheduler.getAllJobStatuses();
    res.status(200).json(jobs);
  } catch (error) {
    logger.error('Failed to get scheduler jobs', { error });
    res.status(500).json({ error: 'Failed to get scheduler jobs' });
  }
});

app.post('/api/scheduler/jobs/:name/start', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const result = await syncScheduler.startJobNow(name);
    res.status(200).json(result);
  } catch (error) {
    logger.error(`Failed to start job ${req.params.name}`, { error });
    res.status(500).json({ error: `Failed to start job ${req.params.name}` });
  }
});

app.post('/api/scheduler/jobs/:name/stop', (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    syncScheduler.stopJob(name);
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    logger.error(`Failed to stop job ${req.params.name}`, { error });
    res.status(500).json({ error: `Failed to stop job ${req.params.name}` });
  }
});

// Start server
app.listen(port, () => {
  logger.info(`Zoho Integration Service listening on port ${port}`);
  
  // Schedule default jobs
  syncScheduler.scheduleDefaultJobs();
  logger.info('Default sync jobs scheduled');
});

// Handle process termination
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  zohoSdkClient.stopTokenRefreshInterval();
  syncScheduler.stopAllJobs();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  zohoSdkClient.stopTokenRefreshInterval();
  syncScheduler.stopAllJobs();
  process.exit(0);
});
