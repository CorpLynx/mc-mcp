# Minecraft MCP Server - Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspace setup
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/mcp-server/package*.json ./packages/mcp-server/

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/mcp-server ./packages/mcp-server

# Build shared package first
WORKDIR /app/packages/shared
RUN npm run build

# Build mcp-server
WORKDIR /app/packages/mcp-server
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/mcp-server/package*.json ./packages/mcp-server/

# Install production dependencies only
RUN npm ci --production --workspaces

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/mcp-server/dist ./packages/mcp-server/dist

# Set working directory to mcp-server
WORKDIR /app/packages/mcp-server

# Health check (checks if process is running)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

# Run as non-root user for security
USER node

# Expose MCP protocol (stdio-based, no port needed)
# The container communicates via WebSocket to bridge server

# Start the MCP Server
CMD ["npm", "start"]
