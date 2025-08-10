# Mangalm Sales Assistant - Phase 1 MVP

An AI-powered sales prediction and order management system designed to optimize sales operations for retail stores.

## 🎯 Overview

The Mangalm Sales Assistant uses machine learning to predict future orders, prioritize sales calls, and track agent performance. It integrates with Zoho CRM for data synchronization and provides a comprehensive dashboard for sales teams.

## 🚀 Key Features

### Phase 1 Deliverables

1. **AI-Powered Order Prediction**
   - TensorFlow.js-based prediction model
   - 1-3 month forecasting horizon
   - Product-level predictions with confidence scores
   - Historical pattern analysis

2. **Store Management**
   - Complete store database with contact information
   - Store categorization by size and region
   - Call frequency optimization

3. **Call Prioritization**
   - Automated ranking based on predicted order likelihood
   - Agent assignment optimization
   - Performance tracking

4. **Zoho CRM Integration**
   - Bi-directional data synchronization
   - Automated invoice and product imports
   - Real-time updates

5. **Sales Dashboard**
   - React-based modern UI with Material-UI
   - Real-time predictions and analytics
   - Order creation and management
   - Performance metrics

6. **Data Import System**
   - CSV invoice data processing
   - Database normalization
   - Training data generation

## 📚 Documentation

**📖 Complete documentation is available in the [`docs/`](./docs/) directory:**

- **🚀 [Quick Start Guide](./docs/QUICK_START_GUIDE.md)** - 30-minute setup guide
- **👤 [User Manual](./docs/USER_MANUAL.md)** - Complete user guide  
- **👨‍💻 [Developer Guide](./docs/DEVELOPER_GUIDE.md)** - Development setup and standards
- **🔌 [API Documentation](./docs/API_DOCUMENTATION.md)** - Complete API reference
- **🏗️ [Architecture Guide](./docs/ARCHITECTURE.md)** - System architecture
- **🔧 [Deployment Guide](./docs/DEPLOYMENT_GUIDE_WINDOWS.md)** - Windows deployment
- **📊 [Monitoring Guide](./docs/MONITORING_GUIDE.md)** - Monitoring and observability
- **🆘 [Troubleshooting Guide](./docs/TROUBLESHOOTING_GUIDE.md)** - Problem resolution

**👉 [View All Documentation](./docs/README.md)**

## 📁 Project Structure

```
mangalm/
├── database/               # Database models and migrations
│   ├── models/            # TypeScript data models
│   └── migrations/        # SQL migration scripts
├── services/
│   ├── ai-prediction-service/    # TensorFlow prediction engine
│   ├── zoho-integration/         # Zoho CRM sync service
│   ├── sales-frontend/           # React dashboard
│   └── data-import/              # CSV import utilities
├── scripts/               # Utility scripts
├── docker-compose.yml     # Docker orchestration
└── package.json          # Root package configuration
```

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Material-UI
- **Backend**: Node.js, Express, TypeScript
- **AI/ML**: TensorFlow.js
- **Database**: PostgreSQL
- **Cache**: Redis
- **Integration**: Zoho CRM API
- **Containerization**: Docker

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL >= 14
- Docker & Docker Compose (optional)
- Zoho CRM Account (for integration)

## 🔧 Installation

### 1. Clone and Setup

```bash
cd mangalm
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Install Dependencies

```bash
npm run install:all
```

### 4. Database Setup

```bash
# Create database
createdb mangalm_sales

# Run migrations
npm run db:migrate
```

### 5. Import Invoice Data

```bash
# Import CSV to JSON
npm run import:csv

# Import to database
npm run import:db
```

### 6. Build Services

```bash
npm run build:all
```

## 🚀 Running the Application

### Development Mode

```bash
# Start all services
npm run start:all

