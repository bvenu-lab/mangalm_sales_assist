import { Router, Request, Response } from 'express';
import { productRepository } from '../database/product-repository';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Get all products with filtering and pagination
 */
router.get('/products', async (req: Request, res: Response) => {
  try {
    const params = {
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
      search: req.query.search as string,
      category: req.query.category as string,
      brand: req.query.brand as string,
      isActive: req.query.isActive ? req.query.isActive === 'true' : undefined,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as 'asc' | 'desc'
    };

    const result = await productRepository.getAll(params);
    
    res.json({
      success: true,
      data: result.data,
      total: result.total,
      limit: params.limit,
      offset: params.offset
    });
  } catch (error) {
    logger.error('Error in GET /products', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products'
    });
  }
});

/**
 * Get product categories
 */
router.get('/products/categories', async (req: Request, res: Response) => {
  try {
    const categories = await productRepository.getCategories();
    
    res.json({
      success: true,
      data: categories,
      total: categories.length
    });
  } catch (error) {
    logger.error('Error in GET /products/categories', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

/**
 * Get product brands
 */
router.get('/products/brands', async (req: Request, res: Response) => {
  try {
    const brands = await productRepository.getBrands();
    
    res.json({
      success: true,
      data: brands,
      total: brands.length
    });
  } catch (error) {
    logger.error('Error in GET /products/brands', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch brands'
    });
  }
});

/**
 * Get products by category
 */
router.get('/products/category/:category', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const products = await productRepository.getByCategory(req.params.category, limit);
    
    res.json({
      success: true,
      data: products,
      total: products.length
    });
  } catch (error) {
    logger.error(`Error in GET /products/category/${req.params.category}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products by category'
    });
  }
});

/**
 * Get product by ID
 */
router.get('/products/:id', async (req: Request, res: Response) => {
  try {
    const product = await productRepository.getById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    logger.error(`Error in GET /products/${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product'
    });
  }
});

/**
 * Create a new product
 */
router.post('/products', async (req: Request, res: Response) => {
  try {
    const product = await productRepository.create(req.body);
    
    res.status(201).json({
      success: true,
      data: product,
      message: 'Product created successfully'
    });
  } catch (error) {
    logger.error('Error in POST /products', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create product'
    });
  }
});

/**
 * Update a product
 */
router.put('/products/:id', async (req: Request, res: Response) => {
  try {
    const product = await productRepository.update(req.params.id, req.body);
    
    res.json({
      success: true,
      data: product,
      message: 'Product updated successfully'
    });
  } catch (error: any) {
    logger.error(`Error in PUT /products/${req.params.id}`, error);
    
    if (error.message === 'Product not found') {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update product'
    });
  }
});

/**
 * Delete a product
 */
router.delete('/products/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await productRepository.delete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    logger.error(`Error in DELETE /products/${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete product'
    });
  }
});

export { router as productRoutes };