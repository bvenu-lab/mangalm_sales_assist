import { Router, Request, Response } from 'express';
import { invoiceRepository } from '../database/invoice-repository';
import { predictedOrdersRepository } from '../database/predicted-orders-repository';
import { logger } from '../utils/logger';

const router = Router();

// Note: Stores are handled by API Gateway directly
// Products, performance metrics, and calls are handled elsewhere
// This service focuses on AI predictions and invoices

// Get performance summary
router.get('/performance/summary', async (req: Request, res: Response) => {
  try {
    // Mock performance summary data
    const summary = {
      totalCalls: 145,
      completedCalls: 98,
      conversionRate: 67.5,
      totalRevenue: 125000,
      averageOrderValue: 1275,
      topProducts: [
        { name: 'Product A', sales: 45 },
        { name: 'Product B', sales: 38 },
        { name: 'Product C', sales: 32 }
      ],
      weeklyTrend: [
        { week: 'W1', calls: 35, orders: 24 },
        { week: 'W2', calls: 40, orders: 28 },
        { week: 'W3', calls: 38, orders: 25 },
        { week: 'W4', calls: 32, orders: 21 }
      ],
      rating: 4.5,
      lastUpdated: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    logger.error('Error fetching performance summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance summary'
    });
  }
});

// Get pending orders
router.get('/orders/pending', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    // Mock pending orders
    const pendingOrders = Array.from({ length: limit }, (_, i) => ({
      id: `ORD-PEND-${i + 1}`,
      storeId: `STORE-${i + 1}`,
      storeName: `Store ${i + 1}`,
      totalAmount: Math.floor(Math.random() * 10000) + 1000,
      itemCount: Math.floor(Math.random() * 10) + 1,
      status: 'pending',
      createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      expectedDelivery: new Date(Date.now() + (i + 1) * 86400000).toISOString()
    }));
    
    res.json({
      success: true,
      data: pendingOrders,
      total: pendingOrders.length
    });
  } catch (error: any) {
    logger.error('Error fetching pending orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending orders'
    });
  }
});

// Get predicted orders for a store
router.get('/predicted-orders/store/:storeId', async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    
    const result = await predictedOrdersRepository.getByStoreId(storeId, { limit, offset });
    
    res.json({
      success: true,
      data: result.data,
      total: result.total
    });
  } catch (error: any) {
    logger.error('Error fetching predicted orders for store:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch predicted orders for store'
    });
  }
});

// Get all predicted orders
router.get('/predicted-orders', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const status = req.query.status as string;
    const priority = req.query.priority as string;
    
    const result = await predictedOrdersRepository.getAll({ limit, offset, status, priority });
    
    res.json({
      success: true,
      data: result.data,
      total: result.total
    });
  } catch (error: any) {
    logger.error('Error fetching predicted orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch predicted orders'
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

// Approve predicted order
router.post('/predicted-orders/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const updatedOrder = await predictedOrdersRepository.updateStatus(id, 'approved', reason);
    
    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        error: 'Predicted order not found'
      });
    }
    
    res.json({
      success: true,
      data: updatedOrder,
      message: 'Order approved successfully'
    });
  } catch (error: any) {
    logger.error('Error approving predicted order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve predicted order'
    });
  }
});

// Reject predicted order
router.post('/predicted-orders/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const updatedOrder = await predictedOrdersRepository.updateStatus(id, 'rejected', reason);
    
    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        error: 'Predicted order not found'
      });
    }
    
    res.json({
      success: true,
      data: updatedOrder,
      message: 'Order rejected successfully'
    });
  } catch (error: any) {
    logger.error('Error rejecting predicted order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject predicted order'
    });
  }
});

// Update predicted order (mock)
router.put('/predicted-orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const changes = req.body;
    
    // Mock update
    const result = {
      id,
      ...changes,
      updatedAt: new Date().toISOString(),
      message: 'Order updated successfully'
    };
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error updating predicted order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update predicted order'
    });
  }
});

// Get invoices for a store
router.get('/invoices/store/:storeId', async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    
    const result = await invoiceRepository.getByStoreId(storeId, { limit, offset });
    
    res.json({
      success: true,
      data: result.data,
      total: result.total
    });
  } catch (error: any) {
    logger.error('Error fetching invoices for store:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoices for store'
    });
  }
});

// Get recent invoices
router.get('/invoices/recent', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    const invoices = await invoiceRepository.getRecent(limit);
    
    res.json({
      success: true,
      data: invoices,
      total: invoices.length
    });
  } catch (error: any) {
    logger.error('Error fetching recent invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent invoices'
    });
  }
});

export default router;