# Mangalm API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Base URLs](#base-urls)
4. [Rate Limiting](#rate-limiting)
5. [Error Handling](#error-handling)
6. [API Endpoints](#api-endpoints)
7. [WebSocket Events](#websocket-events)
8. [Examples](#examples)

## Overview

The Mangalm Sales Assistant API provides RESTful endpoints for managing sales predictions, orders, stores, and integrations. All responses follow a consistent JSON structure with proper error handling and status codes.

### API Standards
- RESTful design principles
- JSON request/response format
- JWT-based authentication
- Semantic versioning
- Comprehensive error codes

## Authentication

### JWT Token Authentication

All API requests require authentication using JWT tokens.

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user-123",
      "username": "admin",
      "role": "admin",
      "permissions": ["read", "write", "delete"]
    },
    "expiresIn": 3600
  },
  "meta": {
    "timestamp": "2025-08-10T12:00:00Z",
    "requestId": "req-123"
  }
}
```

#### Using the Token
Include the JWT token in the Authorization header:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Token Refresh
```http
POST /auth/refresh
Authorization: Bearer <refresh_token>
```

## Base URLs

| Environment | Base URL |
|------------|----------|
| Local | `http://localhost:3007` |
| Development | `https://dev-api.mangalm.com` |
| Staging | `https://staging-api.mangalm.com` |
| Production | `https://api.mangalm.com` |

## Rate Limiting

| Endpoint Type | Rate Limit | Window |
|--------------|------------|---------|
| Authentication | 5 requests | 15 minutes |
| Predictions | 100 requests | 1 minute |
| CRUD Operations | 1000 requests | 1 hour |
| Bulk Operations | 10 requests | 1 minute |

Rate limit headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1628856000
```

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_001",
    "message": "Validation failed",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    },
    "timestamp": "2025-08-10T12:00:00Z",
    "requestId": "req-123",
    "documentation": "https://docs.mangalm.com/errors/VALIDATION_001"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| AUTH_001 | 401 | Invalid credentials |
| AUTH_002 | 401 | Token expired |
| AUTH_003 | 403 | Insufficient permissions |
| VALIDATION_001 | 400 | Validation failed |
| VALIDATION_002 | 400 | Missing required field |
| RESOURCE_001 | 404 | Resource not found |
| RESOURCE_002 | 409 | Resource already exists |
| SERVER_001 | 500 | Internal server error |
| SERVER_002 | 503 | Service unavailable |
| RATE_001 | 429 | Rate limit exceeded |

## API Endpoints

### 1. Stores API

#### List Stores
```http
GET /api/v1/stores?page=1&limit=20&search=bangalore&sort=name:asc
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| limit | integer | 20 | Items per page (max: 100) |
| search | string | - | Search term |
| sort | string | created_at:desc | Sort field and order |
| filter | object | - | JSON filter object |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "store-123",
      "name": "Bangalore Store 1",
      "code": "BLR001",
      "address": "123 MG Road, Bangalore",
      "city": "Bangalore",
      "state": "Karnataka",
      "pincode": "560001",
      "phone": "+91-80-12345678",
      "email": "blr001@example.com",
      "manager": "John Doe",
      "size": "large",
      "category": "premium",
      "active": true,
      "lastOrderDate": "2025-08-09",
      "totalRevenue": 1500000,
      "averageOrderValue": 25000,
      "metadata": {
        "region": "South",
        "tier": 1
      }
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

#### Get Store Details
```http
GET /api/v1/stores/{storeId}
```

#### Create Store
```http
POST /api/v1/stores
Content-Type: application/json

{
  "name": "New Store",
  "code": "NST001",
  "address": "456 Park Street",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "phone": "+91-22-98765432",
  "email": "nst001@example.com",
  "manager": "Jane Smith",
  "size": "medium",
  "category": "standard"
}
```

#### Update Store
```http
PUT /api/v1/stores/{storeId}
Content-Type: application/json

{
  "name": "Updated Store Name",
  "manager": "New Manager"
}
```

#### Delete Store
```http
DELETE /api/v1/stores/{storeId}
```

### 2. Predictions API

#### Generate Prediction
```http
POST /api/v1/predictions/generate
Content-Type: application/json

{
  "storeId": "store-123",
  "horizon": 30,
  "products": ["prod-1", "prod-2"],
  "includeConfidence": true,
  "model": "ensemble-v2"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "predictionId": "pred-456",
    "storeId": "store-123",
    "horizon": 30,
    "generatedAt": "2025-08-10T12:00:00Z",
    "model": {
      "name": "ensemble-v2",
      "version": "2.0.0",
      "accuracy": 0.87
    },
    "predictions": [
      {
        "productId": "prod-1",
        "productName": "Product A",
        "predictedQuantity": 150,
        "confidence": 0.85,
        "pricePerUnit": 100,
        "predictedRevenue": 15000,
        "factors": {
          "seasonality": 0.3,
          "trend": 0.5,
          "historical": 0.2
        }
      }
    ],
    "summary": {
      "totalProducts": 2,
      "totalQuantity": 300,
      "totalRevenue": 30000,
      "averageConfidence": 0.82
    }
  }
}
```

#### Get Prediction History
```http
GET /api/v1/predictions?storeId={storeId}&startDate=2025-08-01&endDate=2025-08-10
```

#### Get Prediction Accuracy
```http
GET /api/v1/predictions/{predictionId}/accuracy
```

**Response:**
```json
{
  "success": true,
  "data": {
    "predictionId": "pred-456",
    "actualVsPredicted": [
      {
        "productId": "prod-1",
        "predicted": 150,
        "actual": 145,
        "accuracy": 0.97,
        "deviation": -3.33
      }
    ],
    "overallAccuracy": 0.89,
    "mape": 5.2,
    "rmse": 12.5
  }
}
```

### 3. Orders API

#### Create Order
```http
POST /api/v1/orders
Content-Type: application/json

{
  "storeId": "store-123",
  "predictionId": "pred-456",
  "items": [
    {
      "productId": "prod-1",
      "quantity": 150,
      "pricePerUnit": 100,
      "discount": 5
    }
  ],
  "deliveryDate": "2025-08-15",
  "paymentTerms": "NET30",
  "notes": "Urgent delivery required"
}
```

#### List Orders
```http
GET /api/v1/orders?status=pending&storeId={storeId}
```

#### Update Order Status
```http
PATCH /api/v1/orders/{orderId}/status
Content-Type: application/json

{
  "status": "confirmed",
  "notes": "Payment received"
}
```

#### Cancel Order
```http
POST /api/v1/orders/{orderId}/cancel
Content-Type: application/json

{
  "reason": "Customer request",
  "refundAmount": 15000
}
```

### 4. Products API

#### List Products
```http
GET /api/v1/products?category=electronics&inStock=true
```

#### Get Product Details
```http
GET /api/v1/products/{productId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "prod-1",
    "name": "Product A",
    "sku": "SKU001",
    "category": "electronics",
    "brand": "Brand X",
    "description": "High-quality electronic device",
    "price": 100,
    "cost": 70,
    "margin": 30,
    "stock": {
      "available": 500,
      "reserved": 50,
      "incoming": 200
    },
    "images": [
      "https://cdn.mangalm.com/products/prod-1-main.jpg"
    ],
    "specifications": {
      "weight": "500g",
      "dimensions": "10x10x5cm"
    },
    "performance": {
      "salesLast30Days": 250,
      "averageRating": 4.5,
      "returnRate": 0.02
    }
  }
}
```

### 5. Analytics API

#### Sales Analytics
```http
GET /api/v1/analytics/sales?period=monthly&year=2025
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "monthly",
    "year": 2025,
    "metrics": [
      {
        "month": "January",
        "revenue": 5000000,
        "orders": 250,
        "averageOrderValue": 20000,
        "growth": 15.5
      }
    ],
    "summary": {
      "totalRevenue": 60000000,
      "totalOrders": 3000,
      "averageGrowth": 12.3,
      "topStore": "store-123",
      "topProduct": "prod-1"
    }
  }
}
```

#### Performance Metrics
```http
GET /api/v1/analytics/performance?agentId={agentId}&period=weekly
```

#### Prediction Analytics
```http
GET /api/v1/analytics/predictions/accuracy?modelId={modelId}
```

### 6. Users API

#### Get User Profile
```http
GET /api/v1/users/profile
```

#### Update Profile
```http
PUT /api/v1/users/profile
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+91-9876543210",
  "preferences": {
    "notifications": true,
    "theme": "dark"
  }
}
```

#### List Users (Admin)
```http
GET /api/v1/users?role=agent
```

#### Create User (Admin)
```http
POST /api/v1/users
Content-Type: application/json

{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "role": "agent",
  "permissions": ["read", "write"]
}
```

### 7. Zoho Integration API

#### Sync Status
```http
GET /api/v1/zoho/sync/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "lastSync": "2025-08-10T11:00:00Z",
    "nextSync": "2025-08-10T12:00:00Z",
    "status": "active",
    "statistics": {
      "contactsSynced": 150,
      "productsSynced": 500,
      "invoicesSynced": 1000,
      "errorCount": 2
    }
  }
}
```

#### Trigger Manual Sync
```http
POST /api/v1/zoho/sync/trigger
Content-Type: application/json

{
  "entities": ["contacts", "products", "invoices"],
  "mode": "incremental"
}
```

#### Map Fields
```http
POST /api/v1/zoho/mapping
Content-Type: application/json

{
  "entity": "contacts",
  "mapping": {
    "name": "Full_Name",
    "email": "Email",
    "phone": "Phone"
  }
}
```

### 8. Import/Export API

#### Import CSV Data
```http
POST /api/v1/import/csv
Content-Type: multipart/form-data

FormData:
- file: invoice_data.csv
- entity: invoices
- mapping: {"invoice_no": "A", "date": "B", "amount": "C"}
```

#### Export Data
```http
POST /api/v1/export
Content-Type: application/json

{
  "entity": "orders",
  "format": "excel",
  "filters": {
    "startDate": "2025-08-01",
    "endDate": "2025-08-31"
  },
  "fields": ["orderNumber", "storeName", "totalAmount", "status"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "exportId": "exp-789",
    "status": "processing",
    "downloadUrl": null,
    "estimatedTime": 30
  }
}
```

#### Check Export Status
```http
GET /api/v1/export/{exportId}/status
```

### 9. Notifications API

#### Get Notifications
```http
GET /api/v1/notifications?unread=true
```

#### Mark as Read
```http
PUT /api/v1/notifications/{notificationId}/read
```

#### Update Preferences
```http
PUT /api/v1/notifications/preferences
Content-Type: application/json

{
  "email": true,
  "push": false,
  "sms": true,
  "types": {
    "orderConfirmation": true,
    "predictionReady": true,
    "systemAlerts": false
  }
}
```

### 10. Health & Monitoring API

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "uptime": 86400,
    "services": {
      "database": "connected",
      "redis": "connected",
      "zoho": "connected"
    },
    "metrics": {
      "requestsPerMinute": 120,
      "averageResponseTime": 45,
      "activeConnections": 25
    }
  }
}
```

#### Metrics
```http
GET /metrics
```

Returns Prometheus-formatted metrics.

## WebSocket Events

### Connection
```javascript
const ws = new WebSocket('ws://localhost:3007/ws');

