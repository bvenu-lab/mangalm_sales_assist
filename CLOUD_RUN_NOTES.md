# Cloud Run Deployment Notes

## Reserved Environment Variables (DO NOT SET)
- PORT - Automatically set by Cloud Run
- K_SERVICE - Service name
- K_REVISION - Revision name
- K_CONFIGURATION - Configuration name

## Critical Requirements
1. **Health Check**: Must respond within timeout period
2. **Port Binding**: Must listen on 0.0.0.0:$PORT (not localhost)
3. **Startup Time**: Must start within timeout (60-300s)
4. **Graceful Shutdown**: Handle SIGTERM signal

## Common Issues and Fixes

### 1. PORT Environment Variable
- **Issue**: "reserved env names were provided: PORT"
- **Fix**: Remove PORT from --set-env-vars, use --port flag instead

### 2. Buildpack vs Docker
- **Issue**: Buildpacks fail with complex monorepos
- **Fix**: Use Docker with explicit Dockerfile

### 3. Memory/CPU Limits
- **Minimum**: 128Mi memory, 0.08 CPU
- **Recommended**: 512Mi memory, 1 CPU for Node.js apps

### 4. Timeout Settings
- **Request timeout**: 60s (default), max 3600s
- **Startup probe**: Must respond to health check

### 5. Image Size
- **Issue**: Large images slow deployment
- **Fix**: Multi-stage builds, minimal base images

## Deployment Command Template
```bash
gcloud run deploy SERVICE_NAME \
  --image=IMAGE_URL \
  --platform=managed \
  --region=REGION \
  --allow-unauthenticated \
  --port=8080 \
  --cpu=1 \
  --memory=512Mi \
  --concurrency=80 \
  --min-instances=0 \
  --max-instances=10 \
  --timeout=60 \
  --set-env-vars="KEY=VALUE" \
  --quiet
```

## Testing Checklist
- [ ] Docker build works locally
- [ ] Container runs with PORT env var
- [ ] Health check responds at /health
- [ ] No reserved env vars in deployment
- [ ] Image pushed to registry
- [ ] Service name follows conventions (lowercase, hyphens)