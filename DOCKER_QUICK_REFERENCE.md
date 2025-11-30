# Docker Quick Reference

Quick reference for common Docker operations with the Minecraft MCP Bridge.

## Quick Start

```bash
# 1. Configure environment
cp .env.docker.example .env
# Edit .env with your tokens

# 2. Start everything
docker-compose up -d

# 3. Check status
docker-compose ps

# 4. View logs
docker-compose logs -f
```

## Common Commands

### Starting and Stopping

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d bridge-server

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Restart a service
docker-compose restart bridge-server
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f bridge-server
docker-compose logs -f mcp-server

# Last 100 lines
docker-compose logs --tail=100 bridge-server

# Since specific time
docker-compose logs --since 2024-01-01T00:00:00 bridge-server
```

### Building and Updating

```bash
# Build images
docker-compose build

# Build without cache
docker-compose build --no-cache

# Pull latest images
docker-compose pull

# Rebuild and restart
docker-compose up -d --build
```

### Inspecting Services

```bash
# Check service status
docker-compose ps

# Check resource usage
docker stats

# Inspect a container
docker inspect minecraft-bridge-server

# Execute command in container
docker-compose exec bridge-server sh
docker-compose exec mcp-server sh
```

### Health Checks

```bash
# Check Bridge Server health
curl http://localhost:8081/health

# Pretty print with jq
curl -s http://localhost:8081/health | jq .

# Check from inside container
docker-compose exec bridge-server wget -qO- http://localhost:8081/health
```

### Debugging

```bash
# View container logs
docker-compose logs bridge-server

# Follow logs in real-time
docker-compose logs -f bridge-server

# Check container environment variables
docker-compose exec bridge-server env

# Check network connectivity
docker-compose exec mcp-server ping bridge-server

# Access container shell
docker-compose exec bridge-server sh
```

### Scaling

```bash
# Run multiple MCP servers
docker-compose up -d --scale mcp-server=3

# Check scaled services
docker-compose ps
```

### Cleanup

```bash
# Stop and remove containers
docker-compose down

# Remove containers and volumes
docker-compose down -v

# Remove containers, volumes, and images
docker-compose down -v --rmi all

# Clean up unused Docker resources
docker system prune -a
```

## Using Makefile

```bash
# Show available commands
make help

# Build images
make build

# Start services
make start

# Stop services
make stop

# View logs
make logs
make logs-bridge
make logs-mcp

# Check health
make health

# Clean everything
make clean

# Generate secure tokens
make generate-tokens

# Full setup
make setup
```

## Environment Variables

### Bridge Server

```bash
PORT=8080
MCP_AUTH_TOKENS=token1,token2
MINECRAFT_AUTH_TOKEN=minecraft-token
MESSAGE_QUEUE_SIZE=1000
HEARTBEAT_INTERVAL=30000
LOG_LEVEL=info
```

### MCP Server

```bash
BRIDGE_URL=ws://bridge-server:8080
AUTH_TOKEN=token1
RECONNECT_ATTEMPTS=5
RECONNECT_DELAY=1000
LOG_LEVEL=INFO
```

## Troubleshooting

### Services won't start

```bash
# Check logs for errors
docker-compose logs

# Check if ports are in use
netstat -an | grep 8080  # Linux/Mac
netstat -an | findstr 8080  # Windows

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Can't connect to Bridge Server

```bash
# Check if Bridge Server is running
docker-compose ps bridge-server

# Check Bridge Server logs
docker-compose logs bridge-server

# Test connectivity
curl http://localhost:8081/health

# Check from MCP Server container
docker-compose exec mcp-server ping bridge-server
```

### High memory usage

```bash
# Check resource usage
docker stats

# Restart services
docker-compose restart

# Reduce message queue size in .env
MESSAGE_QUEUE_SIZE=100
docker-compose up -d
```

### Authentication errors

```bash
# Check environment variables
docker-compose config

# Verify tokens match
docker-compose exec bridge-server env | grep TOKEN
docker-compose exec mcp-server env | grep TOKEN

# Restart after changing .env
docker-compose down
docker-compose up -d
```

## Production Tips

### Security

```bash
# Generate secure tokens
openssl rand -hex 32

# Use secrets management
docker secret create mcp_token token.txt
```

### Monitoring

```bash
# Enable health checks in docker-compose.yml
healthcheck:
  test: ["CMD", "wget", "--spider", "http://localhost:8081/health"]
  interval: 30s
  timeout: 10s
  retries: 3

# Monitor with Prometheus
# Add prometheus exporter to services
```

### Backup

```bash
# Backup configuration
tar -czf backup.tar.gz .env docker-compose.yml

# Backup volumes
docker run --rm -v minecraft-mcp-network:/data -v $(pwd):/backup alpine tar czf /backup/volumes.tar.gz /data
```

### Updates

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose build
docker-compose up -d

# Check for issues
docker-compose logs -f
```

## Docker Compose Files

### Production: `docker-compose.yml`
- Optimized images
- Production settings
- Health checks
- Restart policies

### Development: `docker-compose.dev.yml`
- Volume mounts for hot-reload
- Debug ports exposed
- Development tools
- Additional services (Redis, PostgreSQL)

```bash
# Use development compose file
docker-compose -f docker-compose.dev.yml up -d
```

## Useful Aliases

Add to your `.bashrc` or `.zshrc`:

```bash
alias dcu='docker-compose up -d'
alias dcd='docker-compose down'
alias dcl='docker-compose logs -f'
alias dcp='docker-compose ps'
alias dcr='docker-compose restart'
alias dcb='docker-compose build'

# Minecraft MCP specific
alias mcp-start='docker-compose up -d'
alias mcp-stop='docker-compose down'
alias mcp-logs='docker-compose logs -f'
alias mcp-health='curl -s http://localhost:8081/health | jq .'
alias mcp-restart='docker-compose restart'
```

## Additional Resources

- [DEPLOYMENT.md](DEPLOYMENT.md) - Complete deployment guide
- [README.md](README.md) - Project overview
- [SETUP.md](SETUP.md) - Detailed setup instructions
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