ws.on('open', () => {
  // Send authentication
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'eyJhbGciOiJIUzI1NiIs...'
  }));
});
```

### Event Types

#### Prediction Updates
```json
{
  "type": "prediction.completed",
  "data": {
    "predictionId": "pred-456",
    "storeId": "store-123",
    "status": "completed",
    "summary": {
      "totalProducts": 50,
      "processingTime": 2.5
    }
  }
}
```

#### Order Updates
```json
{
  "type": "order.status_changed",
  "data": {
    "orderId": "order-789",
    "previousStatus": "pending",
    "newStatus": "confirmed",
    "timestamp": "2025-08-10T12:00:00Z"
  }
}
```

#### Sync Updates
```json
{
  "type": "sync.progress",
  "data": {
    "entity": "invoices",
    "progress": 75,
    "processed": 750,
    "total": 1000
  }
}
```

### Subscribing to Events
```javascript
// Subscribe to specific events
ws.send(JSON.stringify({
  type: 'subscribe',
  events: ['prediction.*', 'order.status_changed']
}));

// Unsubscribe
ws.send(JSON.stringify({
  type: 'unsubscribe',
  events: ['prediction.*']
}));
```

## Examples

### Complete Order Flow

#### 1. Generate Prediction
```javascript
const response = await fetch('http://localhost:3007/api/v1/predictions/generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    storeId: 'store-123',
    horizon: 30
  })
});

