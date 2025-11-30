# Minecraft MCP Bridge - Protocol Documentation

This document describes the message protocol and schemas used for communication between the three components of the Minecraft MCP Bridge system.

## Table of Contents

- [Overview](#overview)
- [Message Format](#message-format)
- [Message Types](#message-types)
- [Event Messages](#event-messages)
- [Command Messages](#command-messages)
- [Query Messages](#query-messages)
- [Response Messages](#response-messages)
- [Error Handling](#error-handling)
- [Protocol Versioning](#protocol-versioning)

## Overview

The Minecraft MCP Bridge uses a JSON-based message protocol over WebSocket connections. All messages follow a common structure with type-specific payloads.

### Communication Paths

```
MCP Server ←→ Bridge Server ←→ Minecraft Mod
```

- **MCP Server → Bridge Server**: Commands and queries
- **Bridge Server → MCP Server**: Events and responses
- **Minecraft Mod → Bridge Server**: Events and responses
- **Bridge Server → Minecraft Mod**: Commands and queries

## Message Format

All messages share a common base structure:

```typescript
interface BridgeMessage {
  version: string;           // Protocol version (e.g., "1.0.0")
  type: MessageType;         // Message type identifier
  id: string;                // Unique message ID (UUID v4)
  timestamp: number;         // Unix timestamp in milliseconds
  source: 'mcp' | 'minecraft'; // Message origin
  payload: unknown;          // Type-specific payload
}

type MessageType = 'event' | 'command' | 'query' | 'response' | 'error';
```

### Example Message

```json
{
  "version": "1.0.0",
  "type": "event",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": 1699564800000,
  "source": "minecraft",
  "payload": {
    "eventType": "player_join",
    "data": {
      "player": "Steve",
      "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5"
    }
  }
}
```

## Message Types

### Event Messages

Events are sent from the Minecraft Mod to the MCP Server (via Bridge Server) to notify about game occurrences.

```typescript
interface EventMessage extends BridgeMessage {
  type: 'event';
  source: 'minecraft';
  payload: GameEvent;
}

interface GameEvent {
  eventType: EventType;
  data: EventData;
}

type EventType = 
  | 'player_join'
  | 'player_quit'
  | 'player_chat'
  | 'player_death'
  | 'block_break';
```

#### Player Join Event

Emitted when a player joins the server.

```json
{
  "version": "1.0.0",
  "type": "event",
  "id": "uuid",
  "timestamp": 1699564800000,
  "source": "minecraft",
  "payload": {
    "eventType": "player_join",
    "data": {
      "player": "Steve",
      "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5"
    }
  }
}
```

#### Player Quit Event

Emitted when a player leaves the server.

```json
{
  "version": "1.0.0",
  "type": "event",
  "id": "uuid",
  "timestamp": 1699564800000,
  "source": "minecraft",
  "payload": {
    "eventType": "player_quit",
    "data": {
      "player": "Steve",
      "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5"
    }
  }
}
```

#### Player Chat Event

Emitted when a player sends a chat message.

```json
{
  "version": "1.0.0",
  "type": "event",
  "id": "uuid",
  "timestamp": 1699564800000,
  "source": "minecraft",
  "payload": {
    "eventType": "player_chat",
    "data": {
      "player": "Steve",
      "message": "Hello, world!"
    }
  }
}
```

#### Player Death Event

Emitted when a player dies.

```json
{
  "version": "1.0.0",
  "type": "event",
  "id": "uuid",
  "timestamp": 1699564800000,
  "source": "minecraft",
  "payload": {
    "eventType": "player_death",
    "data": {
      "player": "Steve",
      "cause": "Fell from a high place",
      "location": {
        "world": "world",
        "x": 100.5,
        "y": 64.0,
        "z": -200.3
      },
      "killer": null
    }
  }
}
```

#### Block Break Event

Emitted when a player breaks a block.

```json
{
  "version": "1.0.0",
  "type": "event",
  "id": "uuid",
  "timestamp": 1699564800000,
  "source": "minecraft",
  "payload": {
    "eventType": "block_break",
    "data": {
      "player": "Steve",
      "blockType": "minecraft:stone",
      "location": {
        "world": "world",
        "x": 100,
        "y": 64,
        "z": -200
      }
    }
  }
}
```

## Command Messages

Commands are sent from the MCP Server to the Minecraft Mod (via Bridge Server) to execute actions.

```typescript
interface CommandMessage extends BridgeMessage {
  type: 'command';
  source: 'mcp';
  payload: CommandPayload;
}

interface CommandPayload {
  command: string;
  args: Record<string, unknown>;
}
```

### Execute Command

Executes an arbitrary Minecraft server command.

```json
{
  "version": "1.0.0",
  "type": "command",
  "id": "uuid",
  "timestamp": 1699564800000,
  "source": "mcp",
  "payload": {
    "command": "execute_command",
    "args": {
      "command": "say Hello from the LLM!"
    }
  }
}
```

### Send Message

Sends a message to a player or broadcasts to all players.

```json
{
  "version": "1.0.0",
  "type": "command",
  "id": "uuid",
  "timestamp": 1699564800000,
  "source": "mcp",
  "payload": {
    "command": "send_message",
    "args": {
      "message": "Welcome to the server!",
      "target": "Steve"  // Optional: omit to broadcast to all
    }
  }
}
```

### Teleport Player

Teleports a player to specific coordinates.

```json
{
  "version": "1.0.0",
  "type": "command",
  "id": "uuid",
  "timestamp": 1699564800000,
  "source": "mcp",
  "payload": {
    "command": "teleport_player",
    "args": {
      "player": "Steve",
      "x": 100.5,
      "y": 64.0,
      "z": -200.3,
      "world": "world"  // Optional: defaults to player's current world
    }
  }
}
```

### Give Item

Gives items to a player's inventory.

```json
{
  "version": "1.0.0",
  "type": "command",
  "id": "uuid",
  "timestamp": 1699564800000,
  "source": "mcp",
  "payload": {
    "command": "give_item",
    "args": {
      "player": "Steve",
      "item": "minecraft:diamond",
      "quantity": 64
    }
  }
}
```

## Query Messages

Queries are sent from the MCP Server to the Minecraft Mod to retrieve server state information.

```typescript
interface QueryMessage extends BridgeMessage {
  type: 'query';
  source: 'mcp';
  payload: QueryPayload;
}

interface QueryPayload {
  query: string;
  args: Record<string, unknown>;
}
```

### Get Online Players

Retrieves a list of currently online players.

```json
{
  "version": "1.0.0",
  "type": "query",
  "id": "uuid",
  "timestamp": 1699564800000,
  "source": "mcp",
  "payload": {
    "query": "get_online_players",
    "args": {}
  }
}
```

### Get Player Info

Retrieves detailed information about a specific player.

```json
{
  "version": "1.0.0",
  "type": "query",
  "id": "uuid",
  "timestamp": 1699564800000,
  "source": "mcp",
  "payload": {
    "query": "get_player_info",
    "args": {
      "player": "Steve"
    }
  }
}
```

### Get Server Info

Retrieves general server information.

```json
{
  "version": "1.0.0",
  "type": "query",
  "id": "uuid",
  "timestamp": 1699564800000,
  "source": "mcp",
  "payload": {
    "query": "get_server_info",
    "args": {}
  }
}
```

### Get World Info

Retrieves information about blocks and entities in a specific area.

```json
{
  "version": "1.0.0",
  "type": "query",
  "id": "uuid",
  "timestamp": 1699564800000,
  "source": "mcp",
  "payload": {
    "query": "get_world_info",
    "args": {
      "x": 100,
      "y": 64,
      "z": -200,
      "radius": 10
    }
  }
}
```

## Response Messages

Responses are sent back to the originating component after processing a command or query.

```typescript
interface ResponseMessage extends BridgeMessage {
  type: 'response';
  payload: ResponsePayload;
}

interface ResponsePayload {
  success: boolean;
  data?: unknown;
  error?: string;
}
```

### Success Response

```json
{
  "version": "1.0.0",
  "type": "response",
  "id": "original-message-uuid",
  "timestamp": 1699564800000,
  "source": "minecraft",
  "payload": {
    "success": true,
    "data": {
      "players": ["Steve", "Alex", "Notch"]
    }
  }
}
```

### Player Info Response

```json
{
  "version": "1.0.0",
  "type": "response",
  "id": "original-message-uuid",
  "timestamp": 1699564800000,
  "source": "minecraft",
  "payload": {
    "success": true,
    "data": {
      "name": "Steve",
      "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
      "health": 20.0,
      "foodLevel": 20,
      "location": {
        "world": "world",
        "x": 100.5,
        "y": 64.0,
        "z": -200.3
      },
      "gameMode": "SURVIVAL",
      "inventory": [
        {
          "type": "minecraft:diamond_sword",
          "quantity": 1,
          "displayName": "Legendary Sword"
        },
        {
          "type": "minecraft:bread",
          "quantity": 32
        }
      ]
    }
  }
}
```

### Server Info Response

```json
{
  "version": "1.0.0",
  "type": "response",
  "id": "original-message-uuid",
  "timestamp": 1699564800000,
  "source": "minecraft",
  "payload": {
    "success": true,
    "data": {
      "version": "1.20.1",
      "onlinePlayers": 3,
      "maxPlayers": 20,
      "timeOfDay": 6000,
      "weather": "CLEAR",
      "tps": 20.0
    }
  }
}
```

### World Info Response

```json
{
  "version": "1.0.0",
  "type": "response",
  "id": "original-message-uuid",
  "timestamp": 1699564800000,
  "source": "minecraft",
  "payload": {
    "success": true,
    "data": {
      "blocks": [
        {
          "type": "minecraft:stone",
          "location": { "world": "world", "x": 100, "y": 64, "z": -200 }
        },
        {
          "type": "minecraft:grass_block",
          "location": { "world": "world", "x": 101, "y": 64, "z": -200 }
        }
      ],
      "entities": [
        {
          "type": "minecraft:cow",
          "location": { "world": "world", "x": 105.5, "y": 64.0, "z": -195.3 },
          "name": null
        },
        {
          "type": "minecraft:player",
          "location": { "world": "world", "x": 100.5, "y": 64.0, "z": -200.3 },
          "name": "Steve"
        }
      ]
    }
  }
}
```

## Error Handling

Error messages are sent when a command or query fails.

```typescript
interface ErrorMessage extends BridgeMessage {
  type: 'error';
  payload: ErrorPayload;
}

interface ErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `AUTH_FAILED` | Authentication token invalid or missing |
| `PERMISSION_DENIED` | Client lacks permission for operation |
| `INVALID_COMMAND` | Command syntax invalid or not whitelisted |
| `PLAYER_NOT_FOUND` | Specified player is not online |
| `CONNECTION_ERROR` | Network or WebSocket error |
| `SCHEMA_ERROR` | Message failed schema validation |
| `SERVER_ERROR` | Internal server error |
| `TIMEOUT` | Operation exceeded timeout threshold |
| `INVALID_ARGS` | Command or query arguments are invalid |

### Error Response Examples

#### Authentication Error

```json
{
  "version": "1.0.0",
  "type": "error",
  "id": "original-message-uuid",
  "timestamp": 1699564800000,
  "source": "minecraft",
  "payload": {
    "code": "AUTH_FAILED",
    "message": "Invalid authentication token",
    "details": {}
  }
}
```

#### Command Not Allowed

```json
{
  "version": "1.0.0",
  "type": "error",
  "id": "original-message-uuid",
  "timestamp": 1699564800000,
  "source": "minecraft",
  "payload": {
    "code": "PERMISSION_DENIED",
    "message": "Command 'op Steve' is not in the allowed command patterns",
    "details": {
      "command": "op Steve"
    }
  }
}
```

#### Player Not Found

```json
{
  "version": "1.0.0",
  "type": "error",
  "id": "original-message-uuid",
  "timestamp": 1699564800000,
  "source": "minecraft",
  "payload": {
    "code": "PLAYER_NOT_FOUND",
    "message": "Player 'Herobrine' is not online",
    "details": {
      "player": "Herobrine"
    }
  }
}
```

#### Schema Validation Error

```json
{
  "version": "1.0.0",
  "type": "error",
  "id": "original-message-uuid",
  "timestamp": 1699564800000,
  "source": "minecraft",
  "payload": {
    "code": "SCHEMA_ERROR",
    "message": "Message failed schema validation: missing required field 'command'",
    "details": {
      "field": "command",
      "reason": "required field missing"
    }
  }
}
```

## Protocol Versioning

The protocol uses semantic versioning (MAJOR.MINOR.PATCH) in the `version` field of all messages.

### Version Compatibility

- **MAJOR**: Incompatible changes that break existing implementations
- **MINOR**: Backward-compatible new features
- **PATCH**: Backward-compatible bug fixes

### Version Negotiation

When a component connects to the Bridge Server, it should:

1. Send its supported protocol version in the first message
2. The Bridge Server responds with the negotiated version (highest mutually supported)
3. All subsequent messages use the negotiated version

### Handling Version Mismatches

- If a component receives a message with an unsupported MAJOR version, it should log a warning and close the connection
- If a component receives a message with an unsupported MINOR version, it should attempt graceful degradation (ignore unknown fields)
- PATCH version differences should not affect compatibility

### Current Version

The current protocol version is **1.0.0**.

## Data Type Definitions

### Location

```typescript
interface Location {
  world: string;   // World name (e.g., "world", "world_nether", "world_the_end")
  x: number;       // X coordinate
  y: number;       // Y coordinate
  z: number;       // Z coordinate
}
```

### ItemStack

```typescript
interface ItemStack {
  type: string;          // Item type (e.g., "minecraft:diamond_sword")
  quantity: number;      // Stack size (1-64 for most items)
  displayName?: string;  // Custom display name (optional)
}
```

## Best Practices

### Message IDs

- Use UUID v4 for message IDs
- Response messages should use the same ID as the request they're responding to
- This enables request-response correlation

### Timestamps

- Always use Unix timestamps in milliseconds
- Set timestamp when the message is created, not when it's sent
- This helps with latency measurement and debugging

### Error Handling

- Always include descriptive error messages
- Use appropriate error codes for different failure scenarios
- Include relevant details in the `details` field to aid debugging

### Performance

- Keep message payloads as small as possible
- Avoid sending unnecessary data in responses
- Use event filtering to reduce network traffic

### Security

- Never include sensitive data (passwords, tokens) in message payloads
- Validate all incoming messages against the schema
- Enforce authentication and authorization at the Bridge Server level
