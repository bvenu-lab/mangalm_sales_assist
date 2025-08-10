# Mangalm Developer Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Development Environment Setup](#development-environment-setup)
3. [Architecture Overview](#architecture-overview)
4. [Code Structure](#code-structure)
5. [Development Workflow](#development-workflow)
6. [Coding Standards](#coding-standards)
7. [Testing Guidelines](#testing-guidelines)
8. [Debugging](#debugging)
9. [Contributing](#contributing)
10. [Advanced Topics](#advanced-topics)

## Getting Started

Welcome to the Mangalm Sales Assistant development team! This guide will help you set up your development environment and understand the codebase.

### Prerequisites

- **Node.js**: Version 16.x or higher
- **PostgreSQL**: Version 13.x or higher
- **Git**: Version 2.x or higher
- **VS Code**: Recommended IDE with extensions
- **Docker**: Optional but recommended
- **Windows 10/11**: For Windows development

### Quick Start

```bash
# Clone the repository
git clone https://github.com/mangalm/sales-assistant.git
cd mangalm

# Install dependencies
npm install
cd services/shared && npm install && npm run build && cd ../..

# Set up environment
copy .env.example .env
# Edit .env with your configuration

# Set up database
cd scripts/windows
setup-database.bat
run-migrations.bat

# Install service dependencies
install-dependencies.bat

# Start development servers
start-all.bat

# Access the application
# Frontend: http://localhost:3000
# API: http://localhost:3007
```

## Development Environment Setup

### 1. IDE Configuration

#### VS Code Extensions
Install these recommended extensions:
- ESLint
- Prettier
- TypeScript and JavaScript
- GitLens
- Docker
- Thunder Client (API testing)
- Jest Runner
- Code Spell Checker

#### VS Code Settings
`.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "editor.tabSize": 2,
  "files.eol": "\n"
}
```

### 2. Environment Configuration

#### Development Environment Variables
```env
# Application
NODE_ENV=development
PORT=3007
LOG_LEVEL=debug

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mangalm_sales_dev
DB_USER=mangalm_dev
DB_PASSWORD=dev_password_2024

# Authentication
JWT_SECRET=dev-secret-key-change-in-production
JWT_EXPIRES_IN=1d
REFRESH_TOKEN_EXPIRES_IN=7d

# Services
AI_SERVICE_URL=http://localhost:3001
PM_SERVICE_URL=http://localhost:3002
ZOHO_SERVICE_URL=http://localhost:3003

# Monitoring (Development)
ENABLE_METRICS=true
ENABLE_TRACING=true
ENABLE_CONSOLE_TRACING=true

# External Services
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
```

### 3. Database Setup

#### Create Development Database
```sql
-- Connect as postgres user
CREATE DATABASE mangalm_sales_dev;
CREATE USER mangalm_dev WITH PASSWORD 'dev_password_2024';
GRANT ALL PRIVILEGES ON DATABASE mangalm_sales_dev TO mangalm_dev;

-- Enable extensions
\c mangalm_sales_dev
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
```

#### Run Migrations
```bash
cd database
npm run migrate:dev
npm run seed:dev  # Optional: Load sample data
```

### 4. Local Services Setup

#### Start Redis (Optional)
```bash
# Windows (using WSL or Docker)
docker run -d -p 6379:6379 redis:alpine

# Or download Redis for Windows
# https://github.com/microsoftarchive/redis/releases
```

#### Start RabbitMQ (Optional)
```bash
docker run -d -p 5672:5672 -p 15672:15672 rabbitmq:3-management
# Management UI: http://localhost:15672 (guest/guest)
```

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                      │
│                     http://localhost:3000                     │
└────────────────────────────┬───────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (Express)                      │
│                     http://localhost:3007                     │
└─────┬──────────────┬──────────────┬──────────────┬──────────┘
      │              │              │              │
      ▼              ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│    AI    │  │    PM    │  │   Zoho   │  │  Shared  │
│ Service  │  │  Agent   │  │  Integ   │  │   Libs   │
│  :3001   │  │  :3002   │  │  :3003   │  │          │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
      │              │              │              │
      └──────────────┴──────────────┴──────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │      :5432      │
                    └─────────────────┘
```

### Service Responsibilities

| Service | Port | Responsibility |
|---------|------|----------------|
| Frontend | 3000 | React UI, user interactions |
| API Gateway | 3007 | Request routing, authentication, rate limiting |
| AI Service | 3001 | ML predictions, model management |
| PM Agent | 3002 | Agent orchestration, task management |
| Zoho Integration | 3003 | CRM sync, data mapping |

## Code Structure

### Repository Layout

```
mangalm/
├── database/                 # Database layer
│   ├── migrations/          # TypeORM migrations
│   ├── models/             # Data models
│   └── seeds/              # Seed data
├── services/
│   ├── api-gateway/        # API Gateway service
│   │   ├── src/
│   │   │   ├── controllers/   # Request handlers
│   │   │   ├── middleware/    # Express middleware
│   │   │   ├── routes/        # Route definitions
│   │   │   ├── services/      # Business logic
│   │   │   └── utils/         # Utilities
│   │   └── tests/            # Unit tests
│   ├── ai-prediction-service/
│   │   ├── src/
│   │   │   ├── ml/           # ML models
│   │   │   ├── services/     # Prediction logic
│   │   │   └── utils/        # ML utilities
│   │   └── tests/
│   ├── pm-agent-orchestrator/
│   │   ├── src/
│   │   │   ├── agents/       # Agent implementations
│   │   │   ├── orchestrator/ # Orchestration logic
│   │   │   └── tasks/        # Task definitions
│   │   └── tests/
│   ├── sales-frontend/
│   │   ├── src/
│   │   │   ├── components/   # React components
│   │   │   ├── pages/        # Page components
│   │   │   ├── services/     # API clients
│   │   │   ├── store/        # State management
│   │   │   └── utils/        # Frontend utilities
│   │   └── tests/
│   ├── shared/              # Shared libraries
│   │   ├── src/
│   │   │   ├── monitoring/   # Monitoring utilities
│   │   │   ├── auth/         # Auth utilities
│   │   │   └── utils/        # Common utilities
│   │   └── tests/
│   └── zoho-integration/
│       ├── src/
│       │   ├── client/       # Zoho API client
│       │   ├── mappers/      # Data mappers
│       │   └── sync/         # Sync logic
│       └── tests/
├── monitoring/              # Monitoring configuration
├── scripts/                # Utility scripts
│   └── windows/           # Windows batch scripts
├── docs/                   # Documentation
└── tests/                  # E2E tests
    ├── cypress/           # Cypress tests
    └── k6/               # Load tests
```

### Key Files

| File | Purpose |
|------|---------|
| `.env` | Environment configuration |
| `ecosystem.config.js` | PM2 configuration |
| `docker-compose.yml` | Docker services |
| `package.json` | Root dependencies |
| `tsconfig.json` | TypeScript configuration |

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes
# ... edit files ...

# Run tests
npm test

# Lint and format
npm run lint
npm run format

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push branch
git push origin feature/your-feature-name

# Create pull request
```

### 2. Branch Strategy

| Branch | Purpose | Deployment |
|--------|---------|------------|
| `main` | Production code | Production |
| `develop` | Development integration | Staging |
| `feature/*` | New features | Development |
| `bugfix/*` | Bug fixes | Development |
| `hotfix/*` | Production fixes | Production |

### 3. Commit Convention

Follow Conventional Commits:
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

Examples:
```bash
git commit -m "feat(api): add store filtering endpoint"
git commit -m "fix(frontend): resolve navigation issue"
git commit -m "docs: update API documentation"
```

## Coding Standards

### TypeScript Guidelines

#### 1. Type Safety
```typescript
// ✅ Good: Explicit types
interface Store {
  id: string;
  name: string;
  revenue: number;
}

function calculateRevenue(stores: Store[]): number {
  return stores.reduce((sum, store) => sum + store.revenue, 0);
}

// ❌ Bad: Using any
function processData(data: any): any {
  return data.value;
}
```

#### 2. Async/Await
```typescript
// ✅ Good: Async/await with error handling
async function fetchStore(id: string): Promise<Store> {
  try {
    const response = await api.get(`/stores/${id}`);
    return response.data;
  } catch (error) {
    logger.error('Failed to fetch store', { id, error });
    throw new StoreNotFoundError(id);
  }
}

// ❌ Bad: Callback hell
function fetchStore(id: string, callback: Function) {
  api.get(`/stores/${id}`, (err, data) => {
    if (err) callback(err);
    else callback(null, data);
  });
}
```

#### 3. Error Handling
```typescript
// ✅ Good: Custom error classes
class ValidationError extends Error {
  constructor(
    public field: string,
    public value: any,
    message: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Use structured error handling
try {
  await validateOrder(order);
} catch (error) {
  if (error instanceof ValidationError) {
    return res.status(400).json({
      error: 'Validation failed',
      field: error.field,
      message: error.message
    });
  }
  throw error;
}
```

### React Guidelines

#### 1. Component Structure
```typescript
// ✅ Good: Functional component with hooks
interface StoreListProps {
  storeIds: string[];
  onSelect: (id: string) => void;
}

const StoreList: React.FC<StoreListProps> = ({ storeIds, onSelect }) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStores(storeIds).then(setStores).finally(() => setLoading(false));
  }, [storeIds]);

  if (loading) return <Spinner />;
  
  return (
    <List>
      {stores.map(store => (
        <ListItem key={store.id} onClick={() => onSelect(store.id)}>
          {store.name}
        </ListItem>
      ))}
    </List>
  );
};
```

#### 2. State Management
```typescript
// ✅ Good: Use appropriate state management
// Local state for component-specific data
const [isOpen, setIsOpen] = useState(false);

// Context for cross-component state
const ThemeContext = createContext<Theme>('light');

// Redux for global application state
const dispatch = useAppDispatch();
dispatch(fetchStores());
```

### API Design

#### 1. RESTful Endpoints
```typescript
// ✅ Good: RESTful design
router.get('/stores', getStores);           // List
router.get('/stores/:id', getStore);        // Get
router.post('/stores', createStore);        // Create
router.put('/stores/:id', updateStore);     // Update
router.delete('/stores/:id', deleteStore);  // Delete

// ❌ Bad: Non-RESTful
router.get('/getStoreData', getStore);
router.post('/updateStoreInfo', updateStore);
```

#### 2. Response Format
```typescript
// ✅ Good: Consistent response format
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    pagination?: PaginationMeta;
  };
}

res.json({
  success: true,
  data: stores,
  meta: {
    timestamp: new Date().toISOString(),
    requestId: req.id,
    pagination: {
      page: 1,
      limit: 20,
      total: 100
    }
  }
});
```

## Testing Guidelines

### 1. Unit Testing

```typescript
// stores.service.test.ts
import { StoreService } from './stores.service';
import { mockDatabase } from '../test-utils';

describe('StoreService', () => {
  let service: StoreService;
  let db: MockDatabase;

  beforeEach(() => {
    db = mockDatabase();
    service = new StoreService(db);
  });

  describe('getStore', () => {
    it('should return store by id', async () => {
      const mockStore = { id: '1', name: 'Test Store' };
      db.stores.findOne.mockResolvedValue(mockStore);

      const result = await service.getStore('1');

      expect(result).toEqual(mockStore);
      expect(db.stores.findOne).toHaveBeenCalledWith({ id: '1' });
    });

    it('should throw error for non-existent store', async () => {
      db.stores.findOne.mockResolvedValue(null);

      await expect(service.getStore('999')).rejects.toThrow('Store not found');
    });
  });
});
```

### 2. Integration Testing

```typescript
// api.integration.test.ts
import request from 'supertest';
import { app } from '../app';
import { setupTestDatabase, cleanupTestDatabase } from '../test-utils';

describe('Stores API Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('POST /api/v1/stores', () => {
    it('should create a new store', async () => {
      const storeData = {
        name: 'New Store',
        city: 'Bangalore'
      };

      const response = await request(app)
        .post('/api/v1/stores')
        .set('Authorization', `Bearer ${testToken}`)
        .send(storeData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject(storeData);
      expect(response.body.data.id).toBeDefined();
    });
  });
});
```

### 3. E2E Testing

```typescript
// cypress/e2e/store-management.cy.ts
describe('Store Management', () => {
  beforeEach(() => {
    cy.login('admin', 'admin123');
    cy.visit('/stores');
  });

  it('should create a new store', () => {
    cy.contains('Add Store').click();
    
    cy.get('[data-testid="store-name"]').type('Test Store');
    cy.get('[data-testid="store-city"]').type('Mumbai');
    cy.get('[data-testid="store-phone"]').type('+91-9876543210');
    
    cy.contains('Save').click();
    
    cy.contains('Store created successfully').should('be.visible');
    cy.contains('Test Store').should('be.visible');
  });
});
```

## Debugging

### 1. VS Code Debugging

`.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API Gateway",
      "program": "${workspaceFolder}/services/api-gateway/src/index.ts",
      "preLaunchTask": "tsc: build",
      "outFiles": ["${workspaceFolder}/services/api-gateway/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "mangalm:*"
      }
    },
    {
      "type": "chrome",
      "request": "launch",
      "name": "Debug Frontend",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/services/sales-frontend/src"
    }
  ]
}
```

### 2. Logging

```typescript
import { logger } from '@mangalm/shared/monitoring';

// Structured logging
logger.info('Processing order', {
  orderId: order.id,
  storeId: order.storeId,
  items: order.items.length
});

// Debug logging
logger.debug('Database query', {
  query: sql,
  params,
  duration: Date.now() - startTime
});

// Error logging
logger.error('Order processing failed', {
  orderId: order.id,
  error: error.message,
  stack: error.stack
});
```

### 3. Performance Profiling

```typescript
import { PerformanceMonitor } from '@mangalm/shared/monitoring';

const monitor = new PerformanceMonitor('store-service');

// Profile function execution
const result = await monitor.measureAsync(
  'fetchStores',
  () => database.stores.findAll(),
  { userId, filters }
);

// Get performance stats
const stats = monitor.getStats('fetchStores');
console.log(`Average duration: ${stats.mean}ms, P95: ${stats.p95}ms`);
```

## Contributing

### 1. Code Review Checklist

Before submitting a PR, ensure:
- [ ] All tests pass (`npm test`)
- [ ] Code is linted (`npm run lint`)
- [ ] Documentation is updated
- [ ] No console.log statements
- [ ] Error handling is implemented
- [ ] Performance impact considered
- [ ] Security implications reviewed
- [ ] Accessibility standards met (frontend)

### 2. Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
```

## Advanced Topics

### 1. Performance Optimization

#### Database Queries
```typescript
// ✅ Good: Optimized query with indexes
const stores = await db.query(`
  SELECT s.*, COUNT(o.id) as order_count
  FROM stores s
  LEFT JOIN orders o ON s.id = o.store_id
  WHERE s.city = $1
    AND s.active = true
  GROUP BY s.id
  ORDER BY s.created_at DESC
  LIMIT 20
`, [city]);

// Create appropriate indexes
CREATE INDEX idx_stores_city ON stores(city);
CREATE INDEX idx_orders_store_id ON orders(store_id);
```

#### Caching Strategy
```typescript
import { redis } from '@mangalm/shared/cache';

async function getStoreWithCache(id: string): Promise<Store> {
  const cacheKey = `store:${id}`;
  
  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Fetch from database
  const store = await database.stores.findOne({ id });
  
  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(store));
  
  return store;
}
```

### 2. Security Best Practices

#### Input Validation
```typescript
import { body, validationResult } from 'express-validator';

const validateStore = [
  body('name').isLength({ min: 3, max: 100 }).trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('phone').isMobilePhone('en-IN'),
  body('pincode').isPostalCode('IN'),
  
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];
```

#### SQL Injection Prevention
```typescript
// ✅ Good: Parameterized queries
const store = await db.query(
  'SELECT * FROM stores WHERE id = $1',
  [storeId]
);

// ❌ Bad: String concatenation
const store = await db.query(
  `SELECT * FROM stores WHERE id = '${storeId}'`
);
```

### 3. Monitoring & Observability

#### Custom Metrics
```typescript
import { metrics } from '@mangalm/shared/monitoring';

// Record business metrics
metrics.recordPrediction('model-v2', 'success', 1500);
metrics.recordOrder('completed', 'store-123', 25000);

// Track performance
const timer = metrics.startTimer('database_query');
const result = await database.query(sql);
timer.end();
```

#### Distributed Tracing
```typescript
import { tracing } from '@mangalm/shared/monitoring';

@Trace('StoreService.createStore')
async createStore(data: StoreData): Promise<Store> {
  const span = tracing.startSpan('validate_store_data');
  await this.validateStore(data);
  span.end();
  
  return await tracing.traceDatabaseOperation(
    'insert',
    'INSERT INTO stores ...',
    () => this.database.stores.create(data)
  );
}
```

### 4. Deployment

#### Build Process
```bash
# Build all services
npm run build:all

# Build specific service
cd services/api-gateway
npm run build

# Production build
NODE_ENV=production npm run build
```

#### Health Checks
```typescript
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      services: await checkServices()
    }
  };
  
  const isHealthy = Object.values(health.checks).every(c => c === 'ok');
  res.status(isHealthy ? 200 : 503).json(health);
});
```

## Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Find process using port
netstat -ano | findstr :3007

# Kill process
taskkill /F /PID <process_id>
```

#### 2. Database Connection Failed
```bash
# Check PostgreSQL service
sc query postgresql-x64-14

# Check connection
psql -U mangalm -h localhost -p 5432 -d mangalm_sales
```

#### 3. Module Not Found
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild shared module
cd services/shared
npm run build
cd ../..
```

#### 4. TypeScript Errors
```bash
# Check TypeScript version
npx tsc --version

# Clean and rebuild
npm run clean
npm run build
```

## Resources

### Documentation
- [API Documentation](./API_DOCUMENTATION.md)
- [Architecture Guide](./ARCHITECTURE.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE_WINDOWS.md)
- [Monitoring Guide](./MONITORING_GUIDE.md)

### External Resources
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Jest Testing](https://jestjs.io/docs/getting-started)

### Support Channels
- GitHub Issues: [github.com/mangalm/sales-assistant/issues](https://github.com/mangalm/sales-assistant/issues)
- Slack: #mangalm-dev
- Email: dev-support@mangalm.com

---

*Version: 1.0.0*  
*Last Updated: 2025-08-10*