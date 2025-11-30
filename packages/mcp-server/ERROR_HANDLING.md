# Error Handling Implementation (Task 4.7)

## Overview
This document describes the error handling improvements implemented for command execution in the MCP Server.

## Implementation Details

### 1. Parse Error Responses from Bridge Server

**Location:** `packages/mcp-server/src/bridge-client.ts`

Added `parseErrorResponse()` method that:
- Handles structured error responses with error codes and messages
- Formats errors as `[ERROR_CODE] message (details)`
- Falls back to simple string messages when structure is not available
- Handles both `response` type messages with errors and dedicated `error` type messages

**Error Format:**
```typescript
{
  code: 'ERROR_CODE',
  message: 'Descriptive error message',
  details?: { ... }
}
```

**Supported Error Codes:**
- `AUTH_FAILED` - Authentication token invalid or missing
- `PERMISSION_DENIED` - Client lacks permission for operation
- `INVALID_COMMAND` - Command syntax invalid or not whitelisted
- `PLAYER_NOT_FOUND` - Specified player is not online
- `CONNECTION_ERROR` - Network or WebSocket error
- `SCHEMA_ERROR` - Message failed schema validation
- `SERVER_ERROR` - Internal server error
- `TIMEOUT` - Operation exceeded timeout threshold

### 2. Return Descriptive Error Messages to LLM Clients

**Location:** `packages/mcp-server/src/index.ts`

Enhanced all command handlers to provide context-rich error messages:

**Command Handlers:**
- `handleExecuteCommand()` - Includes the command that failed
- `handleSendMessage()` - Includes target player or broadcast indication
- `handleTeleportPlayer()` - Includes player name, coordinates, and world
- `handleGiveItem()` - Includes item type, quantity, and player name
- `handleLightningStrike()` - Includes coordinates and world
- `handleSetTime()` - Includes time value and world
- `handleSpawnEntity()` - Includes entity type, count, coordinates, and world

**Query Handlers:**
- `handleGetOnlinePlayers()` - Clear error message for list retrieval
- `handleGetPlayerInfo()` - Includes player name in error
- `handleGetServerInfo()` - Clear error message for server info
- `handleGetWorldInfo()` - Includes coordinates and radius in error

**Error Message Format:**
```
Failed to [action] [context]: [original error message]
```

**Examples:**
- `Failed to execute command 'say Hello': [TIMEOUT] Request timed out after 30 seconds`
- `Failed to teleport player 'Steve' to coordinates (100, 64, 200): [PLAYER_NOT_FOUND] Player Steve is not online`
- `Failed to give 64x 'diamond' to player 'Steve': [CONNECTION_ERROR] Not connected to Bridge Server`

### 3. Handle Timeout Scenarios

**Location:** `packages/mcp-server/src/bridge-client.ts`

Enhanced timeout handling in `sendMessage()` method:
- Timeout set to 30 seconds for all requests
- Timeout errors include error code `[TIMEOUT]`
- Timeout errors include context: request type and payload preview (first 100 chars)
- Proper cleanup of pending requests on timeout

**Timeout Error Format:**
```
[TIMEOUT] Request timed out after 30 seconds (type: command, payload: {...})
```

### 4. Enhanced Logging

All error handlers now log errors with context before returning to the client:
- Command failures log the command details
- Query failures log the query parameters
- Connection errors log connection state

## Testing

Added comprehensive unit tests in `packages/mcp-server/src/command-execution.test.ts`:

1. **Structured Error Response Test** - Verifies parsing of error codes and messages
2. **Connection Error Test** - Verifies connection error handling
3. **Timeout Error Test** - Verifies timeout error with context
4. **Invalid Command Test** - Verifies command validation errors
5. **Permission Denied Test** - Verifies authorization errors

## Requirements Validation

This implementation satisfies **Requirement 2.5**:
> WHEN a command execution fails THEN the MCP Server SHALL return an error response with a descriptive message

**How it's satisfied:**
- All command handlers catch errors and return `CommandResult` with `success: false` and descriptive `error` field
- Error messages include context about what operation failed and why
- Structured error codes from Bridge Server are preserved and formatted
- Timeout scenarios are handled with specific error messages
- All errors are logged for debugging and monitoring

## Error Flow

```
1. LLM Client invokes MCP tool
2. MCP Server validates and forwards to Bridge Client
3. Bridge Client sends message via WebSocket
4. If error occurs:
   a. Bridge Server returns error response OR
   b. Connection fails OR
   c. Request times out
5. Bridge Client parses error and rejects promise
6. Command handler catches error
7. Command handler logs error with context
8. Command handler returns CommandResult with descriptive error
9. MCP Server returns error to LLM Client
```

## Example Error Scenarios

### Scenario 1: Player Not Found
```typescript
// LLM invokes: teleport_player("NonExistentPlayer", 100, 64, 200)
// Bridge Server returns: { success: false, error: { code: "PLAYER_NOT_FOUND", message: "Player NonExistentPlayer is not online" } }
// MCP Server returns: { success: false, error: "Failed to teleport player 'NonExistentPlayer' to coordinates (100, 64, 200): [PLAYER_NOT_FOUND] Player NonExistentPlayer is not online" }
```

### Scenario 2: Connection Timeout
```typescript
// LLM invokes: execute_command("say Hello")
// Bridge Client times out after 30 seconds
// MCP Server returns: { success: false, error: "Failed to execute command 'say Hello': [TIMEOUT] Request timed out after 30 seconds (type: command, payload: {\"command\":\"execute_command\"})" }
```

### Scenario 3: Invalid Command
```typescript
// LLM invokes: execute_command("op Steve")
// Bridge Server returns: { success: false, error: { code: "INVALID_COMMAND", message: "Command not whitelisted" } }
// MCP Server returns: { success: false, error: "Failed to execute command 'op Steve': [INVALID_COMMAND] Command not whitelisted" }
```

## Future Enhancements

1. Add retry logic for transient errors
2. Implement circuit breaker pattern for repeated failures
3. Add metrics collection for error rates
4. Implement error categorization for better client handling
5. Add user-friendly error suggestions (e.g., "Did you mean...?")
