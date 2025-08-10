# Mangalm Invoice Data Import

This module provides utilities to import invoice data from CSV files into the Mangalm Sales Assistant database for AI-powered sales predictions.

## Overview

The import process handles the invoice data from `Invoices_Mangalam.csv` which contains:
- **41,000+ invoice records** from various stores
- Product details including SKU, brand, category
- Pricing information and discounts
- Customer/store information

## Features

1. **CSV Parser**: Reads and processes the invoice CSV file
2. **Data Transformation**: Converts raw CSV data into normalized database structure
3. **Database Import**: Loads data into PostgreSQL tables
4. **Analytics Generation**: Creates summary statistics and insights
5. **AI Training Data**: Prepares data for the TensorFlow prediction model

## Installation

```bash
cd mangalm/services/data-import
npm install
```

## Usage

### 1. Import CSV and Generate JSON Files

```bash
npm run import:csv
```

This will:
- Parse the CSV file
- Generate summary statistics
- Export JSON files to `./output/` directory:
  - `stores.json` - Store/customer data
  - `products.json` - Product catalog
  - `invoices.json` - Invoice headers
  - `invoice_items.json` - Line items

### 2. Import to Database

Set up your database connection:

```bash
# Create .env file
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mangalm_sales
DB_USER=postgres
DB_PASSWORD=your_password
```

Then run:

```bash
npm run import:db
```

This will:
- Create necessary tables if they don't exist
- Import stores, products, invoices, and line items
- Generate analytics and summary reports

## Database Schema

### Tables Created

1. **stores**
   - `id`: Store/Customer ID
   - `name`: Store name
   - `city`: Billing city
   - `state`: Billing state

2. **products**
   - `id`: Product ID
   - `name`: Product name
   - `brand`: Brand name
   - `category`: Product category

3. **historical_invoices**
   - `id`: Invoice ID
   - `store_id`: Reference to stores table
   - `invoice_date`: Date of invoice
   - `total_amount`: Total invoice amount
   - `payment_status`: Invoice status (Closed, Open, etc.)
   - `notes`: Invoice number

4. **invoice_items**
   - `id`: Unique item ID
   - `invoice_id`: Reference to historical_invoices
   - `product_id`: Reference to products
   - `quantity`: Quantity ordered
   - `unit_price`: Price per unit
   - `discount`: Discount amount
   - `total_price`: Line total

## Integration with AI Prediction Service

After importing the data, the AI Prediction Service can:

1. **Train Models**: Use historical invoice data to train TensorFlow models
2. **Generate Predictions**: Forecast future orders for each store
3. **Identify Patterns**: Analyze product purchase frequencies and seasonal trends
4. **Prioritize Calls**: Rank stores by predicted order likelihood

## Sample Data Summary

From the provided CSV file:
- **Date Range**: July 2023 - Present
- **Primary Customer**: India Sweet and Spices Portland
- **Product Categories**: Dry goods, snacks, spices
- **Brands**: Bikano and others
- **Average Order Value**: Calculated during import

## Next Steps

After importing the data:

1. **Run AI Training**:
   ```bash
   cd ../ai-prediction-service
   npm run train:model
   ```

2. **Generate Predictions**:
   ```bash
   npm run predict:batch
   ```

3. **View in Dashboard**:
   Access the sales frontend at `http://localhost:3000` to view:
   - Store predictions
   - Call prioritization
   - Historical trends
   - Product recommendations

## Troubleshooting

### Common Issues

1. **CSV File Not Found**: Ensure the CSV file exists at:
   ```
   C:\code\Dynamo\dynamo_data\database\microservice_migration\docs\user_journey\Invoices_Mangalam .csv
   ```

2. **Database Connection Failed**: Check your PostgreSQL credentials and ensure the database exists

3. **Memory Issues**: For large CSV files, you may need to increase Node.js memory:
   ```bash
   node --max-old-space-size=4096 import-invoices-csv.ts
   ```

## Performance

The importer processes:
- ~1,000 rows per second during CSV parsing
- ~100 invoices per second during database import
- Generates analytics in real-time

## License

Proprietary - Mangalm LLC