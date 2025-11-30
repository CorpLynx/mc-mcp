# Subscription Filtering

## Overview

The MCP Server implements subscription filtering to allow LLM clients to control which Minecraft game events they receive. This feature satisfies Requirements 8.1-8.5 from the design specification.

## Architecture

The subscription system is implemented with the following components:

1. **Subscription State**: A `Set<GameEventType>` that tracks which event types the client wants to receive
   - `null` = subscribe to all events (default behavior)
   - Non-null Set = subscribe only to events in the set

2. **Event Filtering**: The `handleGameEvent()` function checks subscriptions before emitting notifications

3. **Subscription Management**: The `subscribe_events` MCP tool allows clients to update their subscriptions dynamically

## Requirements Mapping

### Requirement 8.1: Initial Subscription
**WHEN the LLM client connects to the MCP Server THEN the client SHALL specify which event types to subscribe to**

- Clients can call the `subscribe_events` tool at any time after connection
- The tool accepts an array of event types to subscribe to

### Requirement 8.2: Matching Events
**WHEN an event occurs that matches a client's subscription THEN the MCP Server SHALL send the event to that client**

- Implemented in `handleGameEvent()`: `currentSubscription.has(event.eventType)`
- Events matching the subscription are serialized and sent as MCP notifications

### Requirement 8.3: Non-Matching Events
**WHEN an event occurs that does not match any client subscriptions THEN the MCP Server SHALL not send the event to any client**

- Implemented in `handleGameEvent()`: Events are filtered out if not in subscription
- Filtered events are logged at debug level for troubleshooting

### Requirement 8.4: Dynamic Updates
**WHEN a client updates its subscription list THEN the MCP Server SHALL apply the new filters to subsequent events**

- The `subscribe_events` tool can be called multiple times
- Each call replaces the previous subscription
- Changes take effect immediately for all subsequent events

### Requirement 8.5: Default Behavior
**WHERE no subscription filter is specified THEN the MCP Server SHALL send all events to the client by default**

- Initial state: `currentSubscription = null`
- When null, all events pass the filter
- Clients can return to this state by calling `subscribe_events` with an empty array

## Usage

### Subscribe to Specific Events

```json
{
  "tool": "subscribe_events",
  "arguments": {
    "eventTypes": ["player_join", "player_quit", "player_chat"]
  }
}
```

Response:
```json
{
  "success": true,
  "message": "Subscribed to: player_join, player_quit, player_chat"
}
```

### Subscribe to All Events

```json
{
  "tool": "subscribe_events",
  "arguments": {
    "eventTypes": []
  }
}
```

Response:
```json
{
  "success": true,
  "message": "Subscribed to all events"
}
```

### Update Subscription

Simply call `subscribe_events` again with a new list:

```json
{
  "tool": "subscribe_events",
  "arguments": {
    "eventTypes": ["block_break", "player_death"]
  }
}
```

## Valid Event Types

The following event types are supported:

- `player_join` - Player joins the server
- `player_quit` - Player leaves the server
- `player_chat` - Player sends a chat message
- `player_death` - Player dies
- `block_break` - Player breaks a block

## Error Handling

### Invalid Event Types

If an invalid event type is provided, the subscription will fail:

```json
{
  "tool": "subscribe_events",
  "arguments": {
    "eventTypes": ["invalid_event"]
  }
}
```

Response:
```json
{
  "success": false,
  "message": "Invalid event types: invalid_event. Valid types are: player_join, player_quit, player_chat, player_death, block_break"
}
```

## Implementation Details

### Event Filtering Logic

```typescript
function handleGameEvent(event: GameEvent): void {
  // If currentSubscription is null, send all events (default behavior - Requirement 8.5)
  // If currentSubscription is set, only send events that match the subscription (Requirement 8.2, 8.3)
  const shouldSendEvent = currentSubscription === null || currentSubscription.has(event.eventType);
  
  if (shouldSendEvent) {
    // Serialize and send event
    const notification = serializeEventToNotification(event);
    server.notification({
      method: 'notifications/minecraft/event',
      params: notification
    });
    logger.debug(`Event notification sent: ${event.eventType}`);
  } else {
    logger.debug(`Event filtered out: ${event.eventType} (not in subscription)`);
  }
}
```

### Subscription Handler

```typescript
function handleSubscribeEvents(args: { eventTypes: GameEventType[] }): { success: boolean; message: string } {
  // Validate event types
  const validEventTypes: GameEventType[] = ['player_join', 'player_quit', 'player_chat', 'player_death', 'block_break'];
  const invalidTypes = args.eventTypes.filter(type => !validEventTypes.includes(type));
  
  if (invalidTypes.length > 0) {
    logger.warn(`Invalid event types in subscription: ${invalidTypes.join(', ')}`);
    return {
      success: false,
      message: `Invalid event types: ${invalidTypes.join(', ')}. Valid types are: ${validEventTypes.join(', ')}`
    };
  }
  
  if (args.eventTypes.length === 0) {
    // Empty array means subscribe to all events (Requirement 8.5)
    currentSubscription = null;
    logger.info('Client subscribed to all events');
    return {
      success: true,
      message: 'Subscribed to all events'
    };
  } else {
    // Subscribe to specific event types (Requirement 8.1, 8.4)
    currentSubscription = new Set(args.eventTypes);
    logger.info(`Client subscribed to events: ${args.eventTypes.join(', ')}`);
    return {
      success: true,
      message: `Subscribed to: ${args.eventTypes.join(', ')}`
    };
  }
}
```

## Logging

The subscription system logs the following events:

- **INFO**: Subscription changes (what events the client subscribed to)
- **DEBUG**: Event notifications sent and filtered events
- **WARN**: Invalid event types in subscription requests

## Testing

See `subscription.test.ts` for comprehensive unit tests covering:

- Default behavior (all events)
- Subscribing to specific events
- Dynamic subscription updates
- Event filtering logic
- Invalid event type handling
- Edge cases

## Notes

- The MCP Server runs one instance per client (stdio transport), so subscription state is per-instance
- Subscriptions are not persisted; they reset when the server restarts
- The subscription filter applies only to event notifications, not to query responses
- Clients can check their current subscription by examining the response from `subscribe_events`
