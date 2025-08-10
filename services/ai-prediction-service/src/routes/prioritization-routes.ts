import express from 'express';
import { logger } from '../utils/logger';
import { CallPrioritizationService } from '../services/prioritization/call-prioritization-service';

const router = express.Router();
const prioritizationService = new CallPrioritizationService();

/**
 * @route   POST /api/prioritization/generate
 * @desc    Generate call prioritization for stores
 * @access  Private
 */
router.post('/generate', async (req, res) => {
  const { storeIds, salesAgentId, options } = req.body;
  
  if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Valid store IDs array is required',
      requestId: req.id,
    });
  }
  
  try {
    logger.info('Call prioritization requested', {
      storeCount: storeIds.length,
      salesAgentId: salesAgentId || 'all',
      requestId: req.id,
    });
    
    const prioritization = await prioritizationService.generateCallPrioritization(storeIds, salesAgentId, options);
    
    return res.status(200).json({
      success: true,
      data: prioritization,
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error generating call prioritization', {
      error: error.message,
      stack: error.stack,
      storeCount: storeIds.length,
      requestId: req.id,
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to generate call prioritization',
      message: error.message,
      requestId: req.id,
    });
  }
});

/**
 * @route   GET /api/prioritization/agent/:agentId
 * @desc    Get call prioritization for a specific sales agent
 * @access  Private
 */
router.get('/agent/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { limit, offset } = req.query;
  
  try {
    logger.info('Agent call prioritization requested', {
      agentId,
      limit: limit || 10,
      offset: offset || 0,
      requestId: req.id,
    });
    
    const prioritization = await prioritizationService.getCallPrioritizationsForAgent(
      agentId,
      Number(limit) || 10,
      Number(offset) || 0
    );
    
    return res.status(200).json({
      success: true,
      data: prioritization,
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error fetching agent call prioritization', {
      error: error.message,
      stack: error.stack,
      agentId,
      requestId: req.id,
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch agent call prioritization',
      message: error.message,
      requestId: req.id,
    });
  }
});

/**
 * @route   GET /api/prioritization/store/:storeId
 * @desc    Get call prioritization for a specific store
 * @access  Private
 */
router.get('/store/:storeId', async (req, res) => {
  const { storeId } = req.params;
  
  try {
    logger.info('Store call prioritization requested', {
      storeId,
      requestId: req.id,
    });
    
    const prioritization = await prioritizationService.getPrioritizationByStore(storeId);
    
    return res.status(200).json({
      success: true,
      data: prioritization,
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error fetching store call prioritization', {
      error: error.message,
      stack: error.stack,
      storeId,
      requestId: req.id,
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch store call prioritization',
      message: error.message,
      requestId: req.id,
    });
  }
});

/**
 * @route   PUT /api/prioritization/:id/status
 * @desc    Update call prioritization status
 * @access  Private
 */
router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  
  if (!status || !['Pending', 'Completed', 'Skipped'].includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'Valid status is required (Pending, Completed, or Skipped)',
      requestId: req.id,
    });
  }
  
  try {
    logger.info('Call prioritization status update requested', {
      id,
      status,
      requestId: req.id,
    });
    
    const updated = await prioritizationService.updateCallPrioritizationStatus(id, status, notes);
    
    return res.status(200).json({
      success: true,
      data: updated,
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error updating call prioritization status', {
      error: error.message,
      stack: error.stack,
      id,
      status,
      requestId: req.id,
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to update call prioritization status',
      message: error.message,
      requestId: req.id,
    });
  }
});

/**
 * @route   POST /api/prioritization/feedback
 * @desc    Submit feedback on call prioritization
 * @access  Private
 */
router.post('/feedback', async (req, res) => {
  const { prioritizationId, feedback, resultOrderId } = req.body;
  
  if (!prioritizationId || !feedback) {
    return res.status(400).json({
      success: false,
      error: 'Prioritization ID and feedback are required',
      requestId: req.id,
    });
  }
  
  try {
    logger.info('Call prioritization feedback submitted', {
      prioritizationId,
      feedbackType: feedback.type,
      resultOrderId,
      requestId: req.id,
    });
    
    await prioritizationService.submitFeedback(prioritizationId, feedback, resultOrderId);
    
    return res.status(200).json({
      success: true,
      message: 'Feedback submitted successfully',
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error submitting call prioritization feedback', {
      error: error.message,
      stack: error.stack,
      prioritizationId,
      requestId: req.id,
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to submit call prioritization feedback',
      message: error.message,
      requestId: req.id,
    });
  }
});

export default router;
