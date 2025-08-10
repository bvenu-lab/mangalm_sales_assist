# Mangalm Database

This directory contains the database models, migrations, and seeds for the Mangalm Sales-Assist MVP.

## Directory Structure

```
database/
├── models/             # TypeScript models for database entities
├── migrations/         # Database migration files
│   ├── sales/          # Sales-related migrations
│   └── invoices/       # Invoice-related migrations
├── seeds/              # Database seed data
├── package.json        # Package configuration
└── tsconfig.json       # TypeScript configuration
```

## Models

The following models are defined in the `models/` directory:

- **Store**: Represents a retail store in the Mangalm Sales-Assist system
- **Product**: Represents a product in the Mangalm Sales-Assist system
- **HistoricalInvoice**: Represents a past invoice in the Mangalm Sales-Assist system
- **InvoiceItem**: Represents an item in a historical invoice
- **PredictedOrder**: Represents a predicted order in the Mangalm Sales-Assist system
- **PredictedOrderItem**: Represents an item in a predicted order
- **CallPrioritization**: Represents a prioritized call in the Mangalm Sales-Assist system
- **SalesAgentPerformance**: Represents a sales agent's performance

## Usage

### Importing Models

```typescript
// Import all models
import * as Models from './models';

// Import specific models
import { Store, Product } from './models';
```

### Using Models

```typescript
// Create a new store
const store: Models.CreateStoreDto = {
  name: 'Store Name',
  address: '123 Main St',
  city: 'New York',
  region: 'NY',
  store_size: 'Medium',
  call_frequency: 'Weekly'
};

// Update a store
const storeUpdate: Models.UpdateStoreDto = {
  name: 'Updated Store Name',
  call_frequency: 'Monthly'
};
```

## Database Schema

The database schema is defined in the migration files in the `migrations/` directory. The schema includes the following tables:

- **stores**: Stores with contact information and call frequency
- **products**: Products with categories, pricing, and inventory information
- **historical_invoices**: Past invoices with store information
- **invoice_items**: Items in historical invoices
- **predicted_orders**: Predicted orders with confidence scores
- **predicted_order_items**: Items in predicted orders with suggested quantities
- **call_prioritization**: Prioritized calls with assigned agents
- **sales_agent_performance**: Sales agent performance metrics

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
