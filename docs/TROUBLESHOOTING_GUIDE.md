# Mangalm Troubleshooting Guide

## Table of Contents
1. [System Health Checks](#system-health-checks)
2. [Service Issues](#service-issues)
3. [Database Problems](#database-problems)
4. [Performance Issues](#performance-issues)
5. [Authentication & Authorization](#authentication--authorization)
6. [Integration Issues](#integration-issues)
7. [Frontend Problems](#frontend-problems)
8. [Monitoring & Alerts](#monitoring--alerts)
9. [Data Issues](#data-issues)
10. [Emergency Procedures](#emergency-procedures)

## System Health Checks

### Quick Health Assessment

Run the comprehensive health check script:
```bash
cd scripts\windows
health-check.bat
```

This checks:
- ✅ All service availability
- ✅ Database connections
- ✅ Port availability
- ✅ System resources
- ✅ Log file integrity

### Manual Service Verification

```bash
# Check each service individually
curl http://localhost:3000/health  # Frontend
curl http://localhost:3007/health  # API Gateway
curl http://localhost:3001/health  # AI Service
curl http://localhost:3002/health  # PM Orchestrator
curl http://localhost:3003/health  # Zoho Integration
```

Expected response:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "version": "1.0.0"
}
```

## Service Issues

### Service Not Starting

#### Problem: API Gateway won't start
```
Error: listen EADDRINUSE :::3007
```

**Solution:**
```bash
# Find process using port
netstat -ano | findstr :3007

# Kill the process
taskkill /F /PID <process_id>

# Or use the stop script
cd scripts\windows
stop-all.bat
start-all.bat
```

#### Problem: Service crashes immediately
```
Error: Cannot find module '@mangalm/shared'
```

**Solution:**
```bash
# Rebuild shared module
cd services\shared
npm install
npm run build

# Reinstall dependencies
cd ..\..
scripts\windows\install-dependencies.bat
```

#### Problem: Database connection refused
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
```bash
# Check PostgreSQL service
sc query postgresql-x64-14

# Start PostgreSQL service
net start postgresql-x64-14

# Verify connection
pg_isready -h localhost -p 5432
```

### Service Performance Issues

#### High CPU Usage
1. Check process manager:
   ```bash
   pm2 monit  # If using PM2
   ```

2. Identify bottlenecks:
   ```bash
   # Check metrics
   curl http://localhost:3007/metrics | findstr cpu
   ```

3. Restart service if needed:
   ```bash
   pm2 restart api-gateway
   ```

#### Memory Leaks
1. Monitor memory usage:
   ```bash
   # Check memory metrics
   curl http://localhost:3007/metrics | findstr memory
   ```

2. If memory continuously increases:
   ```bash
   # Restart the service
   pm2 restart api-gateway
   
   # Check for memory leaks in logs
   scripts\windows\view-logs.bat
   ```

## Database Problems

### Connection Issues

#### Cannot connect to PostgreSQL
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Check service status
sc query postgresql-x64-14

# Start if not running
net start postgresql-x64-14
```

#### Connection pool exhausted
```
Error: remaining connection slots are reserved
```

**Solution:**
1. Check active connections:
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   ```

2. Kill long-running queries:
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle in transaction'
   AND state_change < current_timestamp - INTERVAL '5' MINUTE;
   ```

3. Increase connection limit:
   ```sql
   ALTER SYSTEM SET max_connections = 200;
   SELECT pg_reload_conf();
   ```

### Data Issues

#### Missing data after sync
1. Check sync logs:
   ```bash
   scripts\windows\view-logs.bat
   # Search for "sync" or "zoho"
   ```

2. Verify Zoho connection:
   ```bash
   curl http://localhost:3003/health
   ```

3. Trigger manual sync:
   ```bash
   curl -X POST http://localhost:3003/sync/trigger
   ```

#### Database corruption
1. Check database integrity:
   ```sql
   SELECT datname, pg_database_size(datname) FROM pg_database;
   ```

2. Run database repair:
   ```bash
   # Stop services first
   scripts\windows\stop-all.bat
   
   # Run database check
   pg_dump mangalm_sales > backup_before_repair.sql
   
   # Restart services
   scripts\windows\start-all.bat
   ```

### Migration Issues

#### Migration failed
```
Error: relation "users" already exists
```

**Solution:**
```bash
# Check migration status
cd database
npm run migration:show

# Revert last migration if needed
npm run migration:revert

# Run migrations again
npm run migration:run
```

#### Outdated schema
```bash
# Generate new migration
cd database
npm run migration:generate -- -n UpdateSchemaFix

# Review generated migration
# Edit if necessary

# Run migration
npm run migration:run
```

## Performance Issues

### Slow Response Times

#### API responses > 5 seconds
1. Check database query performance:
   ```sql
   SELECT query, calls, mean_time, stddev_time
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 10;
   ```

2. Check for missing indexes:
   ```sql
   SELECT schemaname, tablename, attname, n_distinct, correlation
   FROM pg_stats
   WHERE schemaname = 'public'
   AND n_distinct > 100
   AND correlation < 0.1;
   ```

3. Add indexes if needed:
   ```sql
   CREATE INDEX CONCURRENTLY idx_orders_store_date 
   ON orders (store_id, created_at);
   ```

#### High memory usage
1. Check system memory:
   ```bash
   # Windows
   wmic OS get TotalVisibleMemorySize,FreePhysicalMemory
   
   # Check process memory
   tasklist /FI "IMAGENAME eq node.exe" /FO TABLE
   ```

2. Adjust memory limits:
   ```javascript
   // In ecosystem.config.js
   max_memory_restart: '500M'  // Restart if exceeds 500MB
   ```

### Database Performance

#### Slow queries
1. Enable query logging:
   ```sql
   ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1s
   ALTER SYSTEM SET log_statement = 'all';
   SELECT pg_reload_conf();
   ```

2. Analyze slow queries:
   ```bash
   # Check PostgreSQL logs
   type "C:\Program Files\PostgreSQL\14\data\log\*.log" | findstr "duration:"
   ```

3. Optimize queries:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM orders WHERE store_id = '123';
   ```

#### High database load
1. Check active connections:
   ```sql
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;
   ```

2. Monitor database metrics:
   ```bash
   curl http://localhost:9187/metrics  # Postgres exporter
   ```

## Authentication & Authorization

### JWT Token Issues

#### Token expired
```json
{
  "error": {
    "code": "AUTH_002",
    "message": "Token expired"
  }
}
```

**User Solution:**
- Refresh the page to get new token
- Log out and log back in

**Developer Solution:**
```typescript
// Implement automatic token refresh
if (response.status === 401) {
  const newToken = await refreshToken();
  // Retry original request
}
```

#### Invalid token format
```json
{
  "error": {
    "code": "AUTH_001",
    "message": "Invalid token format"
  }
}
```

**Solution:**
1. Check JWT secret configuration:
   ```env
   JWT_SECRET=your-secret-key
   ```

2. Verify token generation:
   ```bash
   # Check logs for JWT errors
   scripts\windows\view-logs.bat
   # Search for "jwt" or "token"
   ```

### Permission Denied

#### User cannot access feature
1. Check user role:
   ```sql
   SELECT username, role, permissions FROM users WHERE id = 'user-id';
   ```

2. Update permissions:
   ```sql
   UPDATE users SET permissions = '["read", "write"]' WHERE id = 'user-id';
   ```

## Integration Issues

### Zoho CRM Integration

#### Sync not working
1. Check Zoho credentials:
   ```bash
   curl http://localhost:3003/zoho/status
   ```

2. Verify API limits:
   ```json
   {
     "dailyLimit": 10000,
     "used": 9500,
     "remaining": 500
   }
   ```

3. Check token expiration:
   ```bash
   # View Zoho service logs
   scripts\windows\view-logs.bat
   # Search for "zoho" or "auth"
   ```

#### Data mapping errors
```
Error: Field 'Full_Name' not found in Zoho contact
```

**Solution:**
1. Update field mapping:
   ```json
   {
     "localField": "name",
     "zohoField": "Full_Name",
     "required": true
   }
   ```

2. Check Zoho API documentation for correct field names

### Email/SMS Integration

#### Emails not sending
1. Check email configuration:
   ```env
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=your-email@example.com
   SMTP_PASS=your-password
   ```

2. Test email connection:
   ```bash
   curl -X POST http://localhost:3007/test/email \
     -H "Content-Type: application/json" \
     -d '{"to":"test@example.com","subject":"Test"}'
   ```

## Frontend Problems

### React Application Issues

#### Page won't load
1. Check browser console for errors
2. Verify API connectivity:
   ```javascript
   fetch('http://localhost:3007/health')
     .then(r => r.json())
     .then(console.log)
   ```

3. Clear browser cache and cookies

#### WebSocket connection failed
```
WebSocket connection to 'ws://localhost:3007/ws' failed
```

**Solution:**
1. Check WebSocket service:
   ```bash
   curl -i -N -H "Connection: Upgrade" \
        -H "Upgrade: websocket" \
        -H "Sec-WebSocket-Version: 13" \
        -H "Sec-WebSocket-Key: test" \
        http://localhost:3007/ws
   ```

2. Check firewall settings for WebSocket ports

### UI Issues

#### Charts not loading
1. Check data API:
   ```bash
   curl http://localhost:3007/api/v1/analytics/sales
   ```

2. Check browser developer tools for JavaScript errors

3. Verify chart library loading:
   ```javascript
   console.log(window.Chart);  // Should not be undefined
   ```

## Monitoring & Alerts

### Prometheus Issues

#### Metrics not appearing
1. Check service metrics endpoints:
   ```bash
   curl http://localhost:3007/metrics
   ```

2. Verify Prometheus configuration:
   ```yaml
   # Check prometheus.yml
   scrape_configs:
     - job_name: 'api-gateway'
       static_configs:
         - targets: ['localhost:3007']
   ```

3. Check Prometheus targets:
   ```bash
   curl http://localhost:9090/api/v1/targets
   ```

### Grafana Issues

#### Dashboard not loading
1. Check Grafana service:
   ```bash
   curl http://localhost:3009/api/health
   ```

2. Verify data source connection in Grafana UI

3. Check dashboard JSON for errors

### Alert Issues

#### Alerts not firing
1. Check alert rules:
   ```bash
   curl http://localhost:9090/api/v1/rules
   ```

2. Verify AlertManager configuration:
   ```bash
   curl http://localhost:9093/api/v1/status
   ```

## Data Issues

### Data Inconsistencies

#### Order totals don't match
1. Run data validation script:
   ```sql
   SELECT o.id, o.total_amount,
          SUM(oi.quantity * oi.price) as calculated_total
   FROM orders o
   JOIN order_items oi ON o.id = oi.order_id
   GROUP BY o.id, o.total_amount
   HAVING o.total_amount != SUM(oi.quantity * oi.price);
   ```

2. Fix inconsistencies:
   ```sql
   UPDATE orders SET total_amount = (
     SELECT SUM(quantity * price)
     FROM order_items
     WHERE order_id = orders.id
   );
   ```

### Missing Data

#### Store data missing
1. Check data import logs:
   ```bash
   scripts\windows\view-logs.bat
   # Search for "import" or "store"
   ```

2. Re-import data:
   ```bash
   curl -X POST http://localhost:3007/api/v1/import/stores \
     -F "file=@stores.csv"
   ```

## Emergency Procedures

### System Down

#### Complete system outage
1. **Immediate Actions:**
   ```bash
   # Check all services
   scripts\windows\health-check.bat
   
   # If multiple services down, restart all
   scripts\windows\stop-all.bat
   scripts\windows\start-all.bat
   ```

2. **If startup fails:**
   ```bash
   # Check system resources
   tasklist /FO CSV | findstr node.exe
   
   # Check disk space
   dir C:\ | findstr "bytes free"
   
   # Check available memory
   wmic OS get FreePhysicalMemory
   ```

3. **Escalation:**
   - Contact system administrator
   - Check monitoring dashboards
   - Review error logs

### Data Loss

#### Accidental data deletion
1. **Stop all services immediately:**
   ```bash
   scripts\windows\stop-all.bat
   ```

2. **Restore from backup:**
   ```bash
   scripts\windows\backup-database.bat
   # Select restore option
   ```

3. **Verify data integrity:**
   ```sql
   SELECT COUNT(*) FROM stores;
   SELECT COUNT(*) FROM orders;
   SELECT COUNT(*) FROM products;
   ```

### Security Breach

#### Suspected unauthorized access
1. **Immediate lockdown:**
   ```bash
   # Disable all external access
   # Change all passwords
   # Revoke all JWT tokens
   ```

2. **Investigation:**
   - Check access logs
   - Review authentication logs
   - Analyze unusual activity

3. **Recovery:**
   - Reset all credentials
   - Update security policies
   - Patch vulnerabilities

## Getting Additional Help

### Log Analysis

Always include relevant logs when asking for help:
```bash
# Generate diagnostic report
scripts\windows\troubleshoot.bat

# Collect logs
scripts\windows\view-logs.bat
# Generate log summary report
```

### Support Information

When contacting support, provide:
1. **System Information:**
   - OS version
   - Node.js version
   - Database version
   - Browser version (if frontend issue)

2. **Error Details:**
   - Exact error message
   - Steps to reproduce
   - Time when error occurred

3. **Log Files:**
   - Relevant service logs
   - System diagnostic report
   - Database error logs

### Support Channels

1. **Emergency**: Call +91-XXX-XXX-XXXX
2. **Email**: support@mangalm.com
3. **Documentation**: docs.mangalm.com
4. **GitHub Issues**: github.com/mangalm/issues

---

*Troubleshooting Guide Version: 1.0.0*  
*Last Updated: 2025-08-10*