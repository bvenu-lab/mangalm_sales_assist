import { Router, Request, Response } from 'express';
import { storeRepository } from '../database/store-repository';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Get all stores with filtering and pagination
 */
router.get('/stores', async (req: Request, res: Response) => {
  try {
    const params = {
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
      search: req.query.search as string,
      region: req.query.region as string,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as 'asc' | 'desc'
    };

    const result = await storeRepository.getAll(params);
    
    res.json({
      success: true,
      data: result.data,
      total: result.total,
      limit: params.limit,
      offset: params.offset
    });
  } catch (error) {
    logger.error('Error in GET /stores', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stores'
    });
  }
});

/**
 * Get recent stores
 */
router.get('/stores/recent', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
    const stores = await storeRepository.getRecent(limit);
    
    res.json({
      success: true,
      data: stores,
      total: stores.length
    });
  } catch (error) {
    logger.error('Error in GET /stores/recent', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent stores'
    });
  }
});

/**
 * Get unique regions
 */
router.get('/stores/regions', async (req: Request, res: Response) => {
  try {
    const regions = await storeRepository.getRegions();
    
    res.json({
      success: true,
      data: regions,
      total: regions.length
    });
  } catch (error) {
    logger.error('Error in GET /stores/regions', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch regions'
    });
  }
});

/**
 * Get store by ID
 */
router.get('/stores/:id', async (req: Request, res: Response) => {
  try {
    const store = await storeRepository.getById(req.params.id);
    
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
  } catch (error) {
    logger.error(`Error in GET /stores/${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch store'
    });
  }
});

/**
 * Create a new store
 */
router.post('/stores', async (req: Request, res: Response) => {
  try {
    const store = await storeRepository.create(req.body);
    
    res.status(201).json({
      success: true,
      data: store,
      message: 'Store created successfully'
    });
  } catch (error) {
    logger.error('Error in POST /stores', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create store'
    });
  }
});

/**
 * Update a store
 */
router.put('/stores/:id', async (req: Request, res: Response) => {
  try {
    const store = await storeRepository.update(req.params.id, req.body);
    
    res.json({
      success: true,
      data: store,
      message: 'Store updated successfully'
    });
  } catch (error: any) {
    logger.error(`Error in PUT /stores/${req.params.id}`, error);
    
    if (error.message === 'Store not found') {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update store'
    });
  }
});

/**
 * Delete a store
 */
router.delete('/stores/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await storeRepository.delete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Store deleted successfully'
    });
  } catch (error) {
    logger.error(`Error in DELETE /stores/${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete store'
    });
  }
});

export { router as storeRoutes };