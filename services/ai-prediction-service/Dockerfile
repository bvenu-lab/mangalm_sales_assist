FROM node:20-slim AS builder

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Install TensorFlow dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libc6 \
    libstdc++6 \
    libgcc1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3006

# Expose the port
EXPOSE 3006

# Start the application
CMD ["node", "dist/simple-server.js"]
