// SQLite-based routes for API Gateway
import { Router } from 'express';
import SQLiteConnection from '../database/sqlite-connection';

const router = Router();
const dbConnection = SQLiteConnection.getInstance();
const db = dbConnection.getDatabase();

// Dashboard summary endpoint
router.get('/dashboard/summary', (req, res) => {
    try {
        const storesCount = db.prepare('SELECT COUNT(*) as count FROM stores').get() as { count: number };
        const productsCount = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
        const invoicesCount = db.prepare('SELECT COUNT(*) as count FROM mangalam_invoices').get() as { count: number };
        const predictedOrdersCount = db.prepare('SELECT COUNT(*) as count FROM predicted_orders').get() as { count: number };
        
        // Get recent uploads
        const recentUploads = db.prepare(`
            SELECT id, filename, status, successful_rows, failed_rows, created_at 
            FROM bulk_uploads 
            ORDER BY created_at DESC 
            LIMIT 5
        `).all();

        res.json({
            success: true,
            data: {
                summary: {
                    totalStores: storesCount.count,
                    totalProducts: productsCount.count,
                    totalInvoices: invoicesCount.count,
                    predictedOrders: predictedOrdersCount.count
                },
                recentActivity: {
                    uploads: recentUploads
                },
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Dashboard summary error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard summary',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Stores endpoint
router.get('/stores', (req, res) => {
    try {
        const stores = db.prepare(`
            SELECT s.*, 
                   COUNT(mi.id) as invoice_count,
                   COALESCE(SUM(mi.total), 0) as total_revenue
            FROM stores s
            LEFT JOIN mangalam_invoices mi ON s.id = mi.store_id
            GROUP BY s.id
            ORDER BY s.name
            LIMIT 100
        `).all();

        res.json({
            success: true,
            data: stores,
            count: stores.length
        });
    } catch (error) {
        console.error('Stores fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch stores',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Single store endpoint
router.get('/stores/:id', (req, res) => {
    try {
        const store = db.prepare(`
            SELECT s.*, 
                   COUNT(mi.id) as invoice_count,
                   COALESCE(SUM(mi.total), 0) as total_revenue,
                   MAX(mi.invoice_date) as last_order_date
            FROM stores s
            LEFT JOIN mangalam_invoices mi ON s.id = mi.store_id
            WHERE s.id = ?
            GROUP BY s.id
        `).get(req.params.id);

        if (!store) {
            return res.status(404).json({
                success: false,
                error: 'Store not found'
            });
        }

        // Get recent invoices for this store
        const recentInvoices = db.prepare(`
            SELECT * FROM mangalam_invoices 
            WHERE store_id = ? 
            ORDER BY invoice_date DESC 
            LIMIT 10
        `).all(req.params.id);

        res.json({
            success: true,
            data: {
                store,
                recentInvoices
            }
        });
    } catch (error) {
        console.error('Store fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch store details',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Products endpoint
router.get('/products', (req, res) => {
    try {
        const products = db.prepare(`
            SELECT p.*, 
                   COUNT(ii.id) as order_count,
                   COALESCE(SUM(ii.quantity), 0) as total_quantity_sold
            FROM products p
            LEFT JOIN invoice_items ii ON p.id = ii.product_id
            GROUP BY p.id
            ORDER BY p.name
            LIMIT 100
        `).all();

        res.json({
            success: true,
            data: products,
            count: products.length
        });
    } catch (error) {
        console.error('Products fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch products',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Orders endpoint
router.get('/orders', (req, res) => {
    try {
        const orders = db.prepare(`
            SELECT mi.*, s.name as store_name,
                   COUNT(ii.id) as item_count
            FROM mangalam_invoices mi
            LEFT JOIN stores s ON mi.store_id = s.id
            LEFT JOIN invoice_items ii ON mi.id = ii.invoice_id
            GROUP BY mi.id
            ORDER BY mi.invoice_date DESC
            LIMIT 100
        `).all();

        res.json({
            success: true,
            data: orders,
            count: orders.length
        });
    } catch (error) {
        console.error('Orders fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch orders',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Predicted orders endpoint
router.get('/orders/predicted', (req, res) => {
    try {
        const predictedOrders = db.prepare(`
            SELECT po.*, s.name as store_name,
                   COUNT(poi.id) as item_count
            FROM predicted_orders po
            LEFT JOIN stores s ON po.store_id = s.id
            LEFT JOIN predicted_order_items poi ON po.id = poi.predicted_order_id
            GROUP BY po.id
            ORDER BY po.predicted_date DESC
            LIMIT 100
        `).all();

        res.json({
            success: true,
            data: predictedOrders,
            count: predictedOrders.length
        });
    } catch (error) {
        console.error('Predicted orders fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch predicted orders',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Analytics endpoints
router.get('/analytics/trends', (req, res) => {
    try {
        // Monthly sales trends
        const trends = db.prepare(`
            SELECT 
                strftime('%Y-%m', invoice_date) as month,
                COUNT(*) as order_count,
                SUM(total) as revenue,
                COUNT(DISTINCT store_id) as unique_stores
            FROM mangalam_invoices
            WHERE invoice_date >= date('now', '-12 months')
            GROUP BY strftime('%Y-%m', invoice_date)
            ORDER BY month
        `).all();

        res.json({
            success: true,
            data: trends
        });
    } catch (error) {
        console.error('Analytics trends error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch analytics trends',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

router.get('/analytics/product-distribution', (req, res) => {
    try {
        const distribution = db.prepare(`
            SELECT 
                p.brand,
                p.category,
                COUNT(ii.id) as order_count,
                SUM(ii.quantity) as total_quantity,
                SUM(ii.total_amount) as total_revenue
            FROM products p
            LEFT JOIN invoice_items ii ON p.id = ii.product_id
            GROUP BY p.brand, p.category
            HAVING order_count > 0
            ORDER BY total_revenue DESC
            LIMIT 20
        `).all();

        res.json({
            success: true,
            data: distribution
        });
    } catch (error) {
        console.error('Product distribution error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch product distribution',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;