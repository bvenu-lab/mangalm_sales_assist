import { Router, Request, Response } from 'express';
import { invoiceAnalyzer } from '../services/invoice-analyzer';
import { callPrioritizationRepository } from '../database/call-prioritization-repository';
import { logger } from '../utils/logger';

const router = Router();

// Get call prioritization list
router.get('/', async (req: Request, res: Response) => {
  try {
    const { storeId, limit, offset } = req.query;
    const limitNum = limit ? parseInt(limit as string) : 20;
    const offsetNum = offset ? parseInt(offset as string) : 0;
    
    // First try to get from database
    try {
      const dbResult = await callPrioritizationRepository.getAll({
        storeId: storeId as string,
        limit: limitNum,
        offset: offsetNum
      });
      
      if (dbResult.data.length > 0) {
        logger.info(`Retrieved ${dbResult.data.length} call prioritizations from database`);
        return res.json({
          success: true,
          data: dbResult.data,
          total: dbResult.total
        });
      }
    } catch (dbError) {
      logger.warn('Failed to fetch from database, falling back to invoice analyzer', dbError);
    }
    
    let callList: any[] = [];
    
    if (storeId) {
      // Get specific store analysis
      const analytics = invoiceAnalyzer.getStoreAnalytics(storeId as string);
      if (analytics) {
        const predictions = invoiceAnalyzer.generatePredictions(storeId as string);
        if (predictions) {
          callList = [{
            id: `call_${analytics.storeId}`,
            storeId: analytics.storeId,
            storeName: analytics.storeName,
            priorityScore: calculatePriorityScore(analytics, predictions),
            priority: predictions.priority,
            lastCallDate: analytics.lastOrderDate,
            lastOrderDate: analytics.lastOrderDate,
            recommendedCallDate: predictions.predictedOrderDate.split('T')[0],
            expectedOrderValue: predictions.predictedAmount,
            daysSinceLastOrder: predictions.historicalMetrics.lastOrderDaysAgo,
            averageOrderFrequency: Math.round(predictions.historicalMetrics.orderFrequency),
            totalRevenue: analytics.totalRevenue,
            totalOrders: analytics.totalInvoices,
            topProducts: analytics.topProducts.slice(0, 5).map(p => ({
              name: p.name,
              revenue: p.revenue,
              frequency: p.frequency
            })),
            callReason: generateCallReason(analytics, predictions),
            confidence: predictions.confidence,
            agentAssigned: 'Admin User',
            contactInfo: analytics.contactInfo,
            status: 'pending'
          }];
        }
      }
    } else {
      // Get all stores and prioritize them
      const allStores = invoiceAnalyzer.getAllStores();
      
      // Generate call list for all stores
      const prioritizedStores = allStores
        .map(store => {
          const analytics = invoiceAnalyzer.getStoreAnalytics(store.storeId);
          const predictions = invoiceAnalyzer.generatePredictions(store.storeId);
          
          if (!analytics || !predictions) return null;
          
          return {
            id: `call_${analytics.storeId}`,
            storeId: analytics.storeId,
            storeName: analytics.storeName,
            priorityScore: calculatePriorityScore(analytics, predictions),
            priority: predictions.priority,
            lastCallDate: analytics.lastOrderDate,
            lastOrderDate: analytics.lastOrderDate,
            recommendedCallDate: predictions.predictedOrderDate.split('T')[0],
            expectedOrderValue: predictions.predictedAmount,
            daysSinceLastOrder: predictions.historicalMetrics.lastOrderDaysAgo,
            averageOrderFrequency: Math.round(predictions.historicalMetrics.orderFrequency),
            totalRevenue: analytics.totalRevenue,
            totalOrders: analytics.totalInvoices,
            topProducts: analytics.topProducts.slice(0, 3).map(p => ({
              name: p.name,
              revenue: p.revenue,
              frequency: p.frequency
            })),
            callReason: generateCallReason(analytics, predictions),
            confidence: predictions.confidence,
            agentAssigned: assignAgent(analytics),
            contactInfo: analytics.contactInfo,
            status: 'pending'
          };
        })
        .filter(s => s !== null)
        .sort((a, b) => b!.priorityScore - a!.priorityScore);
      
      callList = prioritizedStores.slice(offsetNum, offsetNum + limitNum);
    }
    
    logger.info(`Retrieved ${callList.length} call prioritizations`);
    
    res.json({
      success: true,
      data: callList,
      total: callList.length
    });
  } catch (error: any) {
    logger.error('Error fetching call prioritization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch call prioritization'
    });
  }
});

