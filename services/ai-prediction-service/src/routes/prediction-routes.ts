import express from 'express';
import { logger } from '../utils/logger';
// Use mock service for local testing
import { PredictionService } from '../services/prediction/mock-prediction-service';

const router = express.Router();
const predictionService = new PredictionService();

/**
 * @route   POST /api/predictions/order
 * @desc    Generate order predictions for a store
 * @access  Private
 */
router.post('/order', async (req, res) => {
  const { storeId, date, includeItems } = req.body;
  
  if (!storeId) {
    return res.status(400).json({
      success: false,
      error: 'Store ID is required',
      requestId: req.id,
    });
  }
  
  try {
    logger.info('Order prediction requested', {
      storeId,
      date: date || 'next order date',
      includeItems: !!includeItems,
      requestId: req.id,
    });
    
    const prediction = await predictionService.predictOrder(storeId, date, includeItems);
    
    return res.status(200).json({
      success: true,
      data: prediction,
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error generating order prediction', {
      error: error.message,
      stack: error.stack,
      storeId,
      requestId: req.id,
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to generate order prediction',
      message: error.message,
      requestId: req.id,
    });
  }
});

/**
 * @route   POST /api/predictions/batch
 * @desc    Generate order predictions for multiple stores
 * @access  Private
 */
router.post('/batch', async (req, res) => {
  const { storeIds, date, includeItems } = req.body;
  
  if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Valid store IDs array is required',
      requestId: req.id,
    });
  }
  
  try {
    logger.info('Batch order prediction requested', {
      storeCount: storeIds.length,
      date: date || 'next order date',
      includeItems: !!includeItems,
      requestId: req.id,
    });
    
    const predictions = await predictionService.predictBatchOrders(storeIds, date, includeItems);
    
    return res.status(200).json({
      success: true,
      data: predictions,
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error generating batch order predictions', {
      error: error.message,
      stack: error.stack,
      storeCount: storeIds.length,
      requestId: req.id,
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to generate batch order predictions',
      message: error.message,
      requestId: req.id,
    });
  }
});

/**
 * @route   GET /api/predictions/store/:storeId/history
 * @desc    Get prediction history for a store
 * @access  Private
 */
router.get('/store/:storeId/history', async (req, res) => {
  const { storeId } = req.params;
  const { limit, offset } = req.query;
  
  try {
    logger.info('Prediction history requested', {
      storeId,
      limit: limit || 10,
      offset: offset || 0,
      requestId: req.id,
    });
    
    const history = await predictionService.getPredictionHistory(
      storeId,
      Number(limit) || 10,
      Number(offset) || 0
    );
    
    return res.status(200).json({
      success: true,
      data: history,
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error fetching prediction history', {
      error: error.message,
      stack: error.stack,
      storeId,
      requestId: req.id,
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch prediction history',
      message: error.message,
      requestId: req.id,
    });
  }
});

/**
 * @route   GET /api/predictions/accuracy
 * @desc    Get prediction accuracy metrics
 * @access  Private
 */
router.get('/accuracy', async (req, res) => {
  const { period, storeId } = req.query;
  
  try {
    logger.info('Prediction accuracy metrics requested', {
      period: period || 'last-30-days',
      storeId: storeId || 'all',
      requestId: req.id,
    });
    
    const metrics = await predictionService.getAccuracyMetrics(
      period as string || 'last-30-days',
      storeId as string
    );
    
    return res.status(200).json({
      success: true,
      data: metrics,
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error fetching prediction accuracy metrics', {
      error: error.message,
      stack: error.stack,
      period,
      storeId,
      requestId: req.id,
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch prediction accuracy metrics',
      message: error.message,
      requestId: req.id,
    });
  }
});

/**
 * @route   POST /api/predictions/feedback
 * @desc    Submit feedback on a prediction
 * @access  Private
 */
router.post('/feedback', async (req, res) => {
  const { predictionId, feedback, actualOrderId } = req.body;
  
  if (!predictionId || !feedback) {
    return res.status(400).json({
      success: false,
      error: 'Prediction ID and feedback are required',
      requestId: req.id,
    });
  }
  
  try {
    logger.info('Prediction feedback submitted', {
      predictionId,
      feedbackType: feedback.type,
      actualOrderId,
      requestId: req.id,
    });
    
    await predictionService.submitFeedback(predictionId, feedback, actualOrderId);
    
    return res.status(200).json({
      success: true,
      message: 'Feedback submitted successfully',
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error submitting prediction feedback', {
      error: error.message,
      stack: error.stack,
      predictionId,
      requestId: req.id,
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to submit prediction feedback',
      message: error.message,
      requestId: req.id,
    });
  }
});

export default router;
