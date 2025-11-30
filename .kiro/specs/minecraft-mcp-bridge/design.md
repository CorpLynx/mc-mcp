# Design Document

## Overview

The Minecraft MCP Bridge system enables Large Language Models to interact with Minecraft servers through the Model Context Protocol. The architecture consists of three loosely-coupled components:

1. **MCP Server** - A Node.js/TypeScript application implementing the MCP protocol, exposing Minecraft operations as tools and emitting game events as notifications
2. **Bridge Server** - A WebSocket-based relay service that maintains bidirectional communication between the MCP Server and Minecraft Mod
3. **Minecraft Mod** - A NeoForge mod written in Java that hooks into Minecraft events and executes commands

The system uses WebSocket for real-time bidirectional communication, JSON for message serialization, and follows event-driven architecture patterns.

## Architecture

### Component Diagram

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
                                                         │
                                                         │ NeoForge API
                                                         ▼
                                                  ┌──────────────┐
                                                  │  Minecraft   │
                                                  │   Server     │
                                                  └──────────────┘
```

### Communication Flow

**Event Flow (Minecraft → LLM):**
1. Minecraft event occurs (e.g., player joins)
2. Mod event listener captures event
3. Mod serializes event to JSON and sends via WebSocket to Bridge Server
4. Bridge Server forwards event to all connected MCP Server instances
5. MCP Server emits notification to subscribed LLM clients

**Command Flow (LLM → Minecraft):**
1. LLM client invokes MCP tool (e.g., `send_message`)
2. MCP Server validates request and forwards to Bridge Server via WebSocket
3. Bridge Server routes command to Minecraft Mod
4. Mod validates against allowed commands and executes on main server thread
5. Mod sends result back through Bridge Server to MCP Server
6. MCP Server returns result to LLM client

## Components and Interfaces

### MCP Server

**Technology:** Node.js with TypeScript, using `@modelcontextprotocol/sdk`

**Responsibilities:**
- Implement MCP protocol (tools, notifications, resources)
- Maintain WebSocket connection to Bridge Server
- Handle authentication and authorization
- Manage event subscriptions per client
- Validate tool invocations

**Exposed MCP Tools:**

```typescript
interface MCPTools {
  execute_command(command: string): Promise<CommandResult>
  send_message(message: string, target?: string): Promise<void>
  teleport_player(player: string, x: number, y: number, z: number, world?: string): Promise<void>
  give_item(player: string, item: string, quantity: number): Promise<void>
  get_online_players(): Promise<string[]>
  get_player_info(player: string): Promise<PlayerInfo>
  get_server_info(): Promise<ServerInfo>
  get_world_info(x: number, y: number, z: number, radius: number): Promise<WorldInfo>
}
```

**Configuration:**
```typescript
interface MCPServerConfig {
  bridgeUrl: string
  authToken: string
  reconnectAttempts: number
  reconnectDelay: number
  logLevel: string
}
```

### Bridge Server

**Technology:** Node.js with TypeScript, using `ws` library for WebSocket

**Responsibilities:**
- Accept WebSocket connections from MCP Server and Minecraft Mod
- Route messages between connected clients
- Handle connection lifecycle (connect, disconnect, reconnect)
- Implement message queuing for offline clients
- Provide health check endpoints

**Message Protocol:**

```typescript
interface BridgeMessage {
  version: string
  type: 'event' | 'command' | 'query' | 'response' | 'error'
  id: string  // correlation ID for request/response
  timestamp: number
  source: 'mcp' | 'minecraft'
  payload: unknown
}

interface EventMessage extends BridgeMessage {
  type: 'event'
  payload: GameEvent
}

interface CommandMessage extends BridgeMessage {
  type: 'command'
  payload: {
    command: string
    args: Record<string, unknown>
  }
}

interface ResponseMessage extends BridgeMessage {
  type: 'response'
  payload: {
    success: boolean
    data?: unknown
    error?: string
  }
}
```

**Configuration:**
```typescript
interface BridgeServerConfig {
  port: number
  mcpAuthTokens: string[]
  minecraftAuthToken: string
  messageQueueSize: number
  heartbeatInterval: number
  logLevel: string
}
```

### Minecraft Mod

**Technology:** Java with NeoForge API

**Responsibilities:**
- Register NeoForge event listeners
- Maintain WebSocket connection to Bridge Server
- Execute commands on main server thread
- Validate commands against whitelist
- Query server state

**Event Handlers:**

```java
public class EventHandler {
  @SubscribeEvent
  public void onPlayerJoin(PlayerEvent.PlayerLoggedInEvent event) { }
  
  @SubscribeEvent
  public void onPlayerQuit(PlayerEvent.PlayerLoggedOutEvent event) { }
  
  @SubscribeEvent
  public void onPlayerChat(ServerChatEvent event) { }
  
  @SubscribeEvent
  public void onPlayerDeath(LivingDeathEvent event) { }
  
  @SubscribeEvent
  public void onBlockBreak(BlockEvent.BreakEvent event) { }
}
```

**Command Executor:**

```java
public interface CommandExecutor {
  CommandResult executeCommand(String command);
  void sendMessage(String message, String target);
  void teleportPlayer(String player, Location location);
  void giveItem(String player, ItemStack item);
}
```

**Configuration (minecraft-mcp-bridge.toml):**
```toml
[bridge]
url = "ws://localhost:8080"
auth_token = "secret"
reconnect_attempts = 5
reconnect_delay = 5000

[events]
enabled = [
  "player_join",
  "player_quit",
  "player_chat",
  "player_death",
  "block_break"
]

[commands]
allowed_patterns = [
  "^say .*",
  "^tp \\w+ -?\\d+ -?\\d+ -?\\d+$",
  "^give \\w+ \\w+ \\d+$"
]

[security]
require_auth = true
max_command_length = 256

[logging]
level = "INFO"
```

## Data Models

### Game Events

```typescript
interface GameEvent {
  eventType: 'player_join' | 'player_quit' | 'player_chat' | 'player_death' | 'block_break'
  timestamp: number
  data: PlayerJoinEvent | PlayerQuitEvent | PlayerChatEvent | PlayerDeathEvent | BlockBreakEvent
}

interface PlayerJoinEvent {
  player: string
  uuid: string
}

interface PlayerQuitEvent {
  player: string
  uuid: string
}

interface PlayerChatEvent {
  player: string
  message: string
}

interface PlayerDeathEvent {
  player: string
  cause: string
  location: Location
  killer?: string
}

interface BlockBreakEvent {
  player: string
  blockType: string
  location: Location
}

interface Location {
  world: string
  x: number
  y: number
  z: number
}
```

### Server State

```typescript
interface PlayerInfo {
  name: string
  uuid: string
  health: number
  foodLevel: number
  location: Location
  gameMode: string
  inventory: ItemStack[]
}

interface ServerInfo {
  version: string
  onlinePlayers: number
  maxPlayers: number
  timeOfDay: number
  weather: string
  tps: number
}

interface WorldInfo {
  blocks: BlockInfo[]
  entities: EntityInfo[]
}

interface BlockInfo {
  type: string
  location: Location
}

interface EntityInfo {
  type: string
  location: Location
  name?: string
}

interface ItemStack {
  type: string
  quantity: number
  displayName?: string
}
```

### Command Results

```typescript
interface CommandResult {
  success: boolean
  message?: string
  error?: string
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Event Notification Properties

Property 1: Event notification completeness
*For any* game event (player join, quit, chat, death, block break), the emitted notification should contain all required fields specified for that event type (player name, timestamp, and event-specific data)
**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

### Command Execution Properties

Property 2: Command forwarding and execution
*For any* valid MCP tool invocation (execute_command, send_message, teleport_player, give_item), the command should be forwarded to the Minecraft Mod and executed, returning a success result
**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 3: Command failure error responses
*For any* command that fails execution, the MCP Server should return an error response containing a descriptive error message
**Validates: Requirements 2.5**

### Message Routing Properties

Property 4: Message forwarding latency
*For any* message sent through the Bridge Server (from MCP to Minecraft or Minecraft to MCP), the message should be forwarded to its destination within 100 milliseconds
**Validates: Requirements 3.4, 3.5**

Property 5: Message routing correctness
*For any* message received by the Bridge Server, the message should be routed to the correct destination based on its source and type
**Validates: Requirements 3.2**

### Configuration and Filtering Properties

Property 6: Event filtering by configuration
*For any* event that is not in the enabled events list, the Mod should not transmit the event to the Bridge Server
**Validates: Requirements 4.3**

Property 7: Command whitelist enforcement
*For any* command that does not match the allowed command patterns, the Mod should reject the command and return an error
**Validates: Requirements 4.4**

### Query Properties

Property 8: Player list query completeness
*For any* server state, invoking get_online_players should return a list containing exactly the names of all currently connected players
**Validates: Requirements 5.1**

Property 9: Player info query completeness
*For any* online player, invoking get_player_info should return an object containing health, location, inventory summary, and game mode
**Validates: Requirements 5.2**

Property 10: Server info query completeness
*For any* server state, invoking get_server_info should return an object containing version, time of day, weather, and player count
**Validates: Requirements 5.3**

Property 11: World info query completeness
*For any* coordinates and radius, invoking get_world_info should return block types and entities within the specified radius
**Validates: Requirements 5.4**

### Error Handling Properties

Property 12: Malformed message resilience
*For any* malformed or unparseable message, the receiving component should log the error and continue processing subsequent messages without crashing
**Validates: Requirements 7.3**

Property 13: Connection error recovery
*For any* connection error, the component should log the error details and attempt reconnection according to the configured retry policy
**Validates: Requirements 7.2**

### Logging Properties

Property 14: Component startup logging
*For any* component startup, the logs should contain the component version, configuration summary, and connection status
**Validates: Requirements 7.1**

Property 15: Command failure logging
*For any* failed command execution, the Minecraft Mod logs should contain the command text, error reason, and stack trace
**Validates: Requirements 7.4**

Property 16: Message forwarding audit logging
*For any* message forwarded by the Bridge Server, the logs should contain the message type, source, and destination
**Validates: Requirements 7.5**

### Subscription Properties

Property 17: Event subscription filtering
*For any* event and client subscription configuration, the event should be sent to the client if and only if the event type matches the client's subscription filter
**Validates: Requirements 8.2, 8.3**

### Authentication and Authorization Properties

Property 18: Authentication enforcement
*For any* connection attempt without a valid authentication token, the MCP Server should reject the connection with an authentication error
**Validates: Requirements 9.1, 9.2**

Property 19: Command authorization enforcement
*For any* command execution attempt, if the client lacks permission for that command type, the Bridge Server should reject the command and return an authorization error
**Validates: Requirements 9.3, 9.4**

### Protocol Versioning Properties

Property 20: Message schema version inclusion
*For any* message sent between components, the message should include a schema version number in the specified format
**Validates: Requirements 10.1**

Property 21: Schema validation enforcement
*For any* message that fails schema validation, the receiving component should reject the message and return a validation error
**Validates: Requirements 10.4**

Property 22: Version mismatch handling
*For any* message received with an unsupported schema version, the component should log a warning and attempt graceful degradation without crashing
**Validates: Requirements 10.2**

## Error Handling

### Error Categories

**Connection Errors:**
- WebSocket connection failures
- Network timeouts
- Authentication failures
- Handled by: Exponential backoff retry (5 attempts, starting at 1s, max 30s)

**Message Errors:**
- Malformed JSON
- Schema validation failures
- Unknown message types
- Handled by: Log error, send error response, continue processing

**Command Errors:**
- Invalid command syntax
- Command not whitelisted
- Player not found
- Insufficient permissions
- Handled by: Return error response with descriptive message

**Server Errors:**
- Minecraft server not responding
- Mod disabled
- Resource exhaustion
- Handled by: Log error, notify connected clients, attempt recovery

### Error Response Format

```typescript
interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}
```

### Error Codes

- `AUTH_FAILED` - Authentication token invalid or missing
- `PERMISSION_DENIED` - Client lacks permission for operation
- `INVALID_COMMAND` - Command syntax invalid or not whitelisted
- `PLAYER_NOT_FOUND` - Specified player is not online
- `CONNECTION_ERROR` - Network or WebSocket error
- `SCHEMA_ERROR` - Message failed schema validation
- `SERVER_ERROR` - Internal server error
- `TIMEOUT` - Operation exceeded timeout threshold

## Testing Strategy

### Unit Testing

**MCP Server Unit Tests:**
- Tool handler functions correctly parse and validate inputs
- Event serialization produces correct JSON structure
- Authentication middleware correctly validates tokens
- Subscription filtering logic correctly matches event types
- Error responses contain required fields

**Bridge Server Unit Tests:**
- Message routing logic selects correct destination
- Connection registry correctly tracks connected clients
- Message queue operations (enqueue, dequeue, overflow handling)
- Heartbeat mechanism detects dead connections
- Schema validation correctly identifies invalid messages

**Minecraft Mod Unit Tests:**
- Event listeners correctly extract event data
- Command executor correctly parses command strings
- Configuration loader correctly parses TOML
- Command whitelist matcher correctly validates patterns
- Player query functions return correct data structures

### Property-Based Testing

We will use **fast-check** for the MCP Server and Bridge Server (TypeScript/Node.js) and **jqwik** for the Minecraft Mod (Java).

Each property-based test should run a minimum of 100 iterations to ensure adequate coverage of the input space.

**Property Test Requirements:**
- Each correctness property from the design document must be implemented as a property-based test
- Each test must be tagged with a comment referencing the specific property: `// Feature: minecraft-mcp-bridge, Property N: [property text]`
- Tests should use smart generators that constrain inputs to valid ranges
- Tests should verify the property holds across randomly generated inputs

**Example Property Test Structure (TypeScript):**

```typescript
import fc from 'fast-check'

// Feature: minecraft-mcp-bridge, Property 1: Event notification completeness
test('all game events include required fields', () => {
  fc.assert(
    fc.property(
      gameEventArbitrary(),
      (event) => {
        const notification = serializeEvent(event)
        expect(notification).toHaveProperty('player')
        expect(notification).toHaveProperty('timestamp')
        // event-specific field checks
      }
    ),
    { numRuns: 100 }
  )
})
```

**Example Property Test Structure (Java with jqwik):**

```java
import net.jqwik.api.*;

// Feature: minecraft-mcp-bridge, Property 7: Command whitelist enforcement
class CommandValidationTest {
  @Property(tries = 100)
  void disallowedCommandsAreRejected(@ForAll("disallowedCommands") String command) {
    CommandResult result = commandExecutor.execute(command);
    Assertions.assertFalse(result.success);
    Assertions.assertTrue(result.error.contains("not allowed"));
  }
  
  @Provide
  Arbitrary<String> disallowedCommands() {
    return Arbitraries.strings().filter(cmd -> !matchesWhitelist(cmd));
  }
}
```

### Integration Testing

**End-to-End Flow Tests:**
- Start all three components (MCP Server, Bridge Server, Mod)
- Simulate game events and verify notifications reach MCP clients
- Invoke MCP tools and verify commands execute in Minecraft
- Test reconnection behavior by killing and restarting components
- Verify message ordering is preserved under load

**Performance Tests:**
- Measure message latency under various load conditions
- Verify system handles 100+ events per second
- Test memory usage with long-running connections
- Verify no message loss during reconnection

**Security Tests:**
- Verify authentication is enforced for all connections
- Test that unauthorized commands are rejected
- Verify command whitelist cannot be bypassed
- Test that malicious payloads are safely rejected

## Deployment Considerations

### MCP Server Deployment

- Deploy as a Node.js service (Docker container recommended)
- Requires environment variables: `BRIDGE_URL`, `AUTH_TOKEN`
- Expose MCP protocol on stdio or SSE endpoint
- Monitor: Connection status, message throughput, error rate

### Bridge Server Deployment

- Deploy as a standalone Node.js service (Docker container recommended)
- Requires environment variables: `PORT`, `MCP_AUTH_TOKENS`, `MINECRAFT_AUTH_TOKEN`
- Expose WebSocket endpoint on configured port
- Expose health check endpoint for monitoring
- Monitor: Active connections, message queue depth, latency

### Minecraft Mod Deployment

- Build as a JAR file using Gradle
- Install in Minecraft server `mods/` directory
- Configure via `config/minecraft-mcp-bridge.toml`
- Requires NeoForge server (Minecraft 1.20.1+)
- Monitor: Connection status, command execution rate, event rate

### Network Architecture

```
Internet
   │
   ├─► MCP Server (port 3000) ◄─── LLM Clients
   │
   └─► Bridge Server (port 8080)
          │
          └─► Minecraft Server (internal)
                 └─► Mod
```

**Security Recommendations:**
- Use TLS for all WebSocket connections in production
- Store authentication tokens in secure secret management
- Run Bridge Server in private network, expose only to MCP Server
- Use firewall rules to restrict Minecraft server access
- Implement rate limiting on Bridge Server to prevent abuse

## Technology Stack Summary

| Component | Language | Framework/Library | Protocol |
|-----------|----------|-------------------|----------|
| MCP Server | TypeScript | @modelcontextprotocol/sdk, ws | MCP, WebSocket |
| Bridge Server | TypeScript | ws, express | WebSocket, HTTP |
| Minecraft Mod | Java | NeoForge API | WebSocket, NeoForge |

## Future Enhancements

- Support for additional game events (entity spawn, world generation, etc.)
- Batch command execution for efficiency
- Persistent event history and replay
- Multi-server support (connect to multiple Minecraft servers)
- Web dashboard for monitoring and configuration
- Support for custom mod extensions
- Rate limiting and quota management per client
