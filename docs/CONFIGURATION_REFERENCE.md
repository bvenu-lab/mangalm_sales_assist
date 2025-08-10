# Mangalm Configuration Reference

## Table of Contents
1. [Environment Variables](#environment-variables)
2. [Service Configuration](#service-configuration)
3. [Database Configuration](#database-configuration)
4. [Security Configuration](#security-configuration)
5. [Integration Configuration](#integration-configuration)
6. [Monitoring Configuration](#monitoring-configuration)
7. [Deployment Configuration](#deployment-configuration)
8. [Performance Tuning](#performance-tuning)

## Environment Variables

### Core Application Settings

```env
# Application Environment
NODE_ENV=development|staging|production
DEBUG=mangalm:*
LOG_LEVEL=debug|info|warn|error

# Server Configuration
PORT=3007
HOST=localhost
BASE_URL=http://localhost:3007

# Security
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

### Database Configuration

```env
# PostgreSQL Primary Database
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mangalm_sales
DB_USER=mangalm
DB_PASSWORD=mangalm_secure_2024
DB_SSL=false
DB_SYNCHRONIZE=false
DB_LOGGING=false

# Connection Pool Settings
DB_MAX_CONNECTIONS=100
DB_MIN_CONNECTIONS=5
DB_ACQUIRE_TIMEOUT=60000
DB_IDLE_TIMEOUT=10000

# Read Replica (Optional)
DB_READ_HOST=localhost
DB_READ_PORT=5433
DB_READ_USER=mangalm_read
DB_READ_PASSWORD=read_password
```

### Cache Configuration

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=mangalm:
REDIS_TTL=3600

# Cache Settings
CACHE_ENABLED=true
CACHE_DEFAULT_TTL=300
CACHE_MAX_ITEMS=10000
```

### Authentication & Security

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=mangalm-api
JWT_AUDIENCE=mangalm-users

# Password Policy
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SYMBOLS=true
PASSWORD_MAX_AGE_DAYS=90

# Session Configuration
SESSION_SECRET=your-session-secret-key
SESSION_MAX_AGE=86400000
SESSION_SECURE=false
```

### External Service Integration

```env
# Zoho CRM Integration
ZOHO_CLIENT_ID=your-zoho-client-id
ZOHO_CLIENT_SECRET=your-zoho-client-secret
ZOHO_REDIRECT_URI=http://localhost:3007/auth/zoho/callback
ZOHO_SCOPE=ZohoCRM.modules.ALL,ZohoCRM.settings.ALL
ZOHO_ACCESS_TOKEN=
ZOHO_REFRESH_TOKEN=
ZOHO_API_DOMAIN=https://www.zohoapis.com
ZOHO_SYNC_INTERVAL=3600000

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM_NAME=Mangalm Sales Assistant
EMAIL_FROM_ADDRESS=noreply@mangalm.com

# SMS Configuration
SMS_PROVIDER=twilio|aws|local
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_FROM_NUMBER=+1234567890
```

### Monitoring & Observability

```env
# Metrics Configuration
ENABLE_METRICS=true
METRICS_PORT=9464
METRICS_PATH=/metrics

# Tracing Configuration
ENABLE_TRACING=true
JAEGER_ENDPOINT=http://localhost:14268/api/traces
TRACE_SAMPLE_RATE=0.1

# Logging Configuration
ENABLE_CONSOLE_LOGGING=true
ENABLE_FILE_LOGGING=true
ENABLE_ELASTICSEARCH=false
ENABLE_LOKI=true

LOG_FILE_MAX_SIZE=10485760
LOG_FILE_MAX_FILES=10
LOG_ROTATION_FREQUENCY=daily

ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_INDEX=mangalm-logs
LOKI_HOST=http://localhost:3100
```

### AI/ML Configuration

```env
# Model Configuration
ML_MODEL_PATH=./models
ML_DEFAULT_MODEL=ensemble-v2
ML_PREDICTION_TIMEOUT=30000
ML_BATCH_SIZE=100

# TensorFlow Settings
TF_CPP_MIN_LOG_LEVEL=2
TF_FORCE_GPU_ALLOW_GROWTH=true

# Feature Engineering
FEATURE_STORE_ENABLED=true
FEATURE_CACHE_TTL=3600
```

## Service Configuration

### API Gateway Configuration

```typescript
// config/api-gateway.ts
export const apiGatewayConfig = {
  port: parseInt(process.env.PORT || '3007'),
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false
  },
  compression: {
    level: 6,
    threshold: 1024
  },
  bodyParser: {
    json: { limit: '10mb' },
    urlencoded: { limit: '10mb', extended: true }
  }
};
```

### Database Configuration

```typescript
// config/database.ts
export const databaseConfig = {
  type: 'postgres' as const,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'mangalm',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'mangalm_sales',
  ssl: process.env.DB_SSL === 'true',
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.DB_LOGGING === 'true',
  entities: ['dist/entities/*.js'],
  migrations: ['dist/migrations/*.js'],
  subscribers: ['dist/subscribers/*.js'],
  extra: {
    max: parseInt(process.env.DB_MAX_CONNECTIONS || '100'),
    min: parseInt(process.env.DB_MIN_CONNECTIONS || '5'),
    acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '10000'),
    statement_timeout: 30000,
    query_timeout: 30000
  }
};
```

### Cache Configuration

```typescript
// config/cache.ts
export const cacheConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'mangalm:',
    retryDelayOnFailover: 100,
    retryDelayOnClusterDown: 300,
    maxRetriesPerRequest: 3
  },
  ttl: {
    default: parseInt(process.env.CACHE_DEFAULT_TTL || '300'),
    user: 1800,
    store: 3600,
    product: 7200,
    prediction: 1800
  },
  memory: {
    max: parseInt(process.env.CACHE_MAX_ITEMS || '10000'),
    ttl: 600
  }
};
```

## Security Configuration

### Authentication Configuration

```typescript
// config/auth.ts
export const authConfig = {
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'mangalm-api',
    audience: process.env.JWT_AUDIENCE || 'mangalm-users',
    algorithm: 'HS256' as const
  },
  password: {
    minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8'),
    requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE === 'true',
    requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE === 'true',
    requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS === 'true',
    requireSymbols: process.env.PASSWORD_REQUIRE_SYMBOLS === 'true',
    maxAgeDays: parseInt(process.env.PASSWORD_MAX_AGE_DAYS || '90'),
    saltRounds: 12
  },
  session: {
    secret: process.env.SESSION_SECRET!,
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'),
    secure: process.env.SESSION_SECURE === 'true',
    httpOnly: true,
    sameSite: 'lax' as const
  },
  lockout: {
    maxAttempts: 5,
    lockoutDuration: 900000, // 15 minutes
    resetAttempts: true
  }
};
```

### Security Headers Configuration

```typescript
// config/security.ts
export const securityConfig = {
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
        fontSrc: ["'self'", 'fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", 'ws:', 'wss:']
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  },
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || false,
    credentials: true,
    optionsSuccessStatus: 200
  }
};
```

## Integration Configuration

### Zoho CRM Configuration

```typescript
// config/zoho.ts
export const zohoConfig = {
  clientId: process.env.ZOHO_CLIENT_ID!,
  clientSecret: process.env.ZOHO_CLIENT_SECRET!,
  redirectUri: process.env.ZOHO_REDIRECT_URI!,
  scope: process.env.ZOHO_SCOPE || 'ZohoCRM.modules.ALL',
  apiDomain: process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com',
  authUrl: 'https://accounts.zoho.com/oauth/v2/auth',
  tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
  sync: {
    interval: parseInt(process.env.ZOHO_SYNC_INTERVAL || '3600000'),
    batchSize: 100,
    retryAttempts: 3,
    retryDelay: 5000
  },
  fieldMapping: {
    contact: {
      name: 'Full_Name',
      email: 'Email',
      phone: 'Phone',
      company: 'Account_Name'
    },
    account: {
      name: 'Account_Name',
      website: 'Website',
      phone: 'Phone'
    }
  }
};
```

### Email Configuration

```typescript
// config/email.ts
export const emailConfig = {
  transport: {
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!
    }
  },
  defaults: {
    from: {
      name: process.env.EMAIL_FROM_NAME || 'Mangalm Sales Assistant',
      address: process.env.EMAIL_FROM_ADDRESS || 'noreply@mangalm.com'
    }
  },
  templates: {
    orderConfirmation: 'order-confirmation',
    passwordReset: 'password-reset',
    welcome: 'welcome'
  },
  queue: {
    enabled: true,
    attempts: 3,
    delay: 2000
  }
};
```

## Monitoring Configuration

### Prometheus Configuration

```yaml
# monitoring/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    monitor: 'mangalm-monitor'
    environment: '${NODE_ENV}'

rule_files:
  - "alerts.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'api-gateway'
    static_configs:
      - targets: ['localhost:3007']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'ai-service'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
```

### Grafana Configuration

```typescript
// config/grafana.ts
export const grafanaConfig = {
  provisioning: {
    datasources: [
      {
        name: 'Prometheus',
        type: 'prometheus',
        url: 'http://localhost:9090',
        access: 'proxy',
        isDefault: true
      },
      {
        name: 'Loki',
        type: 'loki',
        url: 'http://localhost:3100',
        access: 'proxy'
      }
    ],
    dashboards: [
      {
        name: 'System Overview',
        folder: 'Mangalm',
        path: './grafana/dashboards/system-overview.json'
      },
      {
        name: 'API Performance',
        folder: 'Mangalm',
        path: './grafana/dashboards/api-performance.json'
      }
    ]
  }
};
```

## Deployment Configuration

### PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'api-gateway',
      cwd: './services/api-gateway',
      script: 'npm',
      args: 'start',
      instances: process.env.PM2_INSTANCES || 1,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: process.env.MAX_MEMORY || '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3007
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3007
      },
      error_file: './logs/api-gateway-error.log',
      out_file: './logs/api-gateway-out.log',
      log_file: './logs/api-gateway-combined.log',
      time: true,
      max_restarts: 5,
      restart_delay: 4000
    }
  ]
};
```

### Docker Configuration

```dockerfile
# Dockerfile for API Gateway
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3007

USER node

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  api-gateway:
    build:
      context: ./services/api-gateway
      dockerfile: Dockerfile
    ports:
      - "3007:3007"
    environment:
      - NODE_ENV=${NODE_ENV:-production}
      - DB_HOST=postgres
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3007/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped

volumes:
  postgres_data:
```

## Performance Tuning

### Node.js Optimization

```env
# Memory Management
NODE_OPTIONS=--max-old-space-size=2048
UV_THREADPOOL_SIZE=16

# V8 Optimization Flags
NODE_OPTIONS=--optimize-for-size
NODE_OPTIONS=--max-old-space-size=2048 --optimize-for-size

# Garbage Collection
NODE_OPTIONS=--expose-gc
GC_INTERVAL=300000
```

### Database Optimization

```sql
-- PostgreSQL Configuration (postgresql.conf)
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

-- Connection Pooling
max_pool_size = 20
min_pool_size = 5
acquire_timeout_millis = 60000
idle_timeout_millis = 10000

-- Query Optimization
log_min_duration_statement = 1000
log_statement = 'all'
log_checkpoints = on
log_connections = on
log_disconnections = on
```

### Cache Optimization

```typescript
// Cache Configuration
export const cacheOptimization = {
  redis: {
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    connectTimeout: 10000,
    commandTimeout: 5000,
    lazyConnect: true,
    keepAlive: 30000,
    family: 4 // Use IPv4
  },
  strategies: {
    stores: {
      ttl: 3600, // 1 hour
      staleWhileRevalidate: 600 // 10 minutes
    },
    predictions: {
      ttl: 1800, // 30 minutes
      compression: true
    },
    user_sessions: {
      ttl: 86400, // 24 hours
      sliding: true
    }
  }
};
```

### Load Balancing Configuration

```nginx
# nginx.conf
upstream api_backend {
    least_conn;
    server 127.0.0.1:3007 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3008 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3009 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name api.mangalm.com;

    location / {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    location /health {
        access_log off;
        proxy_pass http://api_backend/health;
    }
}
```

## Configuration Validation

### Environment Variable Validation

```typescript
// config/validation.ts
import Joi from 'joi';

export const configSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'staging', 'production').required(),
  PORT: Joi.number().port().default(3007),
  
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  
  SMTP_HOST: Joi.string().required(),
  SMTP_USER: Joi.string().email().required(),
  SMTP_PASS: Joi.string().required()
});

export function validateConfig() {
  const { error } = configSchema.validate(process.env, {
    allowUnknown: true,
    abortEarly: false
  });
  
  if (error) {
    throw new Error(`Configuration validation failed: ${error.message}`);
  }
}
```

---

*Configuration Reference Version: 1.0.0*  
*Last Updated: 2025-08-10*