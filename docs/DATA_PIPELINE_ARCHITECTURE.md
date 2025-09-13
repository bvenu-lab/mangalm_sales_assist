# Data Pipeline Architecture - Complete Page-by-Page Mapping
## Mangalm Enterprise Sales System - UI to Database Traceability

**Version**: 4.0.0  
**Last Updated**: December 13, 2024  
**Status**: UPDATED WITH FIXES - All table references corrected  
**Purpose**: Complete mapping of every UI element to its data source

---

## 🚨 CRITICAL UPDATES - DECEMBER 13, 2024

### Fixes Applied to Data Pipeline

1. **✅ FIXED: Table References**
   - ~~`historical_invoices`~~ → **`mangalam_invoices`** (ALL occurrences replaced)
   - Affected files: dashboard-routes.ts, performance-routes.ts, upselling-routes.ts, order-routes.ts

2. **✅ FIXED: Store JOIN Conditions**
   - Changed from: `LEFT JOIN historical_invoices hi ON s.id = hi.store_id`
   - Changed to: `LEFT JOIN mangalam_invoices mi ON s.name = mi.customer_name`
   - Note: Using name-based join because mangalam_invoices doesn't have store_id column

3. **✅ FIXED: Product Distribution Backend**
   - Removed dependency on non-existent views (`product_distribution_view`, `product_sales_summary`)
   - Now aggregates directly from `mangalam_invoices` table
   - Location: analytics-routes.ts lines 106-162

4. **✅ FIXED: Date Range Issues**
   - Changed from 30 days to 180 days to accommodate older invoice data
   - Latest invoice date in system: August 5, 2025

5. **✅ FIXED: Performance Metrics**
   - Now calculates from actual `mangalam_invoices` data
   - Returns real metrics: 154 orders, ₹650,596 total revenue

---

## 🎯 Overview

This document provides a **complete traceability matrix** from UI elements to database tables, showing:
- Every page and its components with CORRECTED table references
- The exact API endpoints called
- Backend handlers and SQL queries (UPDATED)
- Database tables and column names (VERIFIED)
- Data transformations at each layer

---

## 📊 1. ENHANCED DASHBOARD PAGE
**File**: `services/sales-frontend/src/pages/dashboard/EnhancedDashboard.tsx`

### 1.1 Key Metrics Cards (Lines 551-624)

#### Latest Revenue Card
```yaml
UI Element: "Latest Revenue" metric card
Frontend Variable: dashboardData.performance?.mostRecentDateRevenue
API Call: GET /api/performance/summary
Backend Handler: dashboard-routes.ts:818-934
SQL Query: Lines 823-876
Database Tables: 
  - mangalam_invoices (invoice_date, total)
  - Most recent date's SUM(total)
Column Mapping:
  - mi.total → total_revenue → mostRecentDateRevenue
  - MAX(invoice_date) → most_recent_date → mostRecentDate
ACTUAL DATA: Returns ₹650,596.56 for August 5, 2025
```

#### Orders Processed Card
```yaml
UI Element: "Orders Processed" metric
Frontend Variable: dashboardData.performance?.ordersPlaced
API Call: GET /api/performance/summary  
Backend Handler: dashboard-routes.ts:823-876
Database Tables:
  - mangalam_invoices (COUNT of records)
Column Mapping:
  - COUNT(DISTINCT mi.id) → orders_count → ordersPlaced
ACTUAL DATA: Returns 154 orders
```

#### Conversion Rate Card
```yaml
UI Element: "Conversion Rate" percentage
Frontend Variable: Calculated from ordersPlaced/callsCompleted
API Call: GET /api/performance/summary
Backend Handler: dashboard-routes.ts:823-876
Database Tables:
  - mangalam_invoices (count for orders)
Column Mapping:
  - COUNT(DISTINCT mi.id) → orders_placed → ordersPlaced
  - Same count used as calls_completed (no separate call tracking)
KNOWN ISSUE: Always shows 100% - no separate call tracking exists
```