const prediction = await response.json();
```

#### 2. Create Order from Prediction
```javascript
const orderData = {
  storeId: prediction.data.storeId,
  predictionId: prediction.data.predictionId,
  items: prediction.data.predictions.map(p => ({
    productId: p.productId,
    quantity: p.predictedQuantity,
    pricePerUnit: p.pricePerUnit
  }))
};

const orderResponse = await fetch('http://localhost:3007/api/v1/orders', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(orderData)
});
```

### Pagination Example

```javascript
async function getAllStores() {
  const stores = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `http://localhost:3007/api/v1/stores?page=${page}&limit=100`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    const data = await response.json();
    stores.push(...data.data);
    
    hasMore = data.meta.pagination.hasNext;
    page++;
  }

  return stores;
}
```

### Error Handling Example

```javascript
try {
  const response = await fetch('http://localhost:3007/api/v1/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(orderData)
  });

  if (!response.ok) {
    const error = await response.json();
    
    switch (error.error.code) {
      case 'AUTH_002':
        // Token expired, refresh it
        await refreshToken();
        break;
      case 'VALIDATION_001':
        // Handle validation error
        console.error('Validation failed:', error.error.details);
        break;
      case 'RATE_001':
        // Rate limited, wait and retry
        const resetTime = response.headers.get('X-RateLimit-Reset');
        await waitUntil(resetTime);
        break;
      default:
        throw new Error(error.error.message);
    }
  }
} catch (error) {
  console.error('API call failed:', error);
}
```

### Batch Operations Example

```javascript
// Batch create products
const products = [
  { name: 'Product 1', sku: 'SKU001', price: 100 },
  { name: 'Product 2', sku: 'SKU002', price: 200 }
];

const response = await fetch('http://localhost:3007/api/v1/products/batch', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ products })
});

const result = await response.json();
console.log(`Created ${result.data.created} products`);
```

## API Versioning

The API uses URL path versioning. The current version is v1.

### Version Header
You can also specify the API version using a header:
```http
API-Version: 1.0.0
```

### Deprecation Notice
Deprecated endpoints will include a deprecation header:
```http
X-API-Deprecation-Date: 2025-12-31
X-API-Deprecation-Info: Use /api/v2/stores instead
```

## SDK Support

### JavaScript/TypeScript
```bash
npm install @mangalm/sdk
```

```javascript
import { MangalmClient } from '@mangalm/sdk';

const client = new MangalmClient({
  apiKey: 'your-api-key',
  baseUrl: 'http://localhost:3007'
});

// Use the client
const stores = await client.stores.list({ page: 1, limit: 20 });
const prediction = await client.predictions.generate({
  storeId: 'store-123',
  horizon: 30
});
```

### Python
```bash
pip install mangalm-sdk
```

```python
from mangalm import Client

client = Client(
    api_key='your-api-key',
    base_url='http://localhost:3007'
)

# Use the client
stores = client.stores.list(page=1, limit=20)
prediction = client.predictions.generate(
    store_id='store-123',
    horizon=30
)
```

## Testing the API

### Using cURL
```bash
# Login
curl -X POST http://localhost:3007/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get stores
curl -X GET http://localhost:3007/api/v1/stores \
  -H "Authorization: Bearer <token>"
```

### Using Postman
Import the Postman collection from `docs/postman/mangalm-api.json`

### API Playground
Access the interactive API playground at:
```
http://localhost:3007/api-docs
```

## Support

For API support and questions:
- Documentation: https://docs.mangalm.com
- API Status: https://status.mangalm.com
- Support Email: api-support@mangalm.com

---

*API Version: 1.0.0*  
*Last Updated: 2025-08-10*