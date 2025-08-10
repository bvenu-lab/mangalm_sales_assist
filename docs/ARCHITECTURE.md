# Mangalm Sales Assistant - System Architecture

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture Principles](#architecture-principles)
4. [Component Architecture](#component-architecture)
5. [Data Architecture](#data-architecture)
6. [Security Architecture](#security-architecture)
7. [Integration Architecture](#integration-architecture)
8. [Deployment Architecture](#deployment-architecture)
9. [Technology Stack](#technology-stack)
10. [Architecture Decisions](#architecture-decisions)

## Executive Summary

The Mangalm Sales Assistant is built on a **microservices architecture** with clear separation of concerns, scalable design, and enterprise-grade reliability. The system uses modern cloud-native patterns while maintaining flexibility for on-premise deployment.

### Key Architectural Features
- **Microservices**: Loosely coupled, independently deployable services
- **Event-Driven**: Asynchronous communication via message queues
- **API-First**: RESTful APIs with OpenAPI documentation
- **Cloud-Native**: Container-ready with orchestration support
- **Observable**: Comprehensive monitoring and tracing
- **Secure**: Defense-in-depth security model

## System Overview

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          External Systems                         │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  │  Zoho CRM │  │   Email   │  │    SMS    │  │  Payment  │   │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘   │
└────────┼──────────────┼──────────────┼──────────────┼──────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                                │
                    ┌───────────▼────────────┐
                    │   Integration Layer    │
                    │   (Adapters & APIs)    │
                    └───────────┬────────────┘
                                │
┌───────────────────────────────┼───────────────────────────────┐
│                     Application Layer                          │
│                                │                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                    API Gateway                        │    │
│  │              (Auth, Routing, Rate Limit)              │    │
│  └──────┬─────────┬──────────┬──────────┬──────────────┘    │
│         │         │          │          │                     │
│    ┌────▼────┐ ┌─▼──┐ ┌────▼────┐ ┌───▼────┐              │
│    │   AI    │ │ PM │ │  Zoho   │ │  Order │              │
│    │ Service │ │Agent│ │ Service │ │Service │              │
│    └────┬────┘ └─┬──┘ └────┬────┘ └───┬────┘              │
└─────────┼─────────┼─────────┼──────────┼─────────────────────┘
          │         │         │          │
          └─────────┴─────────┴──────────┘
                          │
              ┌───────────▼────────────┐
              │     Data Layer         │
              │  ┌──────────────────┐ │
              │  │   PostgreSQL     │ │
              │  └──────────────────┘ │
              │  ┌──────────────────┐ │
              │  │      Redis       │ │
              │  └──────────────────┘ │
              └────────────────────────┘
```

### Logical Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Presentation Layer                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │  React UI  │  │Mobile Apps │  │   API SDK   │   │
│  └────────────┘  └────────────┘  └────────────┘   │
└─────────────────────────┬───────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                  Service Layer                       │
│  ┌─────────────────────────────────────────────┐   │
│  │            Business Logic Services           │   │
│  ├─────────────────────────────────────────────┤   │
│  │ • Prediction Engine  • Order Management      │   │
│  │ • Store Management   • User Management       │   │
│  │ • Report Generation  • Notification Service  │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                   Data Access Layer                  │
│  ┌─────────────────────────────────────────────┐   │
│  │     Repository Pattern & Data Mappers        │   │
│  ├─────────────────────────────────────────────┤   │
│  │ • Entity Repositories  • Query Builders      │   │
│  │ • Transaction Manager  • Cache Manager       │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                  Infrastructure Layer                │
│  ┌─────────────────────────────────────────────┐   │
│  │         Databases & External Services         │   │
│  ├─────────────────────────────────────────────┤   │
│  │ • PostgreSQL  • Redis   • RabbitMQ          │   │
│  │ • File Storage • Email  • SMS               │   │
│  └─────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

## Architecture Principles

### 1. Domain-Driven Design (DDD)
- **Bounded Contexts**: Each service owns its domain
- **Aggregates**: Consistent business entities
- **Value Objects**: Immutable domain concepts
- **Domain Events**: Asynchronous communication

### 2. SOLID Principles
- **Single Responsibility**: Each component has one reason to change
- **Open/Closed**: Open for extension, closed for modification
- **Liskov Substitution**: Subtypes must be substitutable
- **Interface Segregation**: Specific interfaces over general ones
- **Dependency Inversion**: Depend on abstractions

### 3. Twelve-Factor App
- **Codebase**: One codebase, many deploys
- **Dependencies**: Explicitly declared
- **Config**: Stored in environment
- **Backing Services**: Attached resources
- **Build, Release, Run**: Strict separation
- **Processes**: Stateless processes
- **Port Binding**: Self-contained services
- **Concurrency**: Scale via process model
- **Disposability**: Fast startup/shutdown
- **Dev/Prod Parity**: Minimal gaps
- **Logs**: Event streams
- **Admin Processes**: One-off tasks

## Component Architecture

### 1. Frontend (React)

```typescript
// Component Structure
src/
├── components/          // Reusable UI components
│   ├── common/         // Generic components
│   ├── features/       // Feature-specific components
│   └── layouts/        // Layout components
├── pages/              // Page components (routes)
├── services/           // API service layer
├── store/              // Redux store
│   ├── slices/        // Feature slices
│   └── middleware/    // Custom middleware
├── hooks/              // Custom React hooks
├── utils/              // Utility functions
└── types/              // TypeScript definitions
```

**Key Patterns:**
- **Container/Presentational**: Separation of logic and UI
- **Hooks**: Custom hooks for reusable logic
- **Context API**: Cross-cutting concerns
- **Redux Toolkit**: Global state management

### 2. API Gateway

```typescript
// Gateway Architecture
interface GatewayComponents {
  authentication: JWTAuthMiddleware;
  authorization: RBACMiddleware;
  rateLimiting: RateLimiter;
  routing: ServiceRouter;
  loadBalancing: LoadBalancer;
  circuitBreaker: CircuitBreaker;
  monitoring: MetricsCollector;
  logging: StructuredLogger;
}

// Request Flow
Request → Auth → RateLimit → Route → Service → Response
                    ↓                    ↑
                 Logging    →    Monitoring
```

**Responsibilities:**
- Authentication & Authorization
- Request routing and aggregation
- Rate limiting and throttling
- Circuit breaking
- Response caching
- API versioning

### 3. AI Prediction Service

```typescript
// ML Architecture
class PredictionEngine {
  private models: Map<string, MLModel>;
  private featureExtractor: FeatureExtractor;
  private dataPreprocessor: DataPreprocessor;
  private modelRegistry: ModelRegistry;
  
  async predict(input: PredictionInput): Promise<PredictionOutput> {
    // 1. Preprocess data
    const processed = await this.dataPreprocessor.process(input);
    
    // 2. Extract features
    const features = await this.featureExtractor.extract(processed);
    
    // 3. Select model
    const model = await this.modelRegistry.getModel(input.modelId);
    
    // 4. Generate prediction
    const prediction = await model.predict(features);
    
    // 5. Post-process results
    return this.postProcess(prediction);
  }
}
```

**ML Pipeline:**
```
Data → Preprocessing → Feature Engineering → Model Selection
                                                    ↓
Output ← Post-processing ← Prediction ← Model Inference
```

### 4. Data Service Layer

```typescript
// Repository Pattern
interface IStoreRepository {
  findById(id: string): Promise<Store>;
  findAll(filters: StoreFilters): Promise<Store[]>;
  create(data: CreateStoreDto): Promise<Store>;
  update(id: string, data: UpdateStoreDto): Promise<Store>;
  delete(id: string): Promise<void>;
}

// Unit of Work Pattern
class UnitOfWork {
  private repositories: Map<string, IRepository>;
  private connection: DatabaseConnection;
  
  async transaction<T>(work: () => Promise<T>): Promise<T> {
    await this.connection.beginTransaction();
    try {
      const result = await work();
      await this.connection.commit();
      return result;
    } catch (error) {
      await this.connection.rollback();
      throw error;
    }
  }
}
```

## Data Architecture

### 1. Database Schema

```sql
-- Core Domain Entities
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Stores    │────<│   Orders    │>────│  Products   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                    │
       │                   │                    │
       ▼                   ▼                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Agents    │     │ OrderItems  │     │  Inventory  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                    │
       └───────────────────┴────────────────────┘
                           │
                    ┌──────▼──────┐
                    │ Predictions │
                    └─────────────┘
```

### 2. Data Flow

```
[User Input] → [API Gateway] → [Service Layer]
                                      ↓
[Cache Check] ← [Redis] ← [Business Logic]
     ↓                           ↓
[Cache Miss]            [Database Query]
     ↓                           ↓
[Database] → [Data Mapper] → [Domain Model]
                                 ↓
                          [Response Builder]
                                 ↓
                            [API Response]
```

### 3. Caching Strategy

```typescript
// Multi-tier Caching
enum CacheTier {
  L1_MEMORY = 'memory',      // In-process cache (10ms)
  L2_REDIS = 'redis',        // Distributed cache (50ms)
  L3_DATABASE = 'database',  // Database cache (200ms)
}

class CacheManager {
  async get<T>(key: string): Promise<T | null> {
    // Check L1 (Memory)
    const l1Result = this.memoryCache.get(key);
    if (l1Result) return l1Result;
    
    // Check L2 (Redis)
    const l2Result = await this.redisCache.get(key);
    if (l2Result) {
      this.memoryCache.set(key, l2Result);
      return l2Result;
    }
    
    // Check L3 (Database)
    const l3Result = await this.databaseCache.get(key);
    if (l3Result) {
      await this.redisCache.set(key, l3Result);
      this.memoryCache.set(key, l3Result);
      return l3Result;
    }
    
    return null;
  }
}
```

## Security Architecture

### 1. Security Layers

```
┌─────────────────────────────────────────────────┐
│              Perimeter Security                  │
│         (Firewall, DDoS Protection)             │
└─────────────────────┬───────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│            Application Security                  │
│    (WAF, Rate Limiting, Input Validation)       │
└─────────────────────┬───────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│           Authentication & Authorization         │
│         (JWT, OAuth2, RBAC, MFA)               │
└─────────────────────┬───────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│              Data Security                       │
│    (Encryption at Rest, Encryption in Transit)  │
└─────────────────────┬───────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│            Infrastructure Security               │
│      (Network Segmentation, Secrets Vault)      │
└──────────────────────────────────────────────────┘
```

### 2. Authentication Flow

```typescript
// JWT Authentication
class AuthenticationService {
  async authenticate(credentials: Credentials): Promise<AuthToken> {
    // 1. Validate credentials
    const user = await this.validateCredentials(credentials);
    
    // 2. Check MFA if enabled
    if (user.mfaEnabled) {
      await this.verifyMFA(credentials.mfaToken);
    }
    
    // 3. Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    
    // 4. Store refresh token
    await this.storeRefreshToken(user.id, refreshToken);
    
    // 5. Log authentication event
    await this.auditLog.logAuthentication(user);
    
    return { accessToken, refreshToken };
  }
}
```

### 3. Authorization Model

```typescript
// Role-Based Access Control (RBAC)
interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

class AuthorizationService {
  async authorize(
    user: User,
    resource: string,
    action: string
  ): Promise<boolean> {
    // Check user permissions
    const permissions = await this.getUserPermissions(user);
    
    // Evaluate authorization
    return permissions.some(p => 
      p.resource === resource && 
      p.action === action &&
      this.evaluateConditions(p.conditions, user)
    );
  }
}
```

## Integration Architecture

### 1. External System Integration

```typescript
// Adapter Pattern for External Services
interface IExternalService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sync(data: any): Promise<SyncResult>;
}

class ZohoAdapter implements IExternalService {
  private client: ZohoClient;
  private mapper: DataMapper;
  private validator: DataValidator;
  
  async sync(data: any): Promise<SyncResult> {
    // 1. Validate data
    const validated = await this.validator.validate(data);
    
    // 2. Map to external format
    const mapped = await this.mapper.toExternal(validated);
    
    // 3. Send to external system
    const response = await this.client.send(mapped);
    
    // 4. Map response back
    const result = await this.mapper.fromExternal(response);
    
    // 5. Handle errors and retries
    return this.handleResult(result);
  }
}
```

### 2. Event-Driven Architecture

```typescript
// Event Bus Implementation
class EventBus {
  private subscribers: Map<string, EventHandler[]>;
  
  publish(event: DomainEvent): void {
    const handlers = this.subscribers.get(event.type) || [];
    
    handlers.forEach(handler => {
      // Async handling with error isolation
      this.handleAsync(handler, event);
    });
  }
  
  private async handleAsync(
    handler: EventHandler,
    event: DomainEvent
  ): Promise<void> {
    try {
      await handler.handle(event);
    } catch (error) {
      await this.handleError(error, event);
    }
  }
}

// Domain Events
class OrderCreatedEvent implements DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly storeId: string,
    public readonly items: OrderItem[],
    public readonly timestamp: Date
  ) {}
}
```

### 3. Message Queue Architecture

```
Producer → [Queue] → Consumer
            ↓  ↑
         [DLQ] [Retry]
```

```typescript
// Message Queue Integration
class MessageQueueService {
  async publish(
    queue: string,
    message: Message,
    options?: PublishOptions
  ): Promise<void> {
    const envelope = {
      id: uuid(),
      timestamp: new Date(),
      correlationId: options?.correlationId,
      message,
      retryCount: 0,
      maxRetries: options?.maxRetries || 3
    };
    
    await this.channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify(envelope)),
      { persistent: true }
    );
  }
  
  async consume(
    queue: string,
    handler: MessageHandler
  ): Promise<void> {
    await this.channel.consume(queue, async (msg) => {
      try {
        const envelope = JSON.parse(msg.content.toString());
        await handler(envelope.message);
        this.channel.ack(msg);
      } catch (error) {
        await this.handleError(msg, error);
      }
    });
  }
}
```

## Deployment Architecture

### 1. Container Architecture

```yaml
# Docker Compose Structure
services:
  api-gateway:
    build: ./services/api-gateway
    ports:
      - "3007:3007"
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1'
          memory: 512M
  
  ai-service:
    build: ./services/ai-prediction-service
    ports:
      - "3001:3001"
    volumes:
      - ./models:/app/models
    deploy:
      replicas: 1
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

### 2. Kubernetes Architecture

```yaml
# Kubernetes Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: api-gateway
        image: mangalm/api-gateway:latest
        ports:
        - containerPort: 3007
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "500m"
          limits:
            memory: "512Mi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3007
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3007
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 3. CI/CD Pipeline

```yaml
# GitHub Actions Pipeline
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Tests
        run: |
          npm test
          npm run test:e2e
  
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build Docker Images
        run: |
          docker build -t mangalm/api-gateway services/api-gateway
          docker push mangalm/api-gateway
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl apply -f k8s/
          kubectl rollout status deployment/api-gateway
```

## Technology Stack

### Core Technologies

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | | |
| UI Framework | React 18 | Component-based UI |
| State Management | Redux Toolkit | Global state |
| Styling | Material-UI | Component library |
| Build Tool | Webpack 5 | Module bundling |
| **Backend** | | |
| Runtime | Node.js 18 | JavaScript runtime |
| Framework | Express.js | Web framework |
| Language | TypeScript 5 | Type safety |
| ORM | TypeORM | Database abstraction |
| **Database** | | |
| Primary DB | PostgreSQL 14 | Relational data |
| Cache | Redis 7 | In-memory cache |
| Search | Elasticsearch | Full-text search |
| **Infrastructure** | | |
| Container | Docker | Containerization |
| Orchestration | Kubernetes | Container orchestration |
| CI/CD | GitHub Actions | Automation |
| **Monitoring** | | |
| Metrics | Prometheus | Metrics collection |
| Tracing | Jaeger | Distributed tracing |
| Logging | ELK Stack | Log aggregation |
| Dashboards | Grafana | Visualization |

### Libraries & Frameworks

```json
{
  "dependencies": {
    // Core
    "express": "^4.18.0",
    "typescript": "^5.2.0",
    
    // Database
    "typeorm": "^0.3.0",
    "pg": "^8.11.0",
    "redis": "^4.6.0",
    
    // Authentication
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0",
    "passport": "^0.6.0",
    
    // Validation
    "joi": "^17.9.0",
    "express-validator": "^7.0.0",
    
    // ML/AI
    "@tensorflow/tfjs-node": "^4.10.0",
    "brain.js": "^2.0.0-beta.23",
    
    // Monitoring
    "prom-client": "^15.0.0",
    "@opentelemetry/api": "^1.7.0",
    "winston": "^3.11.0",
    
    // Testing
    "jest": "^29.6.0",
    "supertest": "^6.3.0",
    "cypress": "^13.0.0"
  }
}
```

## Architecture Decisions

### ADR-001: Microservices Architecture
**Status:** Accepted  
**Context:** Need for scalable, maintainable system  
**Decision:** Use microservices with clear boundaries  
**Consequences:** 
- ✅ Independent scaling and deployment
- ✅ Technology flexibility per service
- ❌ Increased operational complexity
- ❌ Network latency between services

### ADR-002: PostgreSQL as Primary Database
**Status:** Accepted  
**Context:** Need for ACID compliance and complex queries  
**Decision:** Use PostgreSQL for primary data storage  
**Consequences:**
- ✅ Strong consistency guarantees
- ✅ Rich query capabilities
- ✅ Mature ecosystem
- ❌ Vertical scaling limitations

### ADR-003: JWT for Authentication
**Status:** Accepted  
**Context:** Need for stateless authentication  
**Decision:** Use JWT tokens for authentication  
**Consequences:**
- ✅ Stateless authentication
- ✅ Easy to scale horizontally
- ❌ Token revocation complexity
- ❌ Token size overhead

### ADR-004: React for Frontend
**Status:** Accepted  
**Context:** Need for responsive, maintainable UI  
**Decision:** Use React with TypeScript  
**Consequences:**
- ✅ Component reusability
- ✅ Large ecosystem
- ✅ Type safety with TypeScript
- ❌ Learning curve for team

### ADR-005: Event-Driven Communication
**Status:** Accepted  
**Context:** Need for loose coupling between services  
**Decision:** Use events for inter-service communication  
**Consequences:**
- ✅ Loose coupling
- ✅ Scalability
- ❌ Eventual consistency
- ❌ Debugging complexity

## Performance Considerations

### 1. Optimization Strategies
- **Database**: Indexing, query optimization, connection pooling
- **Caching**: Multi-tier caching, cache warming, TTL management
- **API**: Response compression, pagination, field filtering
- **Frontend**: Code splitting, lazy loading, virtual scrolling

### 2. Scalability Patterns
- **Horizontal Scaling**: Stateless services, load balancing
- **Vertical Scaling**: Resource optimization, memory management
- **Data Partitioning**: Sharding, read replicas
- **Async Processing**: Message queues, background jobs

### 3. Performance Targets
- API Response Time: < 200ms (p95)
- Page Load Time: < 2 seconds
- Database Query Time: < 100ms
- Cache Hit Rate: > 80%
- System Availability: 99.9%

## Disaster Recovery

### 1. Backup Strategy
- **Database**: Daily full backup, hourly incremental
- **Files**: Object storage with versioning
- **Configuration**: Git repository backup
- **Secrets**: Encrypted vault backup

### 2. Recovery Procedures
- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour
- **Failover**: Automated with health checks
- **Rollback**: Blue-green deployments

## Future Roadmap

### Phase 2 (Q2 2025)
- GraphQL API implementation
- Real-time collaboration features
- Advanced ML models
- Mobile applications

### Phase 3 (Q3 2025)
- Multi-tenancy support
- Blockchain integration
- IoT device support
- Global deployment

### Phase 4 (Q4 2025)
- AI-powered automation
- Voice interface
- Predictive analytics
- Enterprise integrations

---

*Architecture Version: 1.0.0*  
*Last Updated: 2025-08-10*  
*Approved By: Architecture Review Board*