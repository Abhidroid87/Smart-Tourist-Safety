# =====================================================
# RAG SERVICE DOCKERFILE
# =====================================================

FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    curl \
    bash \
    git \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# =====================================================
# DEPENDENCIES STAGE
# =====================================================
FROM base AS deps

# Copy package files
COPY services/rag-service/package*.json ./
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --ignore-scripts

# =====================================================
# BUILD STAGE
# =====================================================
FROM base AS builder

# Copy source code
COPY services/rag-service ./
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci --ignore-scripts

# Build the application
RUN npm run build

# =====================================================
# RUNTIME STAGE
# =====================================================
FROM node:18-alpine AS runtime

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    bash \
    && rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Switch to nodejs user
USER nodejs

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Start the application
CMD ["node", "dist/server.js"]