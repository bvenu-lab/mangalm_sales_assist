# Mangalm Monitoring & Observability Guide

## Overview

The Mangalm Sales Assistant implements **enterprise-grade monitoring and observability** with comprehensive metrics collection, distributed tracing, centralized logging, and real-time alerting.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Services                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │   API    │ │    AI    │ │    PM    │ │   Zoho   │       │
│  │ Gateway  │ │ Service  │ │  Agent   │ │  Integ   │       │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │
│       │            │            │            │               │
│       └────────────┴────────────┴────────────┘               │
│                          │                                    │
│                    Telemetry Data                            │
│                          │                                    │
└──────────────────────────┼────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Prometheus  │ │    Jaeger    │ │     Loki     │
│   (Metrics)  │ │   (Traces)   │ │    (Logs)    │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
                    ┌─────▼─────┐
                    │  Grafana  │
                    │(Dashboard)│
                    └───────────┘
```

## Components

### 1. Metrics Collection (Prometheus)

**Features:**
- Real-time metrics collection every 15 seconds
- Custom business metrics tracking
- System resource monitoring
- Database performance metrics
- API performance tracking

**Key Metrics:**
- HTTP request rate, latency, and error rate
- Prediction performance and accuracy
- Order processing and revenue tracking
- Database connection pool usage
- Cache hit/miss ratios
- WebSocket connections
- Queue sizes and processing rates

### 2. Distributed Tracing (Jaeger + OpenTelemetry)

**Features:**
- End-to-end request tracing
- Service dependency mapping
- Performance bottleneck identification
- Error propagation tracking
- Correlation ID support

**Instrumentation:**
- Automatic HTTP instrumentation
- Database query tracing
- External API call tracing
- Message queue tracing
- Cache operation tracing

### 3. Centralized Logging (Winston + Loki)

**Features:**
- Structured JSON logging
- Log aggregation across services
- Log correlation with traces
- Multiple log levels and transports
- Automatic log rotation

**Log Levels:**
- FATAL: System crashes
- ERROR: Application errors
- WARN: Warning conditions
- INFO: Informational messages
- DEBUG: Debug information
- TRACE: Detailed trace information

### 4. Alerting (AlertManager)

**Alert Rules:**
- Service down (2 minutes)
- High error rate (>5%)
- High response time (>1s p95)
- Database connection failures
- High memory usage (>90%)
- High CPU usage (>80%)
- Low disk space (<10%)
- Frequent service restarts
- Queue backlog
- API rate limit warnings

### 5. Dashboards (Grafana)

**Available Dashboards:**
- System Overview
- Service Health
- API Performance
- Business Metrics
- Database Performance
- Infrastructure Metrics
- Error Analysis
- User Activity

## Setup Instructions

### Prerequisites

For Docker-based monitoring:
- Docker Desktop installed
- 4GB RAM available for monitoring stack
- 10GB disk space

For local monitoring (no Docker):
- Node.js 16+
- PostgreSQL with pg_stat_statements enabled

### Quick Start

#### With Docker

```bash
# Start monitoring stack
cd scripts/windows
start-monitoring.bat

# Access services
# Grafana: http://localhost:3009 (admin/admin123)
# Prometheus: http://localhost:9090
# Jaeger: http://localhost:16686
# AlertManager: http://localhost:9093
```

#### Without Docker (Local Mode)

```bash
# Install monitoring dependencies
cd services/shared
npm install

# Start local monitoring
cd scripts/windows
start-monitoring.bat

# Access local dashboard
# Dashboard: http://localhost:9999
# Metrics: http://localhost:9998/metrics
```

### Configuration

#### Environment Variables

```env
# Monitoring Configuration
ENABLE_METRICS=true
ENABLE_TRACING=true
ENABLE_ELASTICSEARCH=false
ENABLE_LOKI=true
ENABLE_CONSOLE_TRACING=false

# Service Endpoints
PROMETHEUS_PORT=9464
JAEGER_ENDPOINT=http://localhost:14268/api/traces
LOKI_HOST=http://localhost:3100
ELASTICSEARCH_NODE=http://localhost:9200

# Log Configuration
LOG_LEVEL=info
LOG_FORMAT=json
LOG_MAX_SIZE=10485760
LOG_MAX_FILES=10
```

## Usage

### Viewing Metrics

```bash
# Check metrics health
scripts\windows\check-metrics.bat

# View raw metrics
curl http://localhost:3007/metrics
```

### Viewing Logs

```bash
# View logs interactively
scripts\windows\view-logs.bat

# Tail logs in real-time
powershell -command "Get-Content logs\api-gateway-combined.log -Wait -Tail 50"
```

### Creating Custom Metrics

```typescript
import { MetricsCollector } from '@mangalm/shared/monitoring/metrics';

const metrics = new MetricsCollector('my-service');

// Record business metrics
metrics.recordPrediction('model-v1', 'success', 1500);
metrics.recordOrder('completed', 'store-1', 250.00);

// Record performance metrics
metrics.recordAPICall('/api/endpoint', 'success', 150);

// Set gauge values
metrics.setActiveConnections('websocket', 25);
metrics.setQueueSize('orders', 150);
```

### Adding Traces

```typescript
import { TracingUtils, Trace } from '@mangalm/shared/monitoring/tracing';

const tracing = new TracingUtils('my-service');

// Trace a function
@Trace('processOrder')
async processOrder(orderId: string) {
  // Function is automatically traced
}

// Manual tracing
await tracing.withSpan('custom-operation', async (span) => {
  span.setAttributes({
    'order.id': orderId,
    'order.value': 250.00
  });
  
  // Your code here
});

// Trace database operations
await tracing.traceDatabaseOperation('select', 'SELECT * FROM orders', async () => {
  return db.query('SELECT * FROM orders');
});
```

### Structured Logging

```typescript
import { createLogger, StructuredLogger } from '@mangalm/shared/monitoring/logger';

const logger = createLogger({ service: 'my-service' });
const structured = new StructuredLogger(logger);

// Log business events
structured.logBusinessEvent('order_created', {
  orderId: '12345',
  value: 250.00
}, userId);

// Log security events
structured.logSecurityEvent('login_attempt', {
  success: true,
  method: '2fa'
}, userId, ipAddress);

// Log performance metrics
structured.logPerformanceMetric('api_response_time', 150, 'ms');

// Log audit trail
structured.logAudit('update', 'order', orderId, userId, {
  old: { status: 'pending' },
  new: { status: 'completed' }
});
```

## Performance Monitoring

### Real-time Performance Tracking

```typescript
import { PerformanceMonitor, MonitorPerformance } from '@mangalm/shared/monitoring/performance';

const perfMonitor = new PerformanceMonitor('my-service');

// Set thresholds
perfMonitor.setThreshold('api_call', 500, 1000); // warn at 500ms, critical at 1000ms

// Monitor performance
@MonitorPerformance('expensive_operation', { warning: 1000, critical: 5000 })
async expensiveOperation() {
  // Operation is monitored
}

// Get statistics
const stats = perfMonitor.getStats('api_call');
console.log(`p95 latency: ${stats.p95}ms`);
```

### Resource Monitoring

```typescript
import { ResourceMonitor } from '@mangalm/shared/monitoring/performance';

const resourceMonitor = new ResourceMonitor();
resourceMonitor.start();

// Get current usage
const current = resourceMonitor.getCurrentUsage();
console.log(`Memory: ${current.memory.heapUsed}MB`);
console.log(`CPU: ${current.cpu.user}s`);

// Get averages
const average = resourceMonitor.getAverageUsage();
console.log(`Avg Memory: ${average.memory.heapUsed}MB`);
```

## Alerting

### Alert Channels

Alerts can be configured to send notifications via:
- Email (SMTP)
- Slack webhooks
- Microsoft Teams
- PagerDuty
- Custom webhooks

### Alert Configuration

Edit `monitoring/alertmanager/alertmanager.yml`:

```yaml
route:
  group_by: ['alertname', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 12h
  receiver: 'team-notifications'

receivers:
  - name: 'team-notifications'
    email_configs:
      - to: 'team@example.com'
        from: 'alerts@mangalm.com'
        smarthost: 'smtp.example.com:587'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts'
```

## Troubleshooting

### Common Issues

#### 1. Metrics not appearing in Prometheus

```bash
# Check if service is exposing metrics
curl http://localhost:3007/metrics

# Check Prometheus targets
http://localhost:9090/targets
```

#### 2. Traces not showing in Jaeger

```bash
# Check if Jaeger is receiving data
curl http://localhost:14269/metrics

# Enable console tracing for debugging
set ENABLE_CONSOLE_TRACING=true
```

#### 3. Logs not aggregating in Loki

```bash
# Check Promtail status
docker logs mangalm-promtail

# Verify log file permissions
dir logs /q
```

#### 4. High memory usage

```bash
# Check memory usage by service
docker stats

# Adjust memory limits in ecosystem.config.js
max_memory_restart: '500M'
```

### Debug Mode

Enable debug mode for detailed monitoring information:

```env
LOG_LEVEL=debug
ENABLE_CONSOLE_TRACING=true
DEBUG=mangalm:*
```

## Best Practices

1. **Metrics Naming**: Use consistent naming convention
   - Format: `mangalm_<component>_<metric>_<unit>`
   - Example: `mangalm_api_request_duration_seconds`

2. **Log Context**: Always include correlation IDs
   ```typescript
   logger.info('Processing order', { 
     correlationId, 
     orderId, 
     userId 
   });
   ```

3. **Trace Sampling**: Use sampling in production
   ```typescript
   // Sample 10% of traces
   sampler: new TraceIdRatioBasedSampler(0.1)
   ```

4. **Alert Fatigue**: Avoid noisy alerts
   - Set appropriate thresholds
   - Use alert grouping
   - Implement alert suppression during maintenance

5. **Dashboard Organization**: Create role-specific dashboards
   - Executive Dashboard (business metrics)
   - Operations Dashboard (system health)
   - Developer Dashboard (detailed metrics)

## Maintenance

### Log Rotation

Logs are automatically rotated when they reach 10MB. Old logs are kept for 30 days.

```bash
# Manual cleanup
scripts\windows\cleanup-logs.bat
```

### Metrics Retention

Prometheus retains metrics for 15 days by default. Adjust in `prometheus.yml`:

```yaml
global:
  retention: 30d
```

### Backup

```bash
# Backup Grafana dashboards
docker exec mangalm-grafana grafana-cli admin export-dashboard

# Backup Prometheus data
docker exec mangalm-prometheus promtool tsdb snapshot /prometheus
```

## Security Considerations

1. **Secure Endpoints**: Protect metrics and health endpoints in production
2. **Sensitive Data**: Never log passwords, tokens, or PII
3. **Rate Limiting**: Implement rate limiting on metrics endpoints
4. **Access Control**: Use authentication for Grafana and Prometheus
5. **Encryption**: Use TLS for all monitoring traffic in production

## Support

For monitoring issues:
1. Check `scripts\windows\troubleshoot.bat`
2. Review logs in `monitoring\local\logs`
3. Check service health with `health-check.bat`
4. Verify metrics with `check-metrics.bat`

---

*Last Updated: 2025-08-10*
*Version: 1.0.0*