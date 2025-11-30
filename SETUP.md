# Minecraft MCP Bridge - Detailed Setup Guide

This guide provides step-by-step instructions for setting up the Minecraft MCP Bridge system in various environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
- [Docker Deployment](#docker-deployment)
- [Testing the Setup](#testing-the-setup)
- [Troubleshooting](#troubleshooting)

> **Note:** For comprehensive Docker deployment instructions, production considerations, and Minecraft Mod deployment, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Prerequisites

### Required Software

1. **Node.js 18 or higher**
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation: `node --version`

2. **npm (comes with Node.js)**
   - Verify installation: `npm --version`

3. **Java 17 or higher**
   - Download from [adoptium.net](https://adoptium.net/)
   - Verify installation: `java --version`

4. **Minecraft Server with NeoForge**
   - Minecraft version 1.20.1 or higher
   - NeoForge installed and working
   - Download NeoForge from [neoforged.net](https://neoforged.net/)

### Optional Software

- **Git** - For cloning the repository
- **Docker** - For containerized deployment
- **Docker Compose** - For orchestrating multiple containers

## Development Setup

This setup is ideal for local development and testing.

### Step 1: Clone and Build

```bash
# Clone the repository (if using git)
git clone <repository-url>
cd minecraft-mcp-bridge

# Install Node.js dependencies
npm install

# Build all TypeScript packages
npm run build
```

### Step 2: Build Minecraft Mod

```bash
cd packages/minecraft-plugin

# Build the mod (this may take a few minutes the first time)
./gradlew build

# On Windows, use:
# gradlew.bat build

# The JAR file will be at:
# build/libs/minecraft-mcp-bridge-<version>.jar
```

### Step 3: Configure Bridge Server

```bash
cd packages/bridge-server

# Copy example configuration
cp .env.example .env

# Edit .env with your preferred editor
nano .env  # or vim, code, notepad, etc.
```

Minimal configuration for development:

```env
PORT=8080
MCP_AUTH_TOKENS=dev-mcp-token
MINECRAFT_AUTH_TOKEN=dev-minecraft-token
LOG_LEVEL=debug
```

### Step 4: Configure MCP Server

```bash
cd packages/mcp-server

# Copy example configuration
cp .env.example .env

# Edit .env
nano .env
```

Minimal configuration for development:

```env
BRIDGE_URL=ws://localhost:8080
AUTH_TOKEN=dev-mcp-token
LOG_LEVEL=DEBUG
```

### Step 5: Install Minecraft Mod

```bash
# Copy the built JAR to your Minecraft server's mods directory
cp packages/minecraft-plugin/build/libs/minecraft-mcp-bridge-*.jar /path/to/minecraft/server/mods/

# Create config directory if it doesn't exist
mkdir -p /path/to/minecraft/server/config

# Copy example configuration
cp packages/minecraft-plugin/minecraft-mcp-bridge.toml.example /path/to/minecraft/server/config/minecraft-mcp-bridge.toml

# Edit the configuration
nano /path/to/minecraft/server/config/minecraft-mcp-bridge.toml
```

Minimal configuration for development:

```toml
[bridge]
url = "ws://localhost:8080"
auth_token = "dev-minecraft-token"

[events]
enabled = ["player_join", "player_quit", "player_chat", "player_death", "block_break"]

[commands]
allowed_patterns = [
    "^say .*",
    "^tp \\w+ -?\\d+ -?\\d+ -?\\d+$",
    "^give \\w+ minecraft:\\w+ \\d+$"
]

[logging]
level = "DEBUG"
```

### Step 6: Start the System

Open three terminal windows:

**Terminal 1 - Bridge Server:**
```bash
cd packages/bridge-server
npm start
```

You should see:
```
Bridge Server starting...
Version: 1.0.0
Port: 8080
WebSocket server listening on port 8080
```

**Terminal 2 - MCP Server:**
```bash
cd packages/mcp-server
npm start
```

You should see:
```
MCP Server starting...
Connecting to Bridge Server at ws://localhost:8080
Connected to Bridge Server
```

**Terminal 3 - Minecraft Server:**
```bash
cd /path/to/minecraft/server
./start.sh  # or java -jar forge-server.jar
```

Watch the server logs for:
```
[minecraft-mcp-bridge] Mod initialized
[minecraft-mcp-bridge] Connecting to Bridge Server at ws://localhost:8080
[minecraft-mcp-bridge] Connected to Bridge Server
```

### Step 7: Verify the Setup

1. **Check Bridge Server logs** - Should show 2 connections (MCP Server and Minecraft Mod)
2. **Join the Minecraft server** - MCP Server should receive a player_join event
3. **Send a chat message** - MCP Server should receive a player_chat event

## Production Deployment

Production deployment requires additional security and reliability considerations.

### Step 1: Generate Secure Tokens

```bash
# Generate random tokens (Linux/Mac)
openssl rand -hex 32  # For MCP_AUTH_TOKENS
openssl rand -hex 32  # For MINECRAFT_AUTH_TOKEN

# On Windows with PowerShell:
# -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

### Step 2: Configure for Production

**Bridge Server (.env):**
```env
PORT=8080
MCP_AUTH_TOKENS=<secure-token-1>,<secure-token-2>
MINECRAFT_AUTH_TOKEN=<secure-token-3>
MESSAGE_QUEUE_SIZE=1000
HEARTBEAT_INTERVAL=30000
LOG_LEVEL=info
ENABLE_HEALTH_CHECK=true
```

**MCP Server (.env):**
```env
BRIDGE_URL=ws://bridge-server-hostname:8080
AUTH_TOKEN=<secure-token-1>
RECONNECT_ATTEMPTS=5
RECONNECT_DELAY=1000
LOG_LEVEL=INFO
```

**Minecraft Mod (minecraft-mcp-bridge.toml):**
```toml
[bridge]
url = "ws://bridge-server-hostname:8080"
auth_token = "<secure-token-3>"
reconnect_attempts = 5
reconnect_delay = 5000

[events]
enabled = ["player_join", "player_quit", "player_chat", "player_death", "block_break"]

[commands]
# Restrict to safe commands only
allowed_patterns = [
    "^say .*",
    "^tp \\w+ -?\\d+ -?\\d+ -?\\d+$",
    "^give \\w+ minecraft:\\w+ \\d+$",
    "^time set (day|night)$",
    "^weather (clear|rain)$"
]

[security]
require_auth = true
max_command_length = 256

[logging]
level = "INFO"
```

### Step 3: Network Configuration

**Firewall Rules:**
```bash
# Allow Bridge Server port (only from trusted IPs)
sudo ufw allow from <mcp-server-ip> to any port 8080
sudo ufw allow from <minecraft-server-ip> to any port 8080

# Or for development (less secure):
sudo ufw allow 8080
```

**Reverse Proxy (Optional - Nginx):**
```nginx
upstream bridge_server {
    server localhost:8080;
}

server {
    listen 443 ssl;
    server_name bridge.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://bridge_server;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Step 4: Process Management

Use a process manager to keep services running:

**Using systemd (Linux):**

Create `/etc/systemd/system/bridge-server.service`:
```ini
[Unit]
Description=Minecraft MCP Bridge Server
After=network.target

[Service]
Type=simple
User=minecraft
WorkingDirectory=/opt/minecraft-mcp-bridge/packages/bridge-server
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/mcp-server.service`:
```ini
[Unit]
Description=Minecraft MCP Server
After=network.target bridge-server.service

[Service]
Type=simple
User=minecraft
WorkingDirectory=/opt/minecraft-mcp-bridge/packages/mcp-server
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start services:
```bash
sudo systemctl enable bridge-server mcp-server
sudo systemctl start bridge-server mcp-server
sudo systemctl status bridge-server mcp-server
```

**Using PM2 (Node.js process manager):**
```bash
# Install PM2
npm install -g pm2

# Start Bridge Server
cd packages/bridge-server
pm2 start npm --name "bridge-server" -- start

# Start MCP Server
cd packages/mcp-server
pm2 start npm --name "mcp-server" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## Docker Deployment

Docker provides an isolated and reproducible deployment environment.

> **For complete Docker deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)**

### Quick Start with Docker

```bash
# 1. Copy environment configuration
cp .env.docker.example .env

# 2. Edit .env with secure tokens
nano .env

# 3. Start services
docker-compose up -d

# 4. Check health
curl http://localhost:8081/health

# 5. View logs
docker-compose logs -f
```

### Using the Makefile

The project includes a Makefile for common operations:

```bash
# Build Docker images
make build

# Start services
make start

# View logs
make logs

# Check health
make health

# Stop services
make stop

# Clean up everything
make clean

# Generate secure tokens
make generate-tokens
```

### Testing Docker Setup

Run the automated Docker test script:

```bash
# Linux/Mac
chmod +x scripts/test-docker.sh
./scripts/test-docker.sh

# Windows PowerShell
.\scripts\test-docker.ps1
```

For detailed Docker deployment instructions including:
- Multi-stage builds
- Production configurations
- Kubernetes deployment
- Monitoring and health checks
- Security best practices

See [DEPLOYMENT.md](DEPLOYMENT.md)

## Testing the Setup

### Manual Testing

1. **Test Event Flow:**
   ```bash
   # Join the Minecraft server
   # Check MCP Server logs for player_join event
   
   # Send a chat message in Minecraft
   # Check MCP Server logs for player_chat event
   ```

2. **Test Command Execution:**
   ```bash
   # From MCP Server, send a command (requires MCP client integration)
   # Or use a WebSocket client to send a test message
   ```

### Automated Testing

```bash
# Run unit tests
npm test

# Run integration tests (requires all components running)
npm run test:integration
```

### Health Checks

```bash
# Check Bridge Server health
curl http://localhost:8080/health

# Check connection status
# Look for "Connected clients: 2" in Bridge Server logs
```

## Troubleshooting

### Bridge Server Won't Start

**Problem:** Port already in use

**Solution:**
```bash
# Find process using port 8080
lsof -i :8080  # Linux/Mac
netstat -ano | findstr :8080  # Windows

# Kill the process or change PORT in .env
```

### MCP Server Can't Connect

**Problem:** Connection refused

**Solutions:**
1. Verify Bridge Server is running: `curl http://localhost:8080/health`
2. Check BRIDGE_URL in MCP Server .env
3. Verify AUTH_TOKEN matches one in Bridge Server's MCP_AUTH_TOKENS
4. Check firewall rules

### Minecraft Mod Not Loading

**Problem:** Mod doesn't appear in server logs

**Solutions:**
1. Verify NeoForge is installed correctly
2. Check mod is in the `mods/` directory
3. Verify Java version is 17 or higher
4. Check for mod conflicts in server logs

### Minecraft Mod Can't Connect

**Problem:** "Connection refused" in Minecraft logs

**Solutions:**
1. Verify Bridge Server is running and accessible
2. Check `bridge.url` in minecraft-mcp-bridge.toml
3. Verify `bridge.auth_token` matches Bridge Server's MINECRAFT_AUTH_TOKEN
4. Check network connectivity from Minecraft server to Bridge Server

### Commands Are Rejected

**Problem:** "Command not allowed" errors

**Solutions:**
1. Check command matches one of the `allowed_patterns` in minecraft-mcp-bridge.toml
2. Test regex patterns at [regex101.com](https://regex101.com/)
3. Ensure command length doesn't exceed `max_command_length`
4. Check Minecraft Mod logs for detailed rejection reason

### Events Not Received

**Problem:** MCP Server doesn't receive events

**Solutions:**
1. Verify event type is in `events.enabled` list in minecraft-mcp-bridge.toml
2. Check MCP Server subscription filters
3. Verify both MCP Server and Minecraft Mod are connected to Bridge Server
4. Check Bridge Server logs for message routing

### High Memory Usage

**Problem:** Components consuming too much memory

**Solutions:**
1. Reduce MESSAGE_QUEUE_SIZE in Bridge Server
2. Limit enabled events in Minecraft Mod
3. Increase HEARTBEAT_INTERVAL to reduce overhead
4. Monitor for memory leaks in logs

## Next Steps

- Review [PROTOCOL.md](PROTOCOL.md) for message format details
- See [README.md](README.md) for feature overview
- Check `.kiro/specs/minecraft-mcp-bridge/` for design specifications
- Configure monitoring and alerting for production deployments