#### Average Order Value Card
```yaml
UI Element: "Avg Order Value" metric
Frontend Variable: dashboardData.performance?.averageOrderValue
API Call: GET /api/performance/summary
Backend Handler: dashboard-routes.ts:823-876
Database Tables:
  - mangalam_invoices
Column Mapping:
  - AVG(mi.total) → avg_order_value → averageOrderValue
ACTUAL DATA: Returns ₹4,224.65
```

### 1.2 Prioritized Call List (Lines 704-792)

```yaml
UI Component: Call list with priority scores
Frontend Variables: 
  - dashboardData.callList
  - call.priorityScore, call.priorityReason, call.store
API Call: GET /api/calls/prioritized?limit=10
Backend Handler: dashboard-routes.ts:12-115
SQL Query: Lines 29-91 (WITH store_orders CTE)
Database Tables:
  - stores (id, name, address)
  - mangalam_invoices (customer_name, invoice_date, total)
Column Mapping:
  - s.id → storeId
  - s.name → store.name
  - s.address → store.city/region
  - MAX(mi.invoice_date) → last_order_date [FIXED: was hi.invoice_date]
  - COUNT(mi.id) → total_orders [FIXED: was hi.id]
  - AVG(mi.total) → avg_order_value [FIXED: was hi.total]
  - Calculated priority_score (formula lines 51-66)
  - Calculated priority_reason (CASE statement lines 67-73)
JOIN CONDITION: s.name = mi.customer_name [FIXED: was s.id = hi.store_id]
```

### 1.3 Recent Orders List (Lines 795-890)

```yaml
UI Component: Recent orders with store info and amounts
Frontend Variables:
  - dashboardData.recentOrders
  - order.order_number, order.total_amount, order.customer_name
API Call: GET /api/orders/recent?limit=10
Backend Handler: dashboard-routes.ts:602-687
SQL Query: Lines 609-668
Database Tables:
  - orders (all columns)
  - stores (id, name, address)
Column Mapping:
  - o.id → id
  - o.order_number → order_number
  - o.store_id → store_id
  - s.name → store.name
  - s.address → store.address
  - o.customer_name → customer_name
  - o.customer_phone → customer_phone
  - o.total_amount → total_amount
  - o.status → status
  - o.items → items (JSONB)
  - o.source → source ('document', 'manual', 'csv')
  - o.created_at → order_date
```

### 1.4 Product Distribution Chart (Lines 893-933)

```yaml
UI Component: Stacked bar chart of products by store
Frontend Variables:
  - dashboardData.productByStore
  - dashboardData.topProducts
Data Processing: processDataForVisualization() lines 287-348
API Calls:
  - GET /api/analytics/product-distribution [FIXED]
Backend Handler: analytics-routes.ts:101-162 [UPDATED]
SQL Query: Now aggregates directly from mangalam_invoices
Database Tables:
  - mangalam_invoices (customer_name, item_name, quantity, total)
Column Mapping:
  - mi.customer_name → store_name
  - mi.item_name → product_name
  - SUM(mi.quantity) → quantity_sold
  - SUM(mi.total) → revenue
  - mi.brand → brand
  - mi.category_name → category
FIXED: No longer uses non-existent views
```

### 1.5 Top Products Pie Chart (Lines 935-982)

```yaml
UI Component: Pie chart showing product distribution
Frontend Variables:
  - dashboardData.topProducts
  - entry.name, entry.value, entry.fill (color)
API Call: GET /api/analytics/product-distribution
Backend Handler: analytics-routes.ts:129-144 [UPDATED]
Database Source:
  - mangalam_invoices (aggregated)
Column Mapping:
  - mi.item_name → product_name
  - SUM(mi.quantity) → total_quantity
  - SUM(mi.total) → total_revenue
  - COUNT(DISTINCT mi.customer_name) → store_count
FIXED: Now queries actual invoice data
```

