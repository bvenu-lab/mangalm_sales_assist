# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Zero Tolerance Policy

When implementing features or fixing issues:
- ❌ **NO BULLSHIT** - Don't exaggerate or be lazy with completeness, quality, scores, or code
- ❌ **NO PLACEHOLDER METHODS** - Every method must be fully implemented with sophisticated algorithms
- ❌ **NO MOCK IMPLEMENTATIONS** - All functionality must be real, working code
- ❌ **NO MOCK DATA** - All data must be real, from actual sources (databases, APIs, user input)
- ❌ **NO SIMULATED RESPONSES** - All AI calls must be actual OpenAI/AI service calls
- ❌ **NO FALLBACK IMPLEMENTATIONS** - No simplified versions or temporary workarounds
- ✅ **BRUTALLY HONEST ASSESSMENTS** - All assessments, scorings, completion checks must be truly brutally honest
- ✅ **ENTERPRISE-GRADE ONLY** - Every component must meet 10/10 enterprise standards
- ✅ **PRIORITIZE CODE OVER DOCUMENTATION** - Fix issues, errors, failing tests in code first
- ✅ **REUSE EXISTING CAPABILITIES** - Organize code into reusable parts, search for similar code before creating
- ✅ **PRODUCTION-READY CODE** - All code must be deployment-ready from day one
- ✅ **SOPHISTICATED ALGORITHMS** - Complex, intelligent implementations required
- ✅ **REAL DATABASE INTEGRATION** - Real database with actual data persistence
- ✅ **ACTUAL AI SERVICE CALLS** - Use Real OpenAI/Claude API integration with proper error handling
- ✅ **COMPLETELY MODULARIZED** - Modularize files based on content into meaningful components
- ✅ **REUSE SERVICES** - Reuse existing services as much as possible
- ✅ **FIX ALL ERRORS** - Fix/debug all errors when encountered, implement sophisticated capabilities for unused vars
- ✅ **OPEN SOURCE** - Check for existing opensource libraries/SDKs before creating from scratch

## System Architecture

Mangalm Sales Assistant is a microservices-based AI-powered sales prediction system with:

### Core Services
- **API Gateway** (`services/api-gateway`) - Port 3007 - Central routing, authentication
- **AI Prediction Service** (`services/ai-prediction-service`) - Port 3001 - TensorFlow.js predictions
- **Sales Frontend** (`services/sales-frontend`) - Port 3000 - React/TypeScript dashboard
- **Bulk Upload API** (`services/bulk-upload-api`) - Port 3009 - Enterprise CSV/Excel processing
- **Document Processor** (`services/document-processor`) - Invoice/document OCR
- **Zoho Integration** (`services/zoho-integration`) - Port 3002 - CRM sync
- **PM Agent Orchestrator** (`services/pm-agent-orchestrator`) - Port 3002 - Process management

### Infrastructure
- **PostgreSQL 15** - Port 3432 (external) / 5432 (internal)
- **Redis 7** - Port 3379 (external) / 6379 (internal)
- **MinIO** - Port 9000/9001 - S3-compatible storage
- **Bull Board** - Port 3100 - Queue monitoring
- **PgAdmin** - Port 5050 - Database management
- **Redis Commander** - Port 8081 - Redis monitoring

## Essential Commands

### Enterprise-Grade System Management (Windows)

#### Startup Commands
```bash
# Start entire system with Docker infrastructure
start-enterprise.bat

# Start with COMPLETELY CLEAN DATABASE (deletes ALL data)
start-enterprise.bat --clean
# OR
start-enterprise-clean.bat

# Production-ready startup with health checks
RELIABLE_STARTUP.bat
```

#### Shutdown Commands
```bash
# Graceful shutdown with port cleanup
stop-enterprise.bat

# Stop and remove Docker volumes + old logs
stop-enterprise.bat --clean

# Silent mode (no pause at end)
stop-enterprise.bat --silent

# Stop all services with force cleanup
stop-all.bat
```

#### Enterprise Features
- **Port Cleanup**: Automatically checks and kills processes on ports 3000, 3007, 3009, 3432, 3379
- **Database Reset**: `clear-all-tables.sql` clears ALL 18 tables with proper foreign key handling
- **Process Management**: Graceful termination with 3-second grace period, then force kill
- **Orphaned Process Detection**: Identifies and terminates Node.js processes holding ports
- **Docker Volume Management**: Optional complete volume removal with --clean flag
- **Temporary File Cleanup**: Removes uploads, temp CSVs, processing files
- **Log Rotation**: Cleans logs older than 7 days with --clean flag

#### Build Verification
```bash
# Verify all services build correctly
build-all.bat
```

### Development Commands
```bash
# Install all dependencies
npm run install:all

# Build all services
npm run build:all

# Run tests
npm test                    # All tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests
npm run test:e2e          # End-to-end tests
npm run test:coverage     # With coverage report

# Individual service development
cd services/[service-name]
npm run dev               # Development mode with hot reload
npm run build            # Production build
npm start                # Production start
npm test                 # Service-specific tests
```

### Docker Operations
```bash
# Start infrastructure
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down

# Enterprise stack
docker-compose -f docker-compose.enterprise.yml up -d
```

### Database Operations
```bash
# Access PostgreSQL
docker exec -it mangalm-postgres psql -U mangalm -d mangalm_sales

# Run migrations
npm run db:migrate

# Seed test data
npm run db:seed

# Database initialization scripts location
database/init/*.sql
```

### PM2 Process Management
```bash
# Start all services
pm2 start ecosystem.config.js

# View status
pm2 status

# View logs
pm2 logs

# Reload with zero downtime
pm2 reload ecosystem.config.js

# Stop all
pm2 stop ecosystem.config.js
```

## Service Communication

Services communicate via:
- **HTTP/REST APIs** - Primary communication
- **WebSockets** - Real-time features (sales-frontend)
- **Redis Pub/Sub** - Event messaging
- **Bull Queues** - Background job processing
- **PostgreSQL** - Shared data persistence

## Database Schema

### Tables (18 total) organized by domain:
- **Core**: `stores`, `products`, `mangalam_invoices`, `orders`, `invoice_items`
- **AI/Predictions**: `predicted_orders`, `predicted_order_items`, `sales_forecasts`, `model_performance`, `order_patterns`
- **Customer**: `customer_segments`, `store_preferences`, `call_prioritization`
- **Analytics**: `upselling_recommendations`, `product_associations`
- **System**: `user_actions`, `dashboard_settings`, `realtime_sync_queue`
- **Upload**: `bulk_uploads`, `upload_validations`, `processing_status`

### Database Management
- **Migration files**: `database/init/*.sql` (executed in alphabetical order)
- **Complete reset**: `database/init/clear-all-tables.sql` - Clears ALL data with proper FK handling
- **Sequences reset**: Automatically resets ID sequences after clearing
- **Vacuum**: Runs VACUUM ANALYZE after clearing to reclaim space

## Testing Strategy

Jest configuration with test suites:
- **Unit Tests**: `test/unit/**/*.test.js`
- **Integration Tests**: `test/integration/**/*.test.js`
- **E2E Tests**: `test/e2e/**/*.test.js`
- **Performance Tests**: `test/performance/**/*.test.js`

Coverage thresholds: 70-80% across branches, functions, lines, statements

## Environment Configuration

Key environment files:
- `.env` - Development configuration
- `.env.enterprise` - Production/enterprise settings
- `.env.example` - Template with all required variables

Critical variables:
```env
DATABASE_URL=postgresql://mangalm:mangalm123@localhost:3432/mangalm_sales
REDIS_URL=redis://localhost:3379
API_GATEWAY_URL=http://localhost:3007
BULK_UPLOAD_API_URL=http://localhost:3009
NODE_ENV=development|production
```

## Service-Specific Notes

### API Gateway
- Central authentication removed (recent cleanup)
- Routes: `/api/stores`, `/api/products`, `/api/orders`, `/api/upload`
- Middleware: audit logging, CORS, rate limiting

### Bulk Upload API
- Main server: `server-enterprise-v2.js`
- Supports CSV, Excel, JSON formats
- Queue-based processing with Bull
- Validation pipeline with detailed error reporting

### Sales Frontend
- React 18 with TypeScript
- Material-UI components
- NoAuthApp.tsx - Simplified entry point without authentication
- API clients in `src/services/`

### AI Prediction Service
- TensorFlow.js models
- Simple server: `simple-server.ts`
- 1-3 month sales forecasting
- Confidence scoring system

## Common Development Tasks

### Adding a New Service
1. Create service directory under `services/`
2. Initialize with `npm init` and TypeScript config
3. Add to `docker-compose.yml` if containerized
4. Update `ecosystem.config.js` for PM2
5. Add to startup scripts (`start-enterprise.bat`)
6. Add port to cleanup scripts (`stop-enterprise.bat`)

### Debugging Failed Startup
1. Check logs directory: `logs/*.log`
2. Verify port availability: `netstat -ano | findstr :[PORT]`
3. Check Docker status: `docker ps`
4. Database connection: `docker exec mangalm-postgres pg_isready -U mangalm`
5. Redis connection: `docker exec mangalm-redis redis-cli ping`
6. Force cleanup all Node processes: 
   ```cmd
   for /f "tokens=5" %a in ('netstat -ano ^| findstr ":3007 :3009 :3001"') do taskkill /PID %a /F
   ```

### Handling Build Errors
```bash
# Clean and rebuild
cd services/[service-name]
rm -rf node_modules dist
npm install
npm run build

# For TypeScript issues
npx tsc --noEmit  # Type check without building
```

### Complete System Reset
```bash
# Stop everything and clear all data
stop-enterprise.bat --clean

# Start with completely fresh database
start-enterprise.bat --clean
```

## Recent Architecture Changes

Based on git status, authentication system has been removed:
- Deleted auth-related files across services
- Simplified to NoAuthApp.tsx in frontend
- Focus on core business functionality
- Enterprise upload system implementation complete

## Performance Considerations

- PostgreSQL with connection pooling (pg library)
- Redis for session/cache management
- Bull queues for async processing
- PM2 for process management and auto-restart
- Docker resource limits configured

## Deployment

### Windows Production Deployment
- **Startup**: `start-enterprise.bat` with health checks and error handling
- **Shutdown**: `stop-enterprise.bat` with graceful termination
- **Process Management**: PM2 via `ecosystem.config.js`
- **Infrastructure**: Docker Compose for PostgreSQL, Redis, monitoring tools
- **Port Management**: Automatic cleanup of orphaned processes
- **Data Reset**: Enterprise-grade database clearing with FK handling

### Cloud Run Deployment
- Buildpacks configuration supported
- Environment variables via Secret Manager
- PostgreSQL via Cloud SQL

## Critical Enterprise Requirements

### Startup Script Requirements
- **Health Checks**: Must verify all services are responsive
- **Port Cleanup**: Must kill orphaned processes before starting
- **Error Handling**: Must exit with proper error codes on failure
- **Logging**: Must log to `logs/` directory with timestamps
- **Database Init**: Must run migrations in correct order
- **Grace Period**: 3-second grace for graceful shutdown

### Data Management Requirements
- **Complete Reset Option**: `--clean` flag must clear ALL data
- **Foreign Key Handling**: Must disable FK checks during deletion
- **Sequence Reset**: Must reset all ID sequences after clearing
- **Vacuum**: Must reclaim space after bulk deletions
- **Verification**: Must verify all tables are empty after reset

### Port Management
- **Required Ports**: 3000, 3007, 3009 (apps), 3432, 3379 (infrastructure)
- **Conflict Resolution**: Must detect and resolve port conflicts
- **Process Identification**: Must identify Node.js vs other processes
- **Force Cleanup**: Must provide force kill option for stuck processes