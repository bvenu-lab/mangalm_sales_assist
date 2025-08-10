import { Router, Request, Response } from 'express';
import mockDB from '../services/database/mock-database';
import { logger } from '../utils/logger';

const router = Router();

// Get all stores
router.get('/stores', async (req: Request, res: Response) => {
  try {
    const stores = await mockDB.getStores();
    res.json({
      success: true,
      data: stores,
      total: stores.length
    });
  } catch (error: any) {
    logger.error('Error fetching stores:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stores'
    });
  }
});

// Get store by ID
router.get('/stores/:id', async (req: Request, res: Response) => {
  try {
    const store = await mockDB.getStoreById(req.params.id);
    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }
    res.json({
      success: true,
      data: store
    });
  } catch (error: any) {
    logger.error('Error fetching store:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch store'
    });
  }
});

// Get all products
router.get('/products', async (req: Request, res: Response) => {
  try {
    const products = await mockDB.getProducts();
    res.json({
      success: true,
      data: products,
      total: products.length
    });
  } catch (error: any) {
    logger.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products'
    });
  }
});

// Get predictions
router.get('/predictions', async (req: Request, res: Response) => {
  try {
    const { storeId } = req.query;
    const predictions = await mockDB.getPredictions(storeId as string);
    res.json({
      success: true,
      data: predictions,
      total: predictions.length
    });
  } catch (error: any) {
    logger.error('Error fetching predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch predictions'
    });
  }
});

// Get call prioritization list
router.get('/calls/prioritization', async (req: Request, res: Response) => {
  try {
    const prioritization = await mockDB.getCallPrioritization();
    res.json({
      success: true,
      data: prioritization,
      total: prioritization.length
    });
  } catch (error: any) {
    logger.error('Error fetching call prioritization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch call prioritization'
    });
  }
});

// Get performance metrics
router.get('/performance/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await mockDB.getPerformanceMetrics();
    res.json({
      success: true,
      data: metrics
    });
  } catch (error: any) {
    logger.error('Error fetching performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance metrics'
    });
  }
});

// Create order (mock)
router.post('/orders', async (req: Request, res: Response) => {
  try {
    const { storeId, items, totalAmount } = req.body;
    
    // Mock order creation
    const order = {
      id: `ORD-${Date.now()}`,
      storeId,
      items,
      totalAmount,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: order,
      message: 'Order created successfully'
    });
  } catch (error: any) {
    logger.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order'
    });
  }
});

export default router;