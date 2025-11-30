#!/bin/bash
# Test Docker deployment setup
# This script validates that Docker images build correctly and services start properly

set -e  # Exit on error

echo "=========================================="
echo "Minecraft MCP Bridge - Docker Test Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
fi
print_success "Docker is installed"

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed"
    exit 1
fi
print_success "Docker Compose is installed"

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi
print_success "Node.js is installed"

echo ""

# Create test environment file
echo "Creating test environment configuration..."
cat > .env.test << EOF
MCP_AUTH_TOKENS=test-token-$(openssl rand -hex 16)
MINECRAFT_AUTH_TOKEN=test-minecraft-$(openssl rand -hex 16)
MCP_AUTH_TOKEN=test-token-$(openssl rand -hex 16)
MESSAGE_QUEUE_SIZE=100
HEARTBEAT_INTERVAL=10000
LOG_LEVEL=debug
MCP_LOG_LEVEL=DEBUG
EOF
print_success "Test environment created"

echo ""

# Install dependencies
echo "Installing dependencies..."
npm ci > /dev/null 2>&1
print_success "Dependencies installed"

echo ""

# Build TypeScript packages
echo "Building TypeScript packages..."
npm run build > /dev/null 2>&1
print_success "TypeScript packages built"

echo ""

# Build Docker images
echo "Building Docker images..."
print_info "This may take a few minutes on first run..."

docker-compose build > /dev/null 2>&1
print_success "Docker images built successfully"

echo ""

# Start services
echo "Starting services..."
docker-compose --env-file .env.test up -d

# Wait for services to be ready
print_info "Waiting for services to start (15 seconds)..."
sleep 15

echo ""

# Test Bridge Server health
echo "Testing Bridge Server health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:8081/health)

if [ $? -eq 0 ]; then
    print_success "Bridge Server is responding"
    
    # Parse and display health info
    STATUS=$(echo $HEALTH_RESPONSE | jq -r '.status' 2>/dev/null)
    VERSION=$(echo $HEALTH_RESPONSE | jq -r '.version' 2>/dev/null)
    MCP_CONNECTIONS=$(echo $HEALTH_RESPONSE | jq -r '.connections.mcp' 2>/dev/null)
    
    if [ "$STATUS" = "ok" ]; then
        print_success "Health check status: $STATUS"
        print_info "Version: $VERSION"
        print_info "MCP connections: $MCP_CONNECTIONS"
    else
        print_error "Health check returned unexpected status: $STATUS"
    fi
else
    print_error "Bridge Server is not responding"
fi

echo ""

# Check container logs for errors
echo "Checking container logs for errors..."

BRIDGE_ERRORS=$(docker-compose logs bridge-server 2>&1 | grep -i "error" | grep -v "0 error" | wc -l)
MCP_ERRORS=$(docker-compose logs mcp-server 2>&1 | grep -i "error" | grep -v "0 error" | wc -l)

if [ "$BRIDGE_ERRORS" -eq 0 ]; then
    print_success "No errors in Bridge Server logs"
else
    print_error "Found $BRIDGE_ERRORS error(s) in Bridge Server logs"
    docker-compose logs bridge-server | grep -i "error" | tail -5
fi

if [ "$MCP_ERRORS" -eq 0 ]; then
    print_success "No errors in MCP Server logs"
else
    print_error "Found $MCP_ERRORS error(s) in MCP Server logs"
    docker-compose logs mcp-server | grep -i "error" | tail -5
fi

echo ""

# Check if containers are running
echo "Checking container status..."

BRIDGE_STATUS=$(docker-compose ps -q bridge-server | xargs docker inspect -f '{{.State.Status}}')
MCP_STATUS=$(docker-compose ps -q mcp-server | xargs docker inspect -f '{{.State.Status}}')

if [ "$BRIDGE_STATUS" = "running" ]; then
    print_success "Bridge Server container is running"
else
    print_error "Bridge Server container status: $BRIDGE_STATUS"
fi

if [ "$MCP_STATUS" = "running" ]; then
    print_success "MCP Server container is running"
else
    print_error "MCP Server container status: $MCP_STATUS"
fi

echo ""

# Test WebSocket connection (basic check)
echo "Testing WebSocket connectivity..."
if command -v wscat &> /dev/null; then
    # If wscat is available, test WebSocket
    timeout 5 wscat -c ws://localhost:8080 -x '{"test":"connection"}' > /dev/null 2>&1
    if [ $? -eq 0 ] || [ $? -eq 124 ]; then
        print_success "WebSocket port is accessible"
    else
        print_error "WebSocket connection failed"
    fi
else
    print_info "wscat not installed, skipping WebSocket test"
    print_info "Install with: npm install -g wscat"
fi

echo ""

# Cleanup
echo "Cleaning up test environment..."
docker-compose --env-file .env.test down > /dev/null 2>&1
rm -f .env.test
print_success "Cleanup complete"

echo ""
echo "=========================================="
echo "Docker test complete!"
echo "=========================================="
echo ""
echo "To start the services for real:"
echo "  1. Copy .env.docker.example to .env"
echo "  2. Edit .env with secure tokens"
echo "  3. Run: docker-compose up -d"
echo ""