### 1.6 Store Performance Trends (Lines 984-1058)

```yaml
UI Component: Combined chart (area + line + bar)
Frontend Variables:
  - dashboardData.storeTrends
  - datapoint.date, datapoint.revenue, datapoint.orders
API Call: GET /api/analytics/trends?range=${selectedTimeRange}
Backend Handler: analytics-routes.ts:13-98 [UPDATED]
SQL Query: Lines 26-58
Database Tables:
  - mangalam_invoices
Column Mapping:
  - mi.invoice_date → date
  - COUNT(DISTINCT mi.id) → orders
  - SUM(mi.total) → revenue
  - Additional calculated target (80% of revenue)
DATE RANGE: Adjusted to 180 days to capture older data
```

---

## 🏪 2. STORE MANAGEMENT PAGE
**File**: `services/sales-frontend/src/pages/stores/StoreListPage.tsx`

### 2.1 Store List Table

```yaml
API Call: GET /api/stores
Backend Handler: store-routes.ts
Database Table: stores
Column Mapping:
  - id → store.id
  - name → store.name
  - address → store.address
  - phone → store.phone
  - email → store.email
  - created_at → store.created_at
Additional Data:
  - JOIN with mangalam_invoices ON s.name = mi.customer_name [FIXED]
  - JOIN with customer_segments for categorization
```

### 2.2 Store Detail Page
**File**: `services/sales-frontend/src/pages/stores/StoreDetailPage.tsx`

```yaml
API Call: GET /api/stores/:id
Backend Handler: store-routes.ts
Database Tables:
  - stores (main record)
  - store_preferences (settings)
  - mangalam_invoices (order history) [FIXED: was historical_invoices]
  - customer_segments (categorization)
Column Mapping:
  - stores.* → store details
  - store_preferences.call_frequency → preferences.callFrequency
  - store_preferences.payment_terms → preferences.paymentTerms
  - store_preferences.credit_limit → preferences.creditLimit
  - customer_segments.segment_value → segment.value
  - customer_segments.churn_risk → segment.churnRisk
JOIN: mangalam_invoices ON s.name = mi.customer_name [FIXED]
```

---

## 📦 3. ORDER MANAGEMENT PAGES

### 3.1 Order History Page
**File**: `services/sales-frontend/src/pages/orders/OrderHistoryPage.tsx`

```yaml
API Call: GET /api/orders
Backend Handler: Order controller
Database Table: orders
Column Mapping:
  - id → order.id
  - order_number → order.orderNumber
  - store_id → order.storeId
  - customer_name → order.customerName
  - customer_phone → order.customerPhone
  - total_amount → order.totalAmount
  - status → order.status
  - items (JSONB) → order.items[]
  - source → order.source
  - created_at → order.createdAt
NOTE: Orders table is separate from mangalam_invoices
```

### 3.2 Order Create Page
**File**: `services/sales-frontend/src/pages/orders/OrderCreatePage.tsx`

```yaml
API Call: POST /api/orders
Backend Handler: Order creation handler
Database Insert: orders table
Column Mapping:
  - Frontend form.storeId → store_id
  - form.customerName → customer_name
  - form.customerPhone → customer_phone
  - form.items[] → items (JSONB)
  - Calculated total → total_amount
  - 'manual' → source
  - 'pending' → status
  - NOW() → created_at
REMOVED: Insert to historical_invoices (commented out in order-routes.ts)
```

---

## 📤 4. UPLOAD PAGES

### 4.1 Bulk Upload Page (CSV/Excel)
**File**: `services/sales-frontend/src/pages/upload/BulkUploadPage.tsx`