# Or start individually:
npm run start:ai      # AI Prediction Service (port 3001)
npm run start:frontend # Sales Dashboard (port 3000)
npm run start:zoho    # Zoho Integration (port 3002)
```

### Production Mode (Docker)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📊 Accessing the Application

- **Sales Dashboard**: http://localhost:3000
- **AI Prediction API**: http://localhost:3001
- **Zoho Integration API**: http://localhost:3002

### Default Login Credentials

```
Username: admin@mangalm.com
Password: admin123
```

## 🧪 Testing

### Run All Tests

```bash
npm run test:all
```

### Validate Setup

```bash
npm run validate
```

This will check:
- Environment requirements
- Directory structure
- Service configurations
- Database connectivity
- Data file availability

## 📈 API Endpoints

### AI Prediction Service

- `GET /health` - Health check
- `GET /predictions` - Get all predictions
- `POST /predictions/generate` - Generate predictions for stores
- `GET /predictions/:storeId` - Get predictions for specific store
- `POST /predictions/:id/feedback` - Submit prediction feedback
- `GET /accuracy-metrics` - Get model accuracy metrics

### Zoho Integration

- `GET /health` - Health check
- `POST /sync/all` - Sync all data from Zoho
- `POST /sync/stores` - Sync stores
- `POST /sync/products` - Sync products
- `POST /sync/invoices` - Sync invoices

## 📊 Data Processing

### Invoice CSV Format

The system processes invoice data with the following structure:
- Invoice details (date, ID, status)
- Customer/Store information
- Product details (SKU, brand, category)
- Pricing and discount information
- Quantity and totals

### AI Model Training

The prediction model uses:
- 3-month historical lookback
- Store characteristics
- Product purchase frequencies
- Seasonal patterns
- Order value trends

## 🔒 Security Features

- JWT authentication
- Role-based access control
- Rate limiting
- CORS protection
- Environment variable isolation
- SQL injection prevention

## 📝 Configuration

### Environment Variables

Key configuration options in `.env`:

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/mangalm_sales

# Zoho CRM
ZOHO_CLIENT_ID=your_client_id
ZOHO_CLIENT_SECRET=your_secret
ZOHO_REFRESH_TOKEN=your_token

# AI Service
AI_PREDICTION_CONFIDENCE_THRESHOLD=0.7
AI_TRAINING_BATCH_SIZE=32

# Frontend
REACT_APP_API_URL=http://localhost:3001
```

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check PostgreSQL status
   pg_isready
   # Ensure database exists
   psql -U postgres -c "CREATE DATABASE mangalm_sales;"
   ```

2. **Build Errors**
   ```bash
   # Clean and reinstall
   npm run clean
   npm run install:all
   npm run build:all
   ```

3. **Port Already in Use**
   ```bash
   # Find and kill process
   lsof -i :3000
   kill -9 <PID>
   ```

4. **CSV Import Issues**
   - Ensure CSV file exists at configured path
   - Check file encoding (UTF-8 required)
   - Verify column headers match expected format

## 📊 Performance Metrics

- **CSV Processing**: ~1,000 rows/second
- **Database Import**: ~100 invoices/second
- **Prediction Generation**: <100ms per store
- **Frontend Load Time**: <2 seconds
- **API Response Time**: <200ms average

## 🔄 Development Workflow

1. **Feature Development**
   ```bash
   git checkout -b feature/new-feature
   # Make changes
   npm run test:all
   npm run validate
   git commit -m "Add new feature"
   ```

2. **Database Changes**
   ```bash
   # Create migration
   npm run db:migration:create -- --name=add_new_table
   # Run migration
   npm run db:migrate
   ```

3. **Model Training**
   ```bash
   # Retrain AI model with new data
   cd services/ai-prediction-service
   npm run train:model
   ```

## 📚 Documentation

- [Database Schema](./database/README.md)
- [AI Prediction Service](./services/ai-prediction-service/README.md)
- [Zoho Integration](./services/zoho-integration/README.md)
- [Data Import Guide](./services/data-import/README.md)

## 🤝 Support

For issues or questions:
- Check the troubleshooting guide above
- Review service-specific README files
- Contact the development team

## 📄 License

Proprietary - Mangalm LLC

---

**Version**: 1.0.0 (Phase 1 MVP)
**Last Updated**: December 2024