// Update call status
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes, nextCallDate } = req.body;
    
    // Mock update - in production this would update database
    const result = {
      id,
      status,
      notes,
      nextCallDate,
      updatedAt: new Date().toISOString(),
      updatedBy: req.headers['x-user-username'] || 'system'
    };
    
    logger.info(`Updated call status for ${id} to ${status}`);
    
    res.json({
      success: true,
      data: result,
      message: 'Call status updated successfully'
    });
  } catch (error: any) {
    logger.error('Error updating call status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update call status'
    });
  }
});

// Log call attempt
router.post('/:id/log', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { outcome, notes, orderPlaced, orderAmount, nextFollowUp } = req.body;
    
    // Mock logging - in production this would save to database
    const callLog = {
      id: `log_${Date.now()}`,
      callId: id,
      timestamp: new Date().toISOString(),
      agent: req.headers['x-user-username'] || 'system',
      outcome,
      notes,
      orderPlaced,
      orderAmount,
      nextFollowUp
    };
    
    logger.info(`Logged call attempt for ${id}: ${outcome}`);
    
    res.json({
      success: true,
      data: callLog,
      message: 'Call logged successfully'
    });
  } catch (error: any) {
    logger.error('Error logging call:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log call'
    });
  }
});

// Helper functions
function calculatePriorityScore(analytics: any, predictions: any): number {
  // Priority score based on multiple factors
  const revenueWeight = 0.3;
  const frequencyWeight = 0.2;
  const recencyWeight = 0.3;
  const confidenceWeight = 0.2;
  
  // Normalize revenue (0-100)
  const maxRevenue = 100000; // Assumed max revenue for normalization
  const revenueScore = Math.min(100, (analytics.totalRevenue / maxRevenue) * 100);
  
  // Frequency score (more orders = higher score)
  const frequencyScore = Math.min(100, analytics.totalInvoices * 2);
  
  // Recency score (more days since last order = higher priority)
  const recencyScore = Math.min(100, predictions.historicalMetrics.lastOrderDaysAgo * 2);
  
  // Confidence score (0-100)
  const confidenceScore = predictions.confidence * 100;
  
  return (
    revenueScore * revenueWeight +
    frequencyScore * frequencyWeight +
    recencyScore * recencyWeight +
    confidenceScore * confidenceWeight
  );
}

function generateCallReason(analytics: any, predictions: any): string {
  const daysSinceLastOrder = predictions.historicalMetrics.lastOrderDaysAgo;
  const avgFrequency = predictions.historicalMetrics.orderFrequency;
  
  if (daysSinceLastOrder > avgFrequency * 2) {
    return `Overdue for order - last ordered ${daysSinceLastOrder} days ago (usually orders every ${Math.round(avgFrequency)} days)`;
  } else if (daysSinceLastOrder > avgFrequency * 1.5) {
    return `Due for reorder - approaching typical reorder time`;
  } else if (predictions.priority === 'high') {
    return `High-value customer - regular follow-up`;
  } else if (analytics.totalInvoices === 1) {
    return `New customer - follow up on first order experience`;
  } else {
    return `Regular check-in - maintain relationship`;
  }
}

function assignAgent(analytics: any): string {
  // Simple agent assignment based on store value
  if (analytics.totalRevenue > 50000) {
    return 'Senior Sales Rep';
  } else if (analytics.totalRevenue > 20000) {
    return 'Sales Rep';
  } else {
    return 'Junior Sales Rep';
  }
}

export default router;