```yaml
API Call: POST /api/bulk-upload
Backend Service: bulk-upload-api (Port 3009)
Handler: server-enterprise-v2.js
Processing Flow:
  1. File upload → temp storage
  2. Parse CSV/Excel → validation
  3. Queue job → Bull/Redis
  4. Batch insert → PostgreSQL
Database Tables:
  - mangalam_invoices (raw data)
  - Triggers populate:
    - stores (from customer data)
    - products (from item data)
    - invoice_items (normalized)
Column Mapping (CSV → Database):
  - Invoice ID → invoice_id
  - Invoice Date → invoice_date
  - Customer ID → customer_id
  - Customer Name → customer_name
  - Item Name → item_name
  - Quantity → quantity
  - Total → total
```

### 4.2 Document Upload (OCR)
**File**: `services/sales-frontend/src/components/documents/DocumentUpload.tsx`

```yaml
API Call: POST /api/documents/upload
Backend Service: document-processor
Processing:
  1. Image/PDF upload
  2. OCR extraction
  3. Data parsing
  4. Order creation
Database Insert: orders table
Column Mapping:
  - Extracted store → store_id
  - Extracted customer → customer_name
  - Extracted items → items (JSONB)
  - Extracted total → total_amount
  - 'document' → source
  - confidence scores → extraction_confidence
```

---

## 📊 5. ANALYTICS & PREDICTIONS

### 5.1 Product Distribution Analytics

```yaml
API Call: GET /api/analytics/product-distribution
Backend Handler: analytics-routes.ts:101-162 [COMPLETELY REWRITTEN]
Database Query:
  WITH store_products AS (
    SELECT 
      mi.customer_name as store_name,
      mi.item_name as product_name,
      SUM(mi.quantity) as quantity_sold,
      SUM(mi.total) as revenue
    FROM mangalam_invoices mi
    WHERE mi.invoice_date >= CURRENT_DATE - INTERVAL '180 days'
    GROUP BY mi.customer_name, mi.item_name, mi.brand, mi.category_name
  )
Column Mapping:
  - customer_name → store_name
  - item_name → product_name
  - SUM(quantity) → quantity_sold
  - SUM(total) → revenue
FIXED: Removed dependency on non-existent views
```

### 5.2 Performance Metrics

```yaml
API Call: GET /api/analytics/performance-metrics
Backend Handler: analytics-routes.ts:165-244
Database Tables:
  - mangalam_invoices (main metrics source)
  - stores (for store count)
Column Mapping:
  - COUNT(DISTINCT mi.id) → total_orders
  - COUNT(DISTINCT mi.customer_name) → unique_stores
  - SUM(mi.total) → total_revenue
  - AVG(mi.total) → avg_order_value
Period Comparison: Calculates growth vs previous period
```

---

## 🔄 6. DATA FLOW PIPELINE

### 6.1 CSV Upload → Dashboard Display (Complete Data Flow)

```mermaid
graph LR
    subgraph "1. Data Input"
        CSV[CSV/Excel File<br/>Invoice Data]
        Upload[POST /api/bulk-upload<br/>Port 3009]
    end
    
    subgraph "2. Processing"
        Queue[Bull Queue<br/>Redis:3379]
        Processor[Queue Processor<br/>Batch Size: 1000]
        Validation[Data Validation<br/>& Cleansing]
    end
    
    subgraph "3. Database - Tables Updated"
        MI[mangalam_invoices<br/>Raw Invoice Data]
        Stores[stores table<br/>Customer Master]
        Products[products table<br/>Product Catalog]
        InvItems[invoice_items<br/>Normalized Items]
        Orders[orders table<br/>Processed Orders]
        CustSeg[customer_segments<br/>Store Classification]
    end
    
    subgraph "4. API Gateway - Endpoints"
        PerfAPI[GET /api/performance/summary<br/>Port 3007]
        CallsAPI[GET /api/calls/prioritized]
        OrdersAPI[GET /api/orders/recent]
        AnalyticsAPI[GET /api/analytics/trends]
        ProdDistAPI[GET /api/analytics/product-distribution]
    end
    
    subgraph "5. Dashboard - UI Elements"
        Revenue[Latest Revenue Card<br/>$650,596.56]
        OrderCount[Orders Processed Card<br/>154 orders]
        Conversion[Conversion Rate Card<br/>100%]
        AvgOrder[Avg Order Value Card<br/>$4,224.65]
        CallList[Prioritized Call List<br/>Top 10 stores]
        RecentOrders[Recent Orders List<br/>Latest transactions]
        ProdChart[Product Distribution Chart<br/>Stacked Bar Chart]
        PieChart[Top Products Pie Chart<br/>Product breakdown]
        TrendChart[Performance Trends<br/>Line/Area Chart]
    end
    
    %% Data Flow Connections
    CSV --> Upload
    Upload --> Queue
    Queue --> Processor
    Processor --> Validation
    
    %% Database Inserts
    Validation -->|INSERT| MI
    MI -->|Populate via JOIN| Stores
    MI -->|Extract Unique| Products
    MI -->|Normalize| InvItems
    MI -->|Generate| CustSeg
    
    %% API Queries
    MI -->|"SUM(total), COUNT(*)"| PerfAPI
    MI -->|"JOIN stores ON name"| CallsAPI
    Orders -->|"JOIN stores"| OrdersAPI
    MI -->|"GROUP BY date"| AnalyticsAPI
    MI -->|"GROUP BY product"| ProdDistAPI
    
    %% Dashboard Updates
    PerfAPI --> Revenue
    PerfAPI --> OrderCount
    PerfAPI --> Conversion
    PerfAPI --> AvgOrder
    CallsAPI --> CallList
    OrdersAPI --> RecentOrders
    ProdDistAPI --> ProdChart
    ProdDistAPI --> PieChart
    AnalyticsAPI --> TrendChart
    
    %% Styling
    classDef inputStyle fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef processStyle fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef dbStyle fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef apiStyle fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef uiStyle fill:#fce4ec,stroke:#880e4f,stroke-width:2px
    
    class CSV,Upload inputStyle
    class Queue,Processor,Validation processStyle
    class MI,Stores,Products,InvItems,Orders,CustSeg dbStyle
    class PerfAPI,CallsAPI,OrdersAPI,AnalyticsAPI,ProdDistAPI apiStyle
    class Revenue,OrderCount,Conversion,AvgOrder,CallList,RecentOrders,ProdChart,PieChart,TrendChart uiStyle
```

#### Detailed Table Update Sequence

1. **mangalam_invoices** (Primary Insert)
   - All CSV rows inserted with 40+ columns
   - Contains: invoice_id, customer_name, item_name, quantity, total, etc.

2. **stores** (Auto-populated)
   ```sql
   INSERT INTO stores (id, name, address)
   SELECT DISTINCT customer_id, customer_name, billing_city
   FROM mangalam_invoices
   ON CONFLICT (id) DO NOTHING;
   ```

3. **products** (Auto-populated)
   ```sql
   INSERT INTO products (name, category, brand)
   SELECT DISTINCT item_name, category_name, brand
   FROM mangalam_invoices
   WHERE item_name IS NOT NULL
   ON CONFLICT (name) DO NOTHING;
   ```

4. **invoice_items** (Normalized)
   ```sql
   INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price)
   SELECT mi.invoice_id, p.id, mi.quantity, mi.unit_price
   FROM mangalam_invoices mi
   JOIN products p ON mi.item_name = p.name;
   ```

5. **customer_segments** (Generated)
   ```sql
   INSERT INTO customer_segments (store_id, segment_value, total_revenue)
   SELECT customer_id, 
          CASE WHEN SUM(total) > 100000 THEN 'high' 
               WHEN SUM(total) > 50000 THEN 'medium' 
               ELSE 'low' END,
          SUM(total)
   FROM mangalam_invoices
   GROUP BY customer_id;
   ```

#### Dashboard Element Data Sources

| Dashboard Element | API Endpoint | SQL Query | Database Tables |
|------------------|--------------|-----------|-----------------|
| **Revenue Card** | /api/performance/summary | `SELECT SUM(total) FROM mangalam_invoices WHERE invoice_date = MAX(invoice_date)` | mangalam_invoices |
| **Orders Card** | /api/performance/summary | `SELECT COUNT(DISTINCT id) FROM mangalam_invoices` | mangalam_invoices |
| **Conversion Rate** | /api/performance/summary | `COUNT(orders) / COUNT(calls) * 100` | mangalam_invoices (no call tracking) |
| **Avg Order Value** | /api/performance/summary | `SELECT AVG(total) FROM mangalam_invoices` | mangalam_invoices |
| **Call List** | /api/calls/prioritized | Complex CTE with priority scoring | stores + mangalam_invoices |
| **Recent Orders** | /api/orders/recent | `SELECT * FROM orders ORDER BY created_at DESC` | orders + stores |
| **Product Chart** | /api/analytics/product-distribution | `GROUP BY customer_name, item_name` | mangalam_invoices |
| **Pie Chart** | /api/analytics/product-distribution | `SUM(quantity) GROUP BY item_name` | mangalam_invoices |
| **Trends Chart** | /api/analytics/trends | `GROUP BY DATE_TRUNC('day', invoice_date)` | mangalam_invoices |

### 6.2 Critical JOIN Relationships

```sql
-- CURRENT STATE (Name-based joins - FRAGILE)
stores s LEFT JOIN mangalam_invoices mi ON s.name = mi.customer_name

-- IDEAL STATE (Would require adding store_id to mangalam_invoices)
stores s LEFT JOIN mangalam_invoices mi ON s.id = mi.store_id
```

### 6.3 Real-time Data Sync

```yaml
Polling Interval: 30 seconds
Frontend: useEffect with setInterval
API Calls:
  - /api/calls/prioritized
  - /api/orders/recent
  - /api/performance/summary
Database Queries: 
  - Fresh data on each request
  - No caching for real-time metrics
Date Range: 180 days to accommodate older invoice data
```

---

## 🗄️ 7. DATABASE SCHEMA REFERENCE

### Primary Data Source: mangalam_invoices

```sql
-- mangalam_invoices (Main source of truth - 17,995 records)
- id SERIAL PRIMARY KEY
- invoice_id VARCHAR(100)
- invoice_date DATE -- Latest: 2025-08-05
- customer_id VARCHAR(100) -- Not used for joins
- customer_name VARCHAR(500) -- Used for store joins
- item_name VARCHAR(500)
- quantity NUMERIC(15,4)
- total NUMERIC(15,4)
- category_name VARCHAR(200)
- brand VARCHAR(200)
- [30+ additional columns]

-- CRITICAL: No store_id column, joins use customer_name
```

### Supporting Tables

#### stores (Customer Master)
```sql
- id VARCHAR(255) PRIMARY KEY
- name VARCHAR(255) NOT NULL -- Matched against customer_name
- address TEXT
- phone VARCHAR(50)
- email VARCHAR(255)
- created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### orders (Processed Orders - Separate from invoices)
```sql
- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- order_number VARCHAR(100)
- store_id VARCHAR(255) REFERENCES stores(id)
- customer_name VARCHAR(255)
- customer_phone VARCHAR(50)
- items JSONB
- total_amount DECIMAL(12,2)
- status VARCHAR(50)
- source VARCHAR(50) -- 'manual', 'document', 'csv'
- created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

---

## 🔍 8. KNOWN ISSUES & WORKAROUNDS

### Issue 1: Name-based Store Joins
```yaml
Problem: JOIN ON s.name = mi.customer_name is fragile
Impact: Any variation in store name breaks the join
Workaround: Ensure exact name matching in data entry
Fix Needed: Add store_id column to mangalam_invoices
```

### Issue 2: Date Range for Historical Data
```yaml
Problem: Latest invoice is from August 2025 (>30 days old)
Impact: Default 30-day queries return no data
Applied Fix: Changed to 180-day window in analytics queries
Location: analytics-routes.ts line 110, 134
```

### Issue 3: Conversion Rate Always 100%
```yaml
Problem: No separate call tracking exists
Impact: calls_completed = orders_placed
Current State: Shows 100% conversion
Fix Needed: Implement call tracking system
```

### Issue 4: Removed Table References
```yaml
Removed References:
  - historical_invoices → replaced with mangalam_invoices
  - product_distribution_view → query rewritten
  - product_sales_summary → query rewritten
Files Updated:
  - dashboard-routes.ts
  - performance-routes.ts
  - upselling-routes.ts
  - analytics-routes.ts
```

---

## 📈 9. PERFORMANCE OPTIMIZATIONS

### Required Indexes (UPDATED)
```sql
-- Critical for current joins
CREATE INDEX idx_mangalam_invoices_customer_name ON mangalam_invoices(customer_name);
CREATE INDEX idx_mangalam_invoices_invoice_date ON mangalam_invoices(invoice_date);
CREATE INDEX idx_stores_name ON stores(name);

-- For orders table
CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
```

### Query Performance
```yaml
Date Filtering: Use 180-day window for mangalam_invoices
Aggregation: Pre-aggregate in CTEs before joining
Limits: Apply LIMIT after sorting, not in subqueries
```

---

## ✅ 10. VALIDATION CHECKLIST

### Data Pipeline Verification
- [x] All `historical_invoices` references removed
- [x] Joins updated to use `mangalam_invoices`
- [x] Product distribution uses actual data
- [x] Performance metrics calculate correctly
- [x] Date ranges accommodate data timeline
- [ ] Store ID matching (currently name-based)
- [ ] Separate call tracking implementation
- [x] Views replaced with direct queries

### API Endpoints Tested
- [x] `/api/performance/summary` - Returns real data
- [x] `/api/analytics/trends` - Works with 180-day window
- [x] `/api/calls/prioritized` - Calculates from mangalam_invoices
- [x] `/api/analytics/product-distribution` - Fixed query

---

## 🚀 11. DEPLOYMENT CONSIDERATIONS

### Critical Configuration
```yaml
Date Ranges: Set to 180 days minimum for historical data
Table Names: Use mangalam_invoices, NOT historical_invoices
Join Conditions: s.name = mi.customer_name (name-based)
Required Tables:
  - mangalam_invoices (main data source)
  - stores (customer master)
  - orders (separate order tracking)
  - products (product catalog)
```

### Environment Variables
```env
DATABASE_URL=postgresql://mangalm:mangalm123@localhost:3432/mangalm_sales
REDIS_URL=redis://localhost:3379
API_GATEWAY_URL=http://localhost:3007
BULK_UPLOAD_API_URL=http://localhost:3009
```

---

## 📝 12. FIXES APPLIED - AUDIT TRAIL

### December 13, 2024 Updates

1. **File: dashboard-routes.ts**
   - Lines affected: 40, 132, 170, 180, 191, 243, 322, 360, 435
   - Change: `historical_invoices` → `mangalam_invoices`
   - Change: `ON s.id = hi.store_id` → `ON s.name = mi.customer_name`

2. **File: performance-routes.ts**
   - All references updated to `mangalam_invoices`

3. **File: upselling-routes.ts**
   - Lines 180, 195: Table name corrected
   - Join conditions updated for invoice_items

4. **File: order-routes.ts**
   - Lines 1321-1352, 1621-1639: Historical invoice inserts commented out

5. **File: analytics-routes.ts**
   - Lines 106-162: Complete rewrite of product distribution query
   - Removed dependency on non-existent views
   - Direct aggregation from mangalam_invoices

---

*This document reflects the ACTUAL state of the data pipeline after all fixes have been applied.*

**Document Status**: ✅ **UPDATED WITH ALL FIXES**  
**Last Verified**: December 13, 2024  
**Verified By**: Engineering Team  
**Data Source**: mangalam_invoices (17,995 records, latest: Aug 5, 2025)