# DATA PIPELINE ARCHITECTURE - Complete System Mapping

## Overview
This document traces every frontend element through the entire data pipeline, from upload to database to API to frontend display. Each page section shows the complete data flow with exact table columns, API endpoints, and field mappings.

## Database Tables & Columns

### Core Transaction Tables
```sql
1. mangalam_invoices (Primary source data)
   - id (UUID)
   - invoice_id (VARCHAR) 
   - invoice_date (DATE)
   - customer_id (VARCHAR) -> stores.id
   - customer_name (VARCHAR)
   - total (DECIMAL)
   - item_name (VARCHAR)
   - quantity (INTEGER)
   - item_price (DECIMAL)
   - item_total (DECIMAL)
   - category_name (VARCHAR)
   - brand (VARCHAR)

2. stores
   - id (VARCHAR) PRIMARY KEY
   - name (VARCHAR)
   - address (TEXT)
   - phone (VARCHAR)
   - email (VARCHAR)
   - contact_person (VARCHAR)
   - region (VARCHAR)
   - created_at (TIMESTAMP)

3. orders (Generated from uploads)
   - id (UUID)
   - order_number (VARCHAR)
   - store_id (VARCHAR) -> stores.id
   - customer_name (VARCHAR)
   - total_amount (DECIMAL)
   - items (JSONB)
   - status (ENUM)
   - source (VARCHAR)
   - created_at (TIMESTAMP)

4. predicted_orders
   - id (UUID)
   - store_id (VARCHAR) -> stores.id
   - predicted_date (DATE)
   - confidence (DECIMAL)
   - total_amount (DECIMAL)
   - items (JSONB)
   - status (VARCHAR)
   - priority (INTEGER)
   - ai_recommendation (TEXT)

5. invoice_items (Normalized items)
   - id (UUID)
   - invoice_id (VARCHAR) -> mangalam_invoices.invoice_id
   - product_id (UUID) -> products.id
   - product_name (VARCHAR)
   - quantity (INTEGER)
   - unit_price (DECIMAL)
   - total_price (DECIMAL)

6. products
   - id (UUID)
   - name (VARCHAR)
   - sku (VARCHAR)
   - category (VARCHAR)
   - brand (VARCHAR)
   - price (DECIMAL)

7. upselling_recommendations
   - id (UUID)
   - order_id (UUID)
   - store_id (VARCHAR) -> stores.id
   - product_id (UUID) -> products.id
   - recommendation_type (VARCHAR)
   - confidence (DECIMAL)
   - reason (TEXT)
   - suggested_quantity (INTEGER)
   - expected_revenue (DECIMAL)
   - status (VARCHAR)

8. customer_segments
   - store_id (VARCHAR) -> stores.id
   - segment_name (VARCHAR)
   - segment_value (VARCHAR)
   - total_revenue (DECIMAL)
   - order_frequency (DECIMAL)
   - avg_order_value (DECIMAL)
   - last_order_date (DATE)
   - churn_risk (DECIMAL)

9. call_prioritization
   - id (UUID)
   - store_id (VARCHAR) -> stores.id
   - priority_score (DECIMAL)
   - last_order_days (INTEGER)
   - order_frequency (DECIMAL)
   - average_order_value (DECIMAL)
   - total_revenue (DECIMAL)
   - is_new_customer (BOOLEAN)
   - recommended_action (TEXT)
```

## Data Upload Pipeline

### 1. CSV/Excel Upload Flow
```
Frontend Upload (UploadPage.tsx) 
→ Bulk Upload API (Port 3009)
→ Validation & Processing
→ Database Insert
```

#### Upload Processing Steps:
1. **File Reception** (`/api/upload/enterprise`)
   - Accepts CSV/Excel files
   - Validates file format and size
   
2. **Data Validation** (DataValidator class)
   - Required fields: invoice_id, customer_name, item_name, quantity, item_price
   - Type validation: numeric fields, date formats
   - Business rules: positive amounts, valid dates

3. **Database Insertion**
   ```sql
   INSERT INTO mangalam_invoices (
     invoice_id, invoice_date, customer_id, customer_name,
     total, item_name, quantity, item_price, item_total,
     category_name, brand
   )
   ```

4. **Triggers Fire Automatically**
   - `populate_invoice_items()` → Creates invoice_items records
   - `update_customer_segments()` → Updates customer segmentation
   - `calculate_product_associations()` → Updates product relationships
   - `generate_upselling_recommendations()` → Creates upsell opportunities

## Frontend Pages & Data Mapping

### 1. Dashboard Page (`DashboardPage.tsx`)

#### A. Call Prioritization Card
**Frontend Display:**
- Store name
- Priority score (0-10)
- Priority reason
- Last order days
- Status

**Data Flow:**
```
Frontend: GET /api/calls/prioritized
↓
API Gateway: dashboard-routes.ts:12
↓
SQL Query: Lines 29-91
  FROM: stores
  JOIN: mangalam_invoices ON stores.name = mangalam_invoices.customer_name
  CALCULATE: priority_score based on:
    - Days since last order
    - Average order value  
    - Total orders count
↓
Returns: {
  storeId: stores.id,
  store: { name, city, region },
  priorityScore: calculated (0-10),
  priorityReason: string,
  status: 'pending'
}
```

**Mapping:**
- `stores.id` → `storeId`
- `stores.name` → `store.name`
- `stores.address` → `store.city`
- Calculated `priority_score` → `priorityScore`
- Calculated reason → `priorityReason`

#### B. Performance Summary Card
**Frontend Display:**
- Calls Completed
- Orders Placed
- Upsell Success Rate
- Average Order Value
- Total Revenue

**Data Flow:**
```
Frontend: GET /api/performance/summary
↓
API Gateway: dashboard-routes.ts:816
↓
SQL Query: Lines 823-876
  FROM: mangalam_invoices
  AGGREGATE:
    - COUNT(DISTINCT id) as orders_count
    - AVG(total) as avg_order_value
    - SUM(total) as total_revenue
↓
Returns: {
  callsCompleted: count,
  ordersPlaced: count,
  averageOrderValue: avg,
  totalRevenue: sum
}
```

**Mapping:**
- `COUNT(mangalam_invoices.id)` → `ordersPlaced`
- `AVG(mangalam_invoices.total)` → `averageOrderValue`
- `SUM(mangalam_invoices.total)` → `totalRevenue`

#### C. Recent Orders List
**Frontend Display:**
- Order number
- Store name
- Customer name
- Total amount
- Order date
- Status

**Data Flow:**
```
Frontend: GET /api/orders/recent
↓
API Gateway: dashboard-routes.ts:603
↓
SQL Query: Lines 609-668
  FROM: orders
  JOIN: stores ON orders.store_id = stores.id
↓
Returns: order details with store info
```

**Mapping:**
- `orders.order_number` → `orderNumber`
- `stores.name` → `store.name`
- `orders.customer_name` → `customerName`
- `orders.total_amount` → `totalAmount`
- `orders.created_at` → `orderDate`
- `orders.status` → `status`

### 2. Stores Page (`StoresPage.tsx`)

#### Store List Table
**Frontend Display:**
- Store ID
- Store Name
- Address
- Region
- Last Order Date
- Total Revenue
- Order Count

**Data Flow:**
```
Frontend: GET /api/stores
↓
API Gateway: store-routes.ts
↓
SQL Query:
  FROM: stores
  LEFT JOIN: mangalam_invoices
  GROUP BY: store_id
  AGGREGATE: revenue, order count
↓
Returns: store details with metrics
```

**Mapping:**
- `stores.id` → `id`
- `stores.name` → `name`
- `stores.address` → `address`
- `stores.region` → `region`
- `MAX(mangalam_invoices.invoice_date)` → `lastOrderDate`
- `SUM(mangalam_invoices.total)` → `totalRevenue`
- `COUNT(mangalam_invoices.id)` → `orderCount`

### 3. Analytics Page (`AnalyticsPage.tsx`)

#### A. Revenue Trends Chart
**Frontend Display:**
- Daily/Weekly/Monthly revenue trends
- Line chart with date and amount

**Data Flow:**
```
Frontend: GET /api/analytics/trends?range=7d
↓
API Gateway: dashboard-routes.ts:1117
↓
SQL Query: Lines 1124-1140
  FROM: mangalam_invoices
  GROUP BY: DATE_TRUNC('day', invoice_date)
  AGGREGATE: SUM(total) as revenue
↓
Returns: [{ date, revenue }]
```

**Mapping:**
- `invoice_date` → `date`
- `SUM(total)` → `revenue`

#### B. Product Distribution
**Frontend Display:**
- Product name
- Category
- Order count
- Total quantity
- Revenue contribution

**Data Flow:**
```
Frontend: GET /api/analytics/product-distribution
↓
API Gateway: dashboard-routes.ts:1158
↓
SQL Query: Lines 1161-1180
  FROM: mangalam_invoices
  GROUP BY: item_name, category_name
  AGGREGATE: counts and revenue
```

**Mapping:**
- `mangalam_invoices.item_name` → `product_name`
- `mangalam_invoices.category_name` → `category`
- `COUNT(DISTINCT invoice_id)` → `order_count`
- `SUM(quantity)` → `total_quantity`
- `SUM(item_total)` → `total_revenue`

### 4. Upselling Page (`UpsellingPage.tsx`)

#### Recommendations List
**Frontend Display:**
- Product name
- Recommendation type
- Confidence score
- Expected revenue
- Store name
- Action buttons

**Data Flow:**
```
Frontend: GET /api/upselling/recommendations
↓
API Gateway: upselling-routes.ts
↓
SQL Query:
  FROM: upselling_recommendations
  JOIN: products ON product_id
  JOIN: stores ON store_id
  WHERE: status = 'pending'
↓
Returns: recommendations with product details
```

**Mapping:**
- `products.name` → `productName`
- `upselling_recommendations.recommendation_type` → `type`
- `upselling_recommendations.confidence` → `confidenceScore`
- `upselling_recommendations.expected_revenue` → `expectedRevenue`
- `stores.name` → `storeName`
- `upselling_recommendations.reason` → `reason`

### 5. Order Edit Page (`OrderEditPage.tsx`)

#### Predicted Order Details
**Frontend Display:**
- Store information
- Predicted date
- Confidence score
- Item list with quantities
- Total amount
- AI recommendations

**Data Flow:**
```
Frontend: GET /api/orders/pending/:id
↓
API Gateway: dashboard-routes.ts:717
↓
SQL Query: Lines 722-763
  FROM: predicted_orders
  JOIN: stores
  JOIN: predicted_order_items
  JOIN: products
↓
Returns: complete order with items
```

**Mapping:**
- `predicted_orders.predicted_date` → `predictionDate`
- `predicted_orders.confidence` → `confidenceScore`
- `predicted_orders.total_amount` → `totalAmount`
- `predicted_order_items.product_name` → `items[].productName`
- `predicted_order_items.predicted_quantity` → `items[].quantity`
- `predicted_orders.ai_recommendation` → `aiRecommendation`

## Data Quality & Validation

### Upload Validation Rules
1. **Required Fields:**
   - invoice_id (unique)
   - customer_name (matches store)
   - item_name
   - quantity (positive integer)
   - item_price (positive decimal)

2. **Data Transformations:**
   - Customer name → Store ID lookup
   - Item name → Product ID lookup
   - Date normalization (various formats → ISO date)
   - Amount calculations (quantity × price = total)

3. **Error Handling:**
   - Row-level validation with detailed error messages
   - Partial success support (valid rows processed)
   - Error rate circuit breaker (stops at 20% failure)
   - Audit logging for all operations

## System Health Checks

### Critical Data Flows to Monitor:
1. **Upload → Database:**
   - Check: mangalam_invoices row count increasing
   - Check: invoice_items being populated via trigger
   
2. **Database → API:**
   - Check: API queries returning data
   - Check: JOIN operations working correctly
   
3. **API → Frontend:**
   - Check: Response format matches frontend expectations
   - Check: Field names properly mapped (snake_case → camelCase)

### Common Issues & Solutions:

#### Issue: Dashboard shows no data
**Check:**
1. `mangalam_invoices` table has data
2. Store names match between tables
3. Date ranges in queries are correct

#### Issue: Upselling not showing recommendations
**Check:**
1. `product_associations` table populated
2. `upselling_recommendations` trigger working
3. Confidence thresholds not too high

#### Issue: Upload fails
**Check:**
1. CSV format matches expected columns
2. Store names exist in stores table
3. Database connection pool not exhausted

## Performance Optimization Points

1. **Database Indexes:**
   - `idx_mangalam_invoices_customer_id`
   - `idx_mangalam_invoices_invoice_date`
   - `idx_orders_store_id`
   - `idx_upselling_store`

2. **Query Optimization:**
   - Use CTEs for complex aggregations
   - Limit default query results
   - Cache frequently accessed data in Redis

3. **Frontend Optimization:**
   - Pagination for large lists
   - Debounced search inputs
   - Lazy loading for charts

## Testing Data Pipeline

### Test Upload File Format:
```csv
invoice_id,invoice_date,customer_name,item_name,quantity,item_price,item_total,category_name,brand
INV001,2024-01-15,India Sweet and Spices Portland,Basmati Rice,10,45.99,459.90,Rice,Tilda
INV001,2024-01-15,India Sweet and Spices Portland,Red Lentils,5,12.99,64.95,Lentils,MDH
```

### Verification Steps:
1. Upload CSV via frontend
2. Check `mangalam_invoices` for new rows
3. Verify `invoice_items` populated
4. Check dashboard shows updated metrics
5. Verify upselling recommendations generated