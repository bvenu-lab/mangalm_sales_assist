# Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev) for the build
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the React app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config if needed
COPY --from=builder /app/build /usr/share/nginx/html

# Add a simple health check endpoint
RUN echo "healthy" > /usr/share/nginx/html/health

# Expose port 3000 (Cloud Run will override this)
EXPOSE 3000

# Use a custom nginx configuration for React Router
RUN echo 'server { \
    listen 3000; \
    location / { \
        root /usr/share/nginx/html; \
        try_files $uri $uri/ /index.html; \
    } \
    location /health { \
        access_log off; \
        return 200 "healthy"; \
    } \
}' > /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]