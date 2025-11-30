# Minecraft MCP Bridge

A system that enables Large Language Models (LLMs) to interact with Minecraft servers through the Model Context Protocol (MCP).

## Overview

The Minecraft MCP Bridge consists of three components that work together to enable LLM interaction with Minecraft:

1. **MCP Server** - Exposes Minecraft operations as MCP tools that LLMs can invoke
2. **Bridge Server** - WebSocket relay that routes messages between MCP Server and Minecraft
3. **Minecraft Mod** - NeoForge mod that hooks into game events and executes commands

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│             │  MCP    │              │  WS     │              │
│ LLM Client  │◄───────►│  MCP Server  │◄───────►│    Bridge    │
│             │         │              │         │    Server    │
└─────────────┘         └──────────────┘         └──────────────┘
                                                         │
                                                         │ WS
                                                         ▼
                                                  ┌──────────────┐
                                                  │  Minecraft   │
                                                  │     Mod      │
                                                  └──────────────┘
```

## Features

- **Real-time Event Notifications**: Receive notifications about player joins, chat messages, deaths, and more
- **Command Execution**: Execute Minecraft commands, send messages, teleport players, give items
- **Server Queries**: Query player info, server status, and world state
- **Event Filtering**: Subscribe to specific event types to reduce noise
- **Security**: Token-based authentication and command whitelisting
- **Resilience**: Automatic reconnection with exponential backoff
- **Performance**: Sub-100ms message forwarding latency

## Quick Start

### Prerequisites

- **Node.js 18+** and npm (for MCP Server and Bridge Server)
- **Java 17+** (for Minecraft Mod)
- **Minecraft Server** with NeoForge 1.20.1+ installed

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Build all TypeScript packages
npm run build
```

### 2. Configure Bridge Server

```bash
cd packages/bridge-server
cp .env.example .env
```

Edit `.env` and set your authentication tokens:

```env
PORT=8080
MCP_AUTH_TOKENS=your-mcp-token-here
MINECRAFT_AUTH_TOKEN=your-minecraft-token-here
```

### 3. Configure MCP Server

```bash
cd packages/mcp-server
cp .env.example .env
```

Edit `.env`:

```env
BRIDGE_URL=ws://localhost:8080
AUTH_TOKEN=your-mcp-token-here
```

### 4. Build and Install Minecraft Mod

```bash
cd packages/minecraft-plugin
./gradlew build
```

Copy the built JAR to your Minecraft server:

```bash
cp build/libs/minecraft-mcp-bridge-*.jar /path/to/minecraft/server/mods/
```

### 5. Configure Minecraft Mod

Create `config/minecraft-mcp-bridge.toml` in your Minecraft server directory:

```toml
[bridge]
url = "ws://localhost:8080"
auth_token = "your-minecraft-token-here"

[events]
enabled = ["player_join", "player_quit", "player_chat", "player_death", "block_break"]

[commands]
allowed_patterns = [
    "^say .*",
    "^tp \\w+ -?\\d+ -?\\d+ -?\\d+$",
    "^give \\w+ \\w+ \\d+$"
]
```

See `packages/minecraft-plugin/minecraft-mcp-bridge.toml.example` for all configuration options.

### 6. Start the System

Start each component in order:

```bash
# Terminal 1: Start Bridge Server
cd packages/bridge-server
npm start

# Terminal 2: Start MCP Server
cd packages/mcp-server
npm start

# Terminal 3: Start Minecraft Server
cd /path/to/minecraft/server
./start.sh  # or your server start script
```

### 7. Connect an LLM Client

The MCP Server exposes the following tools to LLM clients:

- `execute_command` - Execute arbitrary Minecraft commands
- `send_message` - Send messages to players
- `teleport_player` - Teleport players to coordinates
- `give_item` - Give items to players
- `get_online_players` - List online players
- `get_player_info` - Get detailed player information
- `get_server_info` - Get server status
- `get_world_info` - Query blocks and entities in an area

## Project Structure

```
minecraft-mcp-bridge/
├── packages/
│   ├── shared/           # Shared TypeScript types
│   ├── mcp-server/       # MCP Server implementation
│   ├── bridge-server/    # WebSocket bridge server
│   └── minecraft-plugin/ # Minecraft NeoForge mod (Java)
├── .kiro/specs/          # Design specifications
├── PROTOCOL.md           # Message protocol documentation
└── README.md
```

## Configuration

### Bridge Server Configuration

See `packages/bridge-server/.env.example` for all available options.

Key settings:
- `PORT` - WebSocket server port (default: 8080)
- `MCP_AUTH_TOKENS` - Comma-separated list of valid MCP tokens
- `MINECRAFT_AUTH_TOKEN` - Token for Minecraft Mod authentication
- `MESSAGE_QUEUE_SIZE` - Max queued messages per client (default: 1000)
- `HEARTBEAT_INTERVAL` - Connection health check interval (default: 30000ms)

### MCP Server Configuration

See `packages/mcp-server/.env.example` for all available options.

Key settings:
- `BRIDGE_URL` - WebSocket URL of Bridge Server
- `AUTH_TOKEN` - Authentication token (must match one in Bridge Server's MCP_AUTH_TOKENS)
- `RECONNECT_ATTEMPTS` - Max reconnection attempts (default: 5)
- `RECONNECT_DELAY` - Initial reconnection delay (default: 1000ms)

### Minecraft Mod Configuration

See `packages/minecraft-plugin/minecraft-mcp-bridge.toml.example` for all available options.

Key settings:
- `bridge.url` - WebSocket URL of Bridge Server
- `bridge.auth_token` - Authentication token (must match Bridge Server's MINECRAFT_AUTH_TOKEN)
- `events.enabled` - List of event types to monitor
- `commands.allowed_patterns` - Regex patterns for allowed commands
- `security.max_command_length` - Maximum command length (default: 256)

## Development

### Building

```bash
# Build all TypeScript packages
npm run build

# Build Minecraft mod
cd packages/minecraft-plugin
./gradlew build
```

### Testing

```bash
# Run all TypeScript tests
npm test

# Run tests for specific package
cd packages/bridge-server
npm test

# Run Minecraft mod tests
cd packages/minecraft-plugin
./gradlew test
```

### Testing Frameworks

- **TypeScript packages**: Jest with ts-jest for unit tests, fast-check for property-based tests
- **Java mod**: JUnit for unit tests, jqwik for property-based tests

## Protocol Documentation

See [PROTOCOL.md](PROTOCOL.md) for detailed documentation of the message protocol and schemas.

## Security Considerations

### Production Deployment

1. **Use Strong Tokens**: Generate cryptographically secure random tokens for authentication
2. **Enable TLS**: Use `wss://` instead of `ws://` for WebSocket connections in production
3. **Restrict Commands**: Carefully configure `allowed_patterns` to only permit safe commands
4. **Network Isolation**: Run Bridge Server in a private network, only expose to MCP Server
5. **Firewall Rules**: Restrict access to Minecraft server and Bridge Server ports
6. **Monitor Logs**: Enable audit logging to track all command executions

### Command Whitelist Examples

```toml
# Safe patterns - only allow specific commands
allowed_patterns = [
    "^say .*",                                    # Allow chat messages
    "^tp \\w+ -?\\d+ -?\\d+ -?\\d+$",           # Allow teleport with coordinates
    "^give \\w+ minecraft:\\w+ \\d+$",          # Allow giving items
    "^time set (day|night)$",                    # Allow time changes
    "^weather (clear|rain|thunder)$",            # Allow weather changes
    "^gamemode (survival|creative) \\w+$"        # Allow gamemode changes
]

# DANGEROUS - avoid these patterns
# ".*"                    # Allows ANY command (never use this!)
# "^op .*"                # Allows granting operator status
# "^deop .*"              # Allows removing operator status
# "^stop$"                # Allows stopping the server
```

## Troubleshooting

### Connection Issues

**Problem**: MCP Server or Minecraft Mod can't connect to Bridge Server

**Solutions**:
- Verify Bridge Server is running and listening on the correct port
- Check authentication tokens match in all configurations
- Ensure firewall allows WebSocket connections on the configured port
- Check logs for authentication errors

### Command Execution Failures

**Problem**: Commands are rejected or fail to execute

**Solutions**:
- Verify command matches one of the `allowed_patterns` in Minecraft Mod config
- Check command length doesn't exceed `max_command_length`
- Ensure player names and coordinates are valid
- Review Minecraft Mod logs for detailed error messages

### Missing Events

**Problem**: Not receiving expected event notifications

**Solutions**:
- Verify event type is in the `enabled` list in Minecraft Mod config
- Check MCP Server subscription filters (default is all events)
- Ensure Minecraft Mod is connected to Bridge Server
- Review Bridge Server logs for message routing

### High Latency

**Problem**: Commands or events are slow

**Solutions**:
- Check network latency between components
- Reduce `MESSAGE_QUEUE_SIZE` if messages are backing up
- Increase `HEARTBEAT_INTERVAL` to reduce overhead
- Monitor CPU and memory usage on all components

## Performance

The system is designed for low latency:

- **Message Forwarding**: < 100ms from source to destination
- **Event Throughput**: Handles 100+ events per second
- **Command Execution**: Typically < 50ms for simple commands

## Contributing

See `.kiro/specs/minecraft-mcp-bridge/` for design specifications and implementation tasks.

## License

[Add your license here]

## Support

For issues and questions:
- Check [PROTOCOL.md](PROTOCOL.md) for message format details
- Review configuration examples in `.env.example` and `.toml.example` files
- Check component logs for detailed error messages
