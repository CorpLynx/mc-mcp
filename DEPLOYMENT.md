# Deployment Guide

This guide covers deploying the Minecraft MCP Bridge system in production environments.

## Table of Contents

- [Docker Deployment](#docker-deployment)
- [Minecraft Mod Deployment](#minecraft-mod-deployment)
- [Production Considerations](#production-considerations)
- [Monitoring and Health Checks](#monitoring-and-health-checks)
- [Troubleshooting](#troubleshooting)

## Docker Deployment

The MCP Server and Bridge Server can be deployed using Docker and Docker Compose.

### Prerequisites

- Docker 20.10 or later
- Docker Compose 2.0 or later
- At least 512MB RAM available
- Network access between containers and Minecraft server

### Quick Start

1. **Clone the repository and build the project:**

```bash
git clone <repository-url>
cd minecraft-mcp-bridge
npm install
npm run build
```

2. **Configure environment variables:**

```bash
# Copy the example environment file
cp .env.docker.example .env

# Edit .env with your configuration
# IMPORTANT: Change the default tokens to secure random values!
nano .env
```

3. **Generate secure authentication tokens:**

```bash
# Generate random tokens (Linux/Mac)
openssl rand -hex 32  # For MCP_AUTH_TOKENS
openssl rand -hex 32  # For MINECRAFT_AUTH_TOKEN

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

4. **Start the services:**

```bash
# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

5. **Verify deployment:**

```bash
# Check Bridge Server health
curl http://localhost:8081/health

# Expected response:
# {
#   "status": "ok",
#   "version": "1.0.0",
#   "connections": {
#     "mcp": 1,
#     "minecraft": 0
#   },
#   "latency": {
#     "avgMs": 0,
#     "maxMs": 0,
#     "messagesForwarded": 0,
#     "over100ms": 0
#   }
# }
```

### Docker Compose Services

The `docker-compose.yml` defines two services:

#### Bridge Server

- **Container Name:** `minecraft-bridge-server`
- **Ports:**
  - `8080`: WebSocket server (for MCP Server and Minecraft Mod)
  - `8081`: Health check HTTP endpoint
- **Health Check:** HTTP GET to `/health` endpoint
- **Restart Policy:** `unless-stopped`

#### MCP Server

- **Container Name:** `minecraft-mcp-server`
- **Ports:** None (communicates via WebSocket to Bridge Server)
- **Dependencies:** Waits for Bridge Server to be healthy
- **Restart Policy:** `unless-stopped`

### Environment Variables

All configuration is done via environment variables in the `.env` file:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MCP_AUTH_TOKENS` | Comma-separated MCP auth tokens | `mcp-token-1,mcp-token-2` | Yes |
| `MINECRAFT_AUTH_TOKEN` | Minecraft Mod auth token | `minecraft-token-here` | Yes |
| `MCP_AUTH_TOKEN` | Token for MCP Server to use | `mcp-token-1` | Yes |
| `MESSAGE_QUEUE_SIZE` | Max queued messages per client | `1000` | No |
| `HEARTBEAT_INTERVAL` | Heartbeat interval (ms) | `30000` | No |
| `LOG_LEVEL` | Bridge Server log level | `info` | No |
| `MCP_LOG_LEVEL` | MCP Server log level | `INFO` | No |

### Docker Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart a specific service
docker-compose restart bridge-server

# View logs
docker-compose logs -f bridge-server
docker-compose logs -f mcp-server

# Rebuild after code changes
docker-compose build
docker-compose up -d

# Remove everything (including volumes)
docker-compose down -v

# Scale MCP servers (if needed)
docker-compose up -d --scale mcp-server=3
```

### Building Individual Images

You can also build and run individual Docker images:

```bash
# Build Bridge Server
docker build -f packages/bridge-server/Dockerfile -t minecraft-bridge-server .

# Run Bridge Server
docker run -d \
  -p 8080:8080 \
  -p 8081:8081 \
  -e PORT=8080 \
  -e MCP_AUTH_TOKENS=token1,token2 \
  -e MINECRAFT_AUTH_TOKEN=minecraft-token \
  --name bridge-server \
  minecraft-bridge-server

# Build MCP Server
docker build -f packages/mcp-server/Dockerfile -t minecraft-mcp-server .

# Run MCP Server
docker run -d \
  -e BRIDGE_URL=ws://bridge-server:8080 \
  -e AUTH_TOKEN=token1 \
  --link bridge-server \
  --name mcp-server \
  minecraft-mcp-server
```

## Minecraft Mod Deployment

The Minecraft Mod must be deployed to a NeoForge Minecraft server.

### Prerequisites

- Minecraft Server 1.20.1 or later
- NeoForge installed on the server
- Java 17 or later
- Network access to Bridge Server

### Building the Mod

1. **Navigate to the minecraft-plugin directory:**

```bash
cd packages/minecraft-plugin
```

2. **Build the JAR file:**

```bash
# Linux/Mac
./gradlew build

# Windows
gradlew.bat build
```

3. **Locate the built JAR:**

The JAR file will be in `build/libs/`:
```
packages/minecraft-plugin/build/libs/minecraft-mcp-bridge-1.0.0.jar
```

### Installing the Mod

1. **Copy the JAR to your Minecraft server:**

```bash
# Copy to server mods directory
cp packages/minecraft-plugin/build/libs/minecraft-mcp-bridge-1.0.0.jar \
   /path/to/minecraft/server/mods/
```

2. **Create the configuration file:**

```bash
# Create config directory if it doesn't exist
mkdir -p /path/to/minecraft/server/config

# Copy example configuration
cp packages/minecraft-plugin/minecraft-mcp-bridge.toml.example \
   /path/to/minecraft/server/config/minecraft-mcp-bridge.toml
```

3. **Configure the mod:**

Edit `/path/to/minecraft/server/config/minecraft-mcp-bridge.toml`:

```toml
[bridge]
# URL of the Bridge Server (use Docker service name if in same network)
url = "ws://bridge-server:8080"

# Or use external IP/hostname if Bridge Server is on different host
# url = "ws://your-bridge-server-ip:8080"

# Authentication token (must match MINECRAFT_AUTH_TOKEN in Bridge Server)
auth_token = "your-secure-minecraft-token-here"

reconnect_attempts = 5
reconnect_delay = 5000

[events]
# Enable the events you want to monitor
enabled = [
  "player_join",
  "player_quit",
  "player_chat",
  "player_death",
  "block_break"
]

[commands]
# Whitelist of allowed command patterns (regex)
allowed_patterns = [
  "^say .*",
  "^tp \\w+ -?\\d+ -?\\d+ -?\\d+$",
  "^give \\w+ \\w+ \\d+$",
  "^time set \\w+$",
  "^weather \\w+$"
]

[security]
require_auth = true
max_command_length = 256

[logging]
level = "INFO"
```

4. **Start the Minecraft server:**

```bash
cd /path/to/minecraft/server
java -Xmx4G -Xms4G -jar forge-server.jar nogui
```

5. **Verify the mod is loaded:**

Check the server logs for:
```
[INFO] [minecraft-mcp-bridge] Minecraft MCP Bridge v1.0.0 starting
[INFO] [minecraft-mcp-bridge] Connected to Bridge Server at ws://bridge-server:8080
```

### Deployment Architectures

#### Single Host Deployment

All components on one machine:

```
┌─────────────────────────────────────────┐
│           Single Host                    │
│                                          │
│  ┌──────────────┐  ┌──────────────┐    │
│  │ MCP Server   │  │ Bridge Server│    │
│  │  (Docker)    │◄─┤   (Docker)   │    │
│  └──────────────┘  └──────┬───────┘    │
│                            │             │
│                     ┌──────▼───────┐    │
│                     │  Minecraft   │    │
│                     │   Server     │    │
│                     │  + Mod       │    │
│                     └──────────────┘    │
└─────────────────────────────────────────┘
```

#### Multi-Host Deployment

Components on separate machines:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ MCP Server   │     │ Bridge Server│     │  Minecraft   │
│  (Docker)    │     │   (Docker)   │     │   Server     │
│              │────►│              │────►│  + Mod       │
│ Host A       │     │ Host B       │     │ Host C       │
└──────────────┘     └──────────────┘     └──────────────┘
```

#### Docker Network Configuration

If Minecraft server is also in Docker:

```yaml
# Add to docker-compose.yml
services:
  minecraft-server:
    image: itzg/minecraft-server
    environment:
      EULA: "TRUE"
      TYPE: "FORGE"
      VERSION: "1.20.1"
    volumes:
      - ./minecraft-data:/data
      - ./packages/minecraft-plugin/build/libs:/mods
    ports:
      - "25565:25565"
    networks:
      - minecraft-mcp-network
```

## Production Considerations

### Security

1. **Use Strong Authentication Tokens:**
   - Generate cryptographically secure random tokens
   - Never use default tokens in production
   - Rotate tokens periodically

2. **Enable TLS/SSL:**
   - Use `wss://` instead of `ws://` for WebSocket connections
   - Configure SSL certificates in Bridge Server
   - Use a reverse proxy (nginx, Traefik) for TLS termination

3. **Network Security:**
   - Use firewall rules to restrict access
   - Only expose necessary ports
   - Use private networks for internal communication

4. **Command Whitelist:**
   - Carefully configure allowed command patterns
   - Use restrictive regex patterns
   - Regularly audit command executions

### Performance

1. **Resource Allocation:**
   - Bridge Server: 256MB RAM minimum, 512MB recommended
   - MCP Server: 256MB RAM minimum, 512MB recommended
   - Minecraft Server: 4GB+ RAM recommended

2. **Scaling:**
   - Run multiple MCP Server instances for high availability
   - Use load balancer for MCP Server connections
   - Monitor message queue depth

3. **Optimization:**
   - Enable message compression for high-traffic scenarios
   - Adjust heartbeat intervals based on network stability
   - Monitor and tune message queue size

### Reliability

1. **Automatic Restart:**
   - Docker Compose uses `restart: unless-stopped`
   - Configure systemd for non-Docker deployments

2. **Health Monitoring:**
   - Monitor `/health` endpoint
   - Set up alerts for connection failures
   - Track message latency metrics

3. **Logging:**
   - Centralize logs using ELK stack or similar
   - Set appropriate log levels (INFO for production)
   - Rotate logs to prevent disk space issues

### Backup and Recovery

1. **Configuration Backup:**
   - Back up `.env` and `minecraft-mcp-bridge.toml`
   - Version control configuration files
   - Document custom configurations

2. **Disaster Recovery:**
   - Test recovery procedures
   - Document deployment steps
   - Keep deployment scripts in version control

## Monitoring and Health Checks

### Bridge Server Health Endpoint

The Bridge Server exposes a health check endpoint at `http://localhost:8081/health`:

```bash
curl http://localhost:8081/health
```

Response format:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "connections": {
    "mcp": 1,
    "minecraft": 1
  },
  "latency": {
    "avgMs": 15.5,
    "maxMs": 98.2,
    "messagesForwarded": 1523,
    "over100ms": 3
  }
}
```

### Monitoring Metrics

Key metrics to monitor:

1. **Connection Count:**
   - Number of connected MCP clients
   - Number of connected Minecraft clients
   - Alert if connections drop to 0

2. **Message Latency:**
   - Average forwarding latency
   - Maximum latency
   - Count of messages over 100ms threshold

3. **Error Rates:**
   - Authentication failures
   - Message validation errors
   - Command execution failures

4. **Resource Usage:**
   - CPU usage
   - Memory usage
   - Network bandwidth

### Integration with Monitoring Systems

#### Prometheus

Add to `docker-compose.yml`:

```yaml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
```

#### Grafana

Add to `docker-compose.yml`:

```yaml
services:
  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

## Troubleshooting

### Bridge Server Won't Start

**Symptoms:** Container exits immediately

**Solutions:**
1. Check logs: `docker-compose logs bridge-server`
2. Verify port 8080 is not in use: `netstat -an | grep 8080`
3. Check environment variables are set correctly
4. Ensure authentication tokens are configured

### MCP Server Can't Connect

**Symptoms:** MCP Server logs show connection errors

**Solutions:**
1. Verify Bridge Server is running: `docker-compose ps`
2. Check Bridge Server health: `curl http://localhost:8081/health`
3. Verify `BRIDGE_URL` is correct (use service name in Docker network)
4. Check authentication token matches one in `MCP_AUTH_TOKENS`
5. Check network connectivity: `docker-compose exec mcp-server ping bridge-server`

### Minecraft Mod Can't Connect

**Symptoms:** Mod logs show connection failures

**Solutions:**
1. Verify Bridge Server is accessible from Minecraft server
2. Check `minecraft-mcp-bridge.toml` configuration
3. Verify authentication token matches `MINECRAFT_AUTH_TOKEN`
4. Check firewall rules allow connection to port 8080
5. Test connectivity: `telnet bridge-server-ip 8080`

### High Latency

**Symptoms:** Messages take >100ms to forward

**Solutions:**
1. Check network latency between components
2. Monitor CPU and memory usage
3. Reduce message queue size if memory is constrained
4. Consider deploying components closer together
5. Enable message compression

### Memory Issues

**Symptoms:** Container OOM killed or high memory usage

**Solutions:**
1. Reduce `MESSAGE_QUEUE_SIZE`
2. Increase Docker memory limits
3. Check for message queue buildup (offline clients)
4. Monitor for memory leaks in logs
5. Restart services periodically if needed

### Authentication Failures

**Symptoms:** Clients rejected with AUTH_FAILED error

**Solutions:**
1. Verify tokens match exactly (no extra spaces)
2. Check environment variables are loaded: `docker-compose config`
3. Restart services after changing tokens
4. Check logs for specific error messages

## Support

For additional help:
- Check the [README.md](README.md) for general information
- Review [SETUP.md](SETUP.md) for development setup
- Check [PROTOCOL.md](PROTOCOL.md) for message protocol details
- Open an issue on GitHub for bugs or feature requests
