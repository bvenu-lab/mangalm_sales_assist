import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'pm-agent-orchestrator',
    timestamp: new Date().toISOString()
  });
});

export const healthRoutes = router;
