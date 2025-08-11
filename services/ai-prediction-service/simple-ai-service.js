const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = 3007;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mangalm_sales',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ai-prediction-service' });
});

// Get predicted orders for a store
app.get('/mangalm/predicted-orders/store/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    
    const query = `
      SELECT po.*, s.name as store_name
      FROM predicted_orders po
      LEFT JOIN stores s ON po.store_id = s.id
      WHERE po.store_id = $1
      ORDER BY po.predicted_date DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [storeId, limit]);
    const orders = result.rows.map(row => ({
      id: row.id,
      storeId: row.store_id,
      storeName: row.store_name,
      predictedDate: row.predicted_date,
      confidence: parseFloat(row.confidence),
      priority: row.priority,
      status: row.status,
      totalAmount: row.total_amount ? parseFloat(row.total_amount) : undefined,
      items: [],
      aiRecommendation: row.ai_recommendation,
      predictionModel: row.prediction_model,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json({
      success: true,
      data: orders,
      total: orders.length
    });
  } catch (error) {
    console.error('Error fetching predicted orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch predicted orders for store'
    });
  }
});

// Get predicted orders for a store (API path)
app.get('/api/predicted-orders/store/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    
    const query = `
      SELECT po.*, s.name as store_name
      FROM predicted_orders po
      LEFT JOIN stores s ON po.store_id = s.id
      WHERE po.store_id = $1
      ORDER BY po.predicted_date DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [storeId, limit]);
    const orders = result.rows.map(row => ({
      id: row.id,
      storeId: row.store_id,
      storeName: row.store_name,
      predictedDate: row.predicted_date,
      confidence: parseFloat(row.confidence),
      priority: row.priority,
      status: row.status,
      totalAmount: row.total_amount ? parseFloat(row.total_amount) : undefined,
      items: [],
      aiRecommendation: row.ai_recommendation,
      predictionModel: row.prediction_model,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json({
      success: true,
      data: orders,
      total: orders.length
    });
  } catch (error) {
    console.error('Error fetching predicted orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch predicted orders for store'
    });
  }
});

// Get invoices for a store
app.get('/mangalm/invoices/store/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    
    const query = `
      SELECT i.*
      FROM historical_invoices i
      WHERE i.store_id = $1
      ORDER BY i.invoice_date DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [storeId, limit]);
    const invoices = result.rows.map(row => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      storeId: row.store_id,
      storeName: row.store_name,
      invoiceDate: row.invoice_date,
      totalAmount: parseFloat(row.total_amount),
      currency: row.currency || 'INR',
      status: row.status || 'completed',
      items: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json({
      success: true,
      data: invoices,
      total: invoices.length
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoices for store'
    });
  }
});

// Approve predicted order
app.post('/mangalm/predicted-orders/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      UPDATE predicted_orders
      SET status = 'approved', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Predicted order not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Order approved successfully'
    });
  } catch (error) {
    console.error('Error approving predicted order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve predicted order'
    });
  }
});

// Get call prioritization
app.get('/api/call-prioritization', async (req, res) => {
  try {
    const { storeId } = req.query;
    
    // For now, return mock call prioritization data
    // In a real implementation, this would query the call_prioritization table
    const mockData = {
      id: `call-${storeId}`,
      storeId: storeId,
      priorityScore: 7.5,
      priorityReason: 'High value customer with recent order activity',
      lastCallDate: '2025-01-10',
      nextCallDate: '2025-01-15',
      status: 'Scheduled',
      notes: 'Follow up on recent order and discuss new products',
      assignedAgent: 'Sales Agent 1'
    };
    
    res.json({
      success: true,
      data: [mockData],
      total: 1
    });
  } catch (error) {
    console.error('Error fetching call prioritization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch call prioritization'
    });
  }
});

// Get call prioritization by ID
app.get('/mangalm/call-prioritization/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const mockData = {
      id: id,
      storeId: '4261931000000126326',
      priorityScore: 7.5,
      priorityReason: 'High value customer with recent order activity',
      lastCallDate: '2025-01-10',
      nextCallDate: '2025-01-15',
      status: 'Scheduled',
      notes: 'Follow up on recent order and discuss new products',
      assignedAgent: 'Sales Agent 1'
    };
    
    res.json({
      success: true,
      data: mockData
    });
  } catch (error) {
    console.error('Error fetching call prioritization by ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch call prioritization'
    });
  }
});

// Mark call as contacted
app.post('/mangalm/call-prioritization/:id/contacted', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    res.json({
      success: true,
      data: {
        id,
        status: 'Completed',
        contactedAt: new Date().toISOString(),
        notes
      },
      message: 'Call marked as contacted'
    });
  } catch (error) {
    console.error('Error marking call as contacted:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark call as contacted'
    });
  }
});

// Reschedule call
app.post('/mangalm/call-prioritization/:id/reschedule', async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledDate } = req.body;
    
    res.json({
      success: true,
      data: {
        id,
        nextCallDate: scheduledDate,
        status: 'Rescheduled',
        rescheduledAt: new Date().toISOString()
      },
      message: 'Call rescheduled successfully'
    });
  } catch (error) {
    console.error('Error rescheduling call:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reschedule call'
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`AI Prediction Service running on port ${port}`);
  console.log(`http://localhost:${port}`);
});