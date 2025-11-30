# Minecraft MCP Bridge - Makefile
# Simplifies common Docker and development operations

.PHONY: help build start stop restart logs clean test deploy

# Default target
help:
	@echo "Minecraft MCP Bridge - Available Commands:"
	@echo ""
	@echo "  make build          - Build all Docker images"
	@echo "  make start          - Start all services with Docker Compose"
	@echo "  make stop           - Stop all services"
	@echo "  make restart        - Restart all services"
	@echo "  make logs           - View logs from all services"
	@echo "  make logs-bridge    - View Bridge Server logs"
	@echo "  make logs-mcp       - View MCP Server logs"
	@echo "  make clean          - Stop services and remove volumes"
	@echo "  make test           - Run all tests"
	@echo "  make health         - Check service health"
	@echo "  make dev            - Start development environment"
	@echo "  make build-mod      - Build Minecraft mod JAR"
	@echo "  make deploy         - Deploy to production (requires configuration)"
	@echo ""

# Build Docker images
build:
	@echo "Building Docker images..."
	docker-compose build

# Start services
start:
	@echo "Starting services..."
	docker-compose up -d
	@echo "Services started. Check health with: make health"

# Stop services
stop:
	@echo "Stopping services..."
	docker-compose down

# Restart services
restart: stop start

# View logs
logs:
	docker-compose logs -f

logs-bridge:
	docker-compose logs -f bridge-server

logs-mcp:
	docker-compose logs -f mcp-server

# Clean up everything
clean:
	@echo "Cleaning up..."
	docker-compose down -v
	@echo "Removing built artifacts..."
	rm -rf packages/*/dist
	rm -rf packages/minecraft-plugin/build
	@echo "Clean complete"

# Run tests
test:
	@echo "Running TypeScript tests..."
	npm test
	@echo "Building Minecraft mod..."
	cd packages/minecraft-plugin && ./gradlew test

# Check service health
health:
	@echo "Checking Bridge Server health..."
	@curl -s http://localhost:8081/health | jq . || echo "Bridge Server not responding"

# Development environment
dev:
	@echo "Starting development environment..."
	docker-compose -f docker-compose.dev.yml up -d
	@echo "Development environment started"

# Build Minecraft mod
build-mod:
	@echo "Building Minecraft mod..."
	cd packages/minecraft-plugin && ./gradlew build
	@echo "Mod built: packages/minecraft-plugin/build/libs/"

# Deploy to production (customize as needed)
deploy:
	@echo "Deploying to production..."
	@if [ ! -f .env ]; then \
		echo "Error: .env file not found. Copy .env.docker.example to .env and configure it."; \
		exit 1; \
	fi
	docker-compose pull
	docker-compose up -d
	@echo "Deployment complete. Check health with: make health"

# Install dependencies
install:
	@echo "Installing dependencies..."
	npm install
	@echo "Dependencies installed"

# Build TypeScript packages
build-ts:
	@echo "Building TypeScript packages..."
	npm run build
	@echo "TypeScript build complete"

# Full setup (install, build, start)
setup: install build-ts build start
	@echo "Setup complete!"
	@echo "Services are running. Check health with: make health"

# Generate secure tokens
generate-tokens:
	@echo "Generating secure authentication tokens..."
	@echo ""
	@echo "MCP_AUTH_TOKEN:"
	@openssl rand -hex 32 || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
	@echo ""
	@echo "MINECRAFT_AUTH_TOKEN:"
	@openssl rand -hex 32 || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
	@echo ""
	@echo "Add these to your .env file"
