# Minecraft Bridge Server - Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspace setup
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/bridge-server/package*.json ./packages/bridge-server/

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/bridge-server ./packages/bridge-server

# Build shared package first
WORKDIR /app/packages/shared
RUN npm run build

# Build bridge-server
WORKDIR /app/packages/bridge-server
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/bridge-server/package*.json ./packages/bridge-server/

# Install production dependencies only
RUN npm ci --production --workspaces

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/bridge-server/dist ./packages/bridge-server/dist

# Set working directory to bridge-server
WORKDIR /app/packages/bridge-server

# Health check using the built-in health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8081/health || exit 1

# Install wget for health check
USER root
RUN apk add --no-cache wget

# Run as non-root user for security
USER node

# Expose WebSocket port and health check port
EXPOSE 8080 8081

# Start the Bridge Server
CMD ["npm", "start"]
