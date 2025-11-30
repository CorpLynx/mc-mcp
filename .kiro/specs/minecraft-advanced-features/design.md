# Design Document

## Overview

This design extends the Minecraft MCP Bridge system with advanced features for world manipulation, entity management, player effects, enhanced event monitoring, batch operations, and persistent state tracking. The design maintains the existing three-component architecture while adding new capabilities to each component.

The enhancements focus on:
1. **World Manipulation** - Direct block operations and region modifications
2. **Entity Control** - Comprehensive entity lifecycle management
3. **Player Effects** - Potion effects and attribute modifications
4. **Enhanced Events** - Broader event coverage for better context awareness
5. **Batch Processing** - Efficient multi-command execution
6. **State Persistence** - Historical tracking and audit capabilities

## Architecture

### Enhanced Component Diagram

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│             │  MCP    │              │  WS     │              │
│ LLM Client  │◄───────►│  MCP Server  │◄───────►│    Bridge    │
│             │         │  + Advanced  │         │    Server    │
│             │         │    Tools     │         │  + History   │
└─────────────┘         └──────────────┘         │  + Audit Log │
                                                  └──────┬───────┘
                                                         │ WS
                                                         ▼
                                                  ┌──────────────┐
                                                  │  Minecraft   │
                                                  │     Mod      │
                                                  │  + Block Ops │
                                                  │  + Entity    │
                                                  │  + Effects   │
                                                  │  + Events    │
                                                  └──────┬───────┘
                                                         │ NeoForge API
                                                         ▼
                                                  ┌──────────────┐
                                                  │  Minecraft   │
                                                  │   Server     │
                                                  └──────────────┘
```

### Data Flow for Advanced Operations

**Block Operation Flow:**
1. LLM invokes block manipulation tool (place_block, fill_region, etc.)
2. MCP Server validates parameters and forwards to Bridge Server
3. Bridge Server routes to Minecraft Mod
4. Mod validates against configuration limits
5. Mod executes operation on main thread (or chunked for large operations)
6. Result returned through chain

**Event History Flow:**
1. Game event occurs in Minecraft
2. Mod sends event to Bridge Server
3. Bridge Server stores event in history database
4. Bridge Server forwards to MCP Server
5. MCP Server emits notification to LLM clients

**Batch Operation Flow:**
1. LLM invokes execute_batch with command list
2. MCP Server validates batch size
3. Bridge Server queues batch for sequential processing
4. Mod executes commands one by one
5. Results collected and returned as array

## Components and Interfaces

### MCP Server Enhancements

**New MCP Tools:**

```typescript
interface AdvancedMCPTools {
  // Block Manipulation
  place_block(x: number, y: number, z: number, blockType: string, world?: string): Promise<CommandResult>
  break_block(x: number, y: number, z: number, world?: string): Promise<CommandResult>
  fill_region(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, blockType: string, world?: string): Promise<CommandResult>
  replace_blocks(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, sourceBlock: string, targetBlock: string, world?: string): Promise<CommandResult>
  
  // Biome Information
  get_biome(x: number, y: number, z: number, world?: string): Promise<BiomeInfo>
  find_biomes(biomeType: string, centerX: number, centerZ: number, radius: number, world?: string): Promise<BiomeLocation[]>
  
  // Entity Management
  spawn_entity(entityType: string, x: number, y: number, z: number, count?: number, world?: string): Promise<CommandResult>
  remove_entities(entityType: string, x: number, y: number, z: number, radius: number, world?: string): Promise<CommandResult>
  get_entities(x: number, y: number, z: number, radius: number, world?: string): Promise<EntityInfo[]>
  modify_entity(entityId: string, attributes: Record<string, unknown>): Promise<CommandResult>
  
  // Player Effects
  apply_effect(player: string, effectType: string, duration: number, amplifier: number): Promise<CommandResult>
  remove_effect(player: string, effectType: string): Promise<CommandResult>
  clear_effects(player: string): Promise<CommandResult>
  get_player_effects(player: string): Promise<EffectInfo[]>
  modify_player_attribute(player: string, attribute: string, value: number): Promise<CommandResult>
  
  // Batch Operations
  execute_batch(commands: BatchCommand[]): Promise<BatchResult>
  execute_batch_atomic(commands: BatchCommand[]): Promise<BatchResult>
  schedule_command(command: string, delayTicks: number): Promise<CommandResult>
  
  // History and State
  get_command_history(startTime: number, endTime: number, executor?: string): Promise<CommandHistoryEntry[]>
  get_event_history(eventType: string, startTime: number, endTime: number): Promise<GameEvent[]>
  get_player_session(player: string): Promise<PlayerSession>
  create_world_snapshot(description: string): Promise<SnapshotInfo>
  list_snapshots(): Promise<SnapshotInfo[]>
}
```

### Bridge Server Enhancements

**History Storage:**

```typescript
interface HistoryManager {
  storeCommand(command: CommandHistoryEntry): Promise<void>
  storeEvent(event: GameEvent): Promise<void>
  queryCommands(filter: CommandFilter): Promise<CommandHistoryEntry[]>
  queryEvents(filter: EventFilter): Promise<GameEvent[]>
  purgeOldEntries(retentionPeriod: number): Promise<void>
}

interface CommandHistoryEntry {
  id: string
  timestamp: number
  executor: string  // 'mcp' or player name
  command: string
  args: Record<string, unknown>
  result: CommandResult
  duration: number
}

interface EventFilter {
  eventType?: string
  startTime: number
  endTime: number
  limit?: number
}

interface CommandFilter {
  executor?: string
  startTime: number
  endTime: number
  limit?: number
}
```

**Configuration:**

```typescript
interface BridgeServerAdvancedConfig extends BridgeServerConfig {
  historyRetentionDays: number
  maxHistorySize: number
  maxBatchSize: number
  enableEventHistory: boolean
  enableCommandAudit: boolean
  historyDatabasePath: string
}
```

### Minecraft Mod Enhancements

**Block Operations Handler:**

```java
public class BlockOperationsHandler {
  CommandResult placeBlock(Location location, BlockType blockType);
  CommandResult breakBlock(Location location);
  CommandResult fillRegion(Location corner1, Location corner2, BlockType blockType);
  CommandResult replaceBlocks(Location corner1, Location corner2, BlockType source, BlockType target);
  
  // Chunked processing for large operations
  void processLargeOperation(BlockOperation operation, int blocksPerTick);
}
```

**Entity Manager:**

```java
public class EntityManager {
  CommandResult spawnEntity(EntityType type, Location location, int count);
  CommandResult removeEntities(EntityType type, Location center, double radius);
  List<EntityInfo> getEntities(Location center, double radius);
  CommandResult modifyEntity(UUID entityId, Map<String, Object> attributes);
}
```

**Effects Handler:**

```java
public class EffectsHandler {
  CommandResult applyEffect(ServerPlayer player, MobEffect effect, int duration, int amplifier);
  CommandResult removeEffect(ServerPlayer player, MobEffect effect);
  CommandResult clearEffects(ServerPlayer player);
  List<EffectInfo> getPlayerEffects(ServerPlayer player);
  CommandResult modifyPlayerAttribute(ServerPlayer player, Attribute attribute, double value);
}
```

**Enhanced Event Listeners:**

```java
public class AdvancedEventHandler extends EventHandler {
  @SubscribeEvent
  public void onEntitySpawn(EntityJoinLevelEvent event) { }
  
  @SubscribeEvent
  public void onEntityDeath(LivingDeathEvent event) { }
  
  @SubscribeEvent
  public void onBlockPlace(BlockEvent.EntityPlaceEvent event) { }
  
  @SubscribeEvent
  public void onItemPickup(EntityItemPickupEvent event) { }
  
  @SubscribeEvent
  public void onItemDrop(ItemTossEvent event) { }
  
  @SubscribeEvent
  public void onAdvancement(AdvancementEvent.AdvancementEarnEvent event) { }
  
  @SubscribeEvent
  public void onChunkLoad(ChunkEvent.Load event) { }
  
  @SubscribeEvent
  public void onChunkUnload(ChunkEvent.Unload event) { }
}
```

**Batch Executor:**

```java
public class BatchExecutor {
  BatchResult executeBatch(List<BatchCommand> commands, boolean atomic);
  void scheduleCommand(String command, int delayTicks);
  
  // Transaction support for atomic batches
  void beginTransaction();
  void commitTransaction();
  void rollbackTransaction();
}
```

**Configuration (minecraft-mcp-bridge.toml):**

```toml
[limits]
max_batch_size = 50
max_region_volume = 100000  # blocks
max_entity_spawn_count = 100
max_fill_blocks_per_tick = 1000

[events]
enabled = [
  "player_join",
  "player_quit",
  "player_chat",
  "player_death",
  "block_break",
  "block_place",
  "entity_spawn",
  "entity_death",
  "item_pickup",
  "item_drop",
  "advancement",
  "chunk_load",
  "chunk_unload"
]

[history]
enable_snapshots = true
snapshot_directory = "world_snapshots"
max_snapshots = 10

[performance]
chunk_large_operations = true
blocks_per_tick = 1000
throttle_on_high_load = true
max_tps_threshold = 15.0
```

## Data Models

### Block Operations

```typescript
interface BlockOperation {
  type: 'place' | 'break' | 'fill' | 'replace'
  location: Location | Region
  blockType?: string
  sourceBlock?: string
  targetBlock?: string
}

interface Region {
  world: string
  x1: number
  y1: number
  z1: number
  x2: number
  y2: number
  z2: number
}
```

### Biome Information

```typescript
interface BiomeInfo {
  name: string
  temperature: number
  humidity: number
  precipitation: string  // 'none' | 'rain' | 'snow'
  category: string
}

interface BiomeLocation {
  biome: string
  x: number
  z: number
  distance: number
}
```

### Entity Information

```typescript
interface EntityInfo {
  id: string
  type: string
  location: Location
  health?: number
  maxHealth?: number
  velocity?: Vector3
  customName?: string
  passengers?: string[]
  attributes: Record<string, unknown>
}

interface Vector3 {
  x: number
  y: number
  z: number
}
```

### Effect Information

```typescript
interface EffectInfo {
  type: string
  duration: number  // ticks remaining
  amplifier: number
  ambient: boolean
  visible: boolean
  source?: string
}
```

### Advanced Events

```typescript
interface EntitySpawnEvent {
  entityType: string
  location: Location
  spawnReason: string
  uuid: string
}

interface EntityDeathEvent {
  entityType: string
  location: Location
  deathCause: string
  killer?: string
  uuid: string
}

interface BlockPlaceEvent {
  player: string
  blockType: string
  location: Location
  replacedBlock: string
}

interface ItemPickupEvent {
  player: string
  itemType: string
  quantity: number
  location: Location
}

interface ItemDropEvent {
  player: string
  itemType: string
  quantity: number
  location: Location
}

interface AdvancementEvent {
  player: string
  advancement: string
  title: string
  description: string
}

interface ChunkEvent {
  x: number
  z: number
  world: string
}
```

### Batch Operations

```typescript
interface BatchCommand {
  command: string
  args: Record<string, unknown>
}

interface BatchResult {
  success: boolean
  results: CommandResult[]
  failedIndex?: number
  totalDuration: number
}
```

### Session and History

```typescript
interface PlayerSession {
  player: string
  uuid: string
  currentSession: {
    joinTime: number
    duration: number
    isOnline: boolean
  }
  totalPlayTime: number
  sessionCount: number
  lastSeen: number
}

interface SnapshotInfo {
  id: string
  timestamp: number
  description: string
  worldName: string
  playerCount: number
  size: number  // bytes
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Block Manipulation Properties

Property 1: Block placement correctness
*For any* valid coordinates and block type, placing a block should result in that block type existing at those coordinates
**Validates: Requirements 1.1**

Property 2: Block break round-trip
*For any* block at valid coordinates, placing then breaking the block should return the location to its original state
**Validates: Requirements 1.2**

Property 3: Region fill completeness
*For any* valid rectangular region and block type, after filling, all blocks within the region should be of the specified type
**Validates: Requirements 1.3**

Property 4: Block replacement correctness
*For any* region with source blocks, after replacement, the region should contain no source blocks and target blocks should exist where source blocks were
**Validates: Requirements 1.4**

### Biome Query Properties

Property 5: Biome query validity
*For any* coordinates in loaded chunks, querying the biome should return a valid biome name from the Minecraft biome registry
**Validates: Requirements 2.1**

Property 6: Biome search accuracy
*For any* biome search result, all returned coordinates should actually contain the specified biome type when queried individually
**Validates: Requirements 2.2**

### Entity Management Properties

Property 7: Entity spawn verification
*For any* valid entity type and coordinates, after spawning, querying entities at those coordinates should include an entity of the specified type
**Validates: Requirements 3.1**

Property 8: Entity removal completeness
*For any* entity type and location, after removing entities of that type within a radius, querying for entities of that type in the same radius should return an empty list
**Validates: Requirements 3.2**

Property 9: Entity query completeness
*For any* location and radius, all returned entities should be within the specified radius and include required fields (type, location, properties)
**Validates: Requirements 3.3**

Property 10: Entity modification persistence
*For any* entity and attribute modification, querying the entity after modification should reflect the updated attribute values
**Validates: Requirements 3.4**

### Player Effects Properties

Property 11: Effect application verification
*For any* valid player and effect type, after applying an effect, querying player effects should include the applied effect with correct duration and amplifier
**Validates: Requirements 4.1**

Property 12: Effect removal verification
*For any* player with an active effect, after removing that effect, querying player effects should not include the removed effect
**Validates: Requirements 4.2**

Property 13: Effect clearing completeness
*For any* player with active effects, after clearing effects, querying player effects should return an empty list
**Validates: Requirements 4.3**

Property 14: Player effects query completeness
*For any* player, all returned effects should include required fields (type, duration, amplifier)
**Validates: Requirements 4.4**

Property 15: Player attribute modification persistence
*For any* player and attribute modification, querying player info after modification should reflect the updated attribute value
**Validates: Requirements 4.5**

### Advanced Event Notification Properties

Property 16: Entity spawn event completeness
*For any* entity spawn event, the emitted notification should contain all required fields (entity type, location, spawn reason)
**Validates: Requirements 5.1**

Property 17: Entity death event completeness
*For any* entity death event, the emitted notification should contain all required fields (entity type, location, death cause)
**Validates: Requirements 5.2**

Property 18: Block place event completeness
*For any* block place event, the emitted notification should contain all required fields (player name, block type, location)
**Validates: Requirements 5.3**

Property 19: Item pickup event completeness
*For any* item pickup event, the emitted notification should contain all required fields (player name, item type, quantity)
**Validates: Requirements 5.4**

Property 20: Item drop event completeness
*For any* item drop event, the emitted notification should contain all required fields (player name, item type, quantity)
**Validates: Requirements 5.5**

Property 21: Advancement event completeness
*For any* advancement event, the emitted notification should contain all required fields (player name, advancement identifier)
**Validates: Requirements 5.6**

Property 22: Chunk load event completeness
*For any* chunk load event, the emitted notification should contain the chunk coordinates
**Validates: Requirements 5.7**

Property 23: Chunk unload event completeness
*For any* chunk unload event, the emitted notification should contain the chunk coordinates
**Validates: Requirements 5.8**

### Batch Operation Properties

Property 24: Batch execution completeness
*For any* list of valid commands, executing as a batch should execute all commands and return results for each
**Validates: Requirements 6.1**

Property 25: Batch failure resilience
*For any* batch containing some failing commands, all commands should be executed and results returned for all commands including failures
**Validates: Requirements 6.2**

Property 26: Atomic batch rollback
*For any* atomic batch where any command fails, the world state after the batch should be identical to the state before the batch
**Validates: Requirements 6.3**

Property 27: Scheduled command execution timing
*For any* scheduled command with delay, the command should execute after approximately the specified number of ticks
**Validates: Requirements 6.4**

### History and State Properties

Property 28: Command audit completeness
*For any* executed command, the audit log should contain an entry with all required fields (command, timestamp, executor, result)
**Validates: Requirements 7.1**

Property 29: Command history query accuracy
*For any* time range query, all returned commands should have timestamps within the specified range
**Validates: Requirements 7.2**

Property 30: Event history storage completeness
*For any* game event, the event history should contain an entry with all required fields (event type, timestamp, event data)
**Validates: Requirements 7.3**

Property 31: Event history query accuracy
*For any* event type and time range query, all returned events should match the type filter and have timestamps within the specified range
**Validates: Requirements 7.4**

Property 32: Player session query completeness
*For any* player, the returned session information should include all required fields (join time, play duration, activity summary)
**Validates: Requirements 7.5**

Property 33: Snapshot creation persistence
*For any* created snapshot, it should appear in the list of available snapshots with correct metadata
**Validates: Requirements 7.6**

Property 34: Snapshot listing completeness
*For any* snapshot list query, all returned snapshots should include required fields (timestamp, description)
**Validates: Requirements 7.7**

### Configuration and Limits Properties

Property 35: History retention enforcement
*For any* event older than the configured retention period, it should not appear in event history queries
**Validates: Requirements 8.4**

Property 36: Audit log size limit enforcement
*For any* state of the audit log, its size should never exceed the configured maximum size
**Validates: Requirements 8.5**

### Performance Properties

Property 37: Batch processing order
*For any* sequence of queued batch operations, they should be processed in the order they were submitted
**Validates: Requirements 10.2**

Property 38: History query performance
*For any* event history query, the query should complete and return results within 500 milliseconds
**Validates: Requirements 10.3**

## Error Handling

### Error Categories

**Block Operation Errors:**
- Invalid block type
- Coordinates outside world boundaries
- Chunk not loaded
- Region too large
- Handled by: Validate inputs, return descriptive errors

**Entity Operation Errors:**
- Invalid entity type
- Entity not found
- Spawn limit exceeded
- Invalid entity attributes
- Handled by: Validate inputs, check limits, return descriptive errors

**Effect Operation Errors:**
- Invalid effect type
- Player not found
- Invalid duration or amplifier
- Handled by: Validate inputs, return descriptive errors with valid options

**Batch Operation Errors:**
- Batch size exceeded
- Malformed command in batch
- Atomic batch rollback failure
- Handled by: Validate batch size, validate each command, implement transaction rollback

**History Query Errors:**
- Invalid time range
- Query timeout
- Database connection failure
- Handled by: Validate inputs, implement timeouts, retry logic

### Error Response Format

All errors follow the existing CommandResult format:

```typescript
interface CommandResult {
  success: false
  error: string
  details?: {
    code: string
    invalidValue?: unknown
    validOptions?: string[]
    limit?: number
  }
}
```

### Error Codes

- `INVALID_BLOCK_TYPE` - Block type does not exist
- `INVALID_COORDINATES` - Coordinates outside world boundaries
- `CHUNK_NOT_LOADED` - Target chunk is not loaded
- `REGION_TOO_LARGE` - Region exceeds size limit
- `INVALID_ENTITY_TYPE` - Entity type does not exist
- `ENTITY_NOT_FOUND` - Entity ID not found
- `SPAWN_LIMIT_EXCEEDED` - Entity spawn count exceeds limit
- `INVALID_EFFECT_TYPE` - Effect type does not exist
- `PLAYER_NOT_FOUND` - Player is not online
- `BATCH_SIZE_EXCEEDED` - Batch contains too many commands
- `BATCH_MALFORMED` - Command in batch is invalid
- `ATOMIC_ROLLBACK_FAILED` - Failed to rollback atomic batch
- `QUERY_TIMEOUT` - Query exceeded timeout threshold
- `HISTORY_UNAVAILABLE` - History database unavailable

## Testing Strategy

### Unit Testing

**MCP Server Unit Tests:**
- Tool handlers correctly validate and format advanced operation requests
- Event serialization includes all required fields for new event types
- History query filters correctly parse time ranges and event types
- Batch command validation correctly identifies malformed commands
- Error responses include appropriate error codes and details

**Bridge Server Unit Tests:**
- History manager correctly stores and retrieves command entries
- Event history correctly stores and retrieves events
- History queries correctly filter by time range and event type
- History purging correctly removes old entries
- Batch queue correctly orders and processes batches sequentially

**Minecraft Mod Unit Tests:**
- Block operations correctly validate coordinates and block types
- Entity operations correctly validate entity types and attributes
- Effect operations correctly validate effect types and parameters
- Batch executor correctly handles command sequences
- Configuration loader correctly parses limit values
- Event listeners correctly extract data for new event types

### Property-Based Testing

We will continue using **fast-check** for TypeScript components and **jqwik** for Java components.

Each property-based test should run a minimum of 100 iterations.

**Property Test Requirements:**
- Each correctness property must be implemented as a property-based test
- Each test must be tagged with: `// Feature: minecraft-advanced-features, Property N: [property text]`
- Tests should use smart generators for coordinates, block types, entity types, etc.
- Tests should verify properties hold across randomly generated inputs

**Example Property Test (TypeScript):**

```typescript
import fc from 'fast-check'

// Feature: minecraft-advanced-features, Property 1: Block placement correctness
test('placing a block results in that block type at coordinates', () => {
  fc.assert(
    fc.property(
      coordinatesArbitrary(),
      blockTypeArbitrary(),
      async (coords, blockType) => {
        await placeBlock(coords.x, coords.y, coords.z, blockType)
        const result = await getBlock(coords.x, coords.y, coords.z)
        expect(result.blockType).toBe(blockType)
      }
    ),
    { numRuns: 100 }
  )
})
```

**Example Property Test (Java):**

```java
import net.jqwik.api.*;

// Feature: minecraft-advanced-features, Property 8: Entity removal completeness
class EntityRemovalTest {
  @Property(tries = 100)
  void removingEntitiesLeavesNoneOfThatType(
    @ForAll("entityTypes") String entityType,
    @ForAll("locations") Location location,
    @ForAll("positiveRadius") double radius
  ) {
    // Spawn some entities
    spawnEntity(entityType, location, 5);
    
    // Remove them
    removeEntities(entityType, location, radius);
    
    // Verify none remain
    List<EntityInfo> remaining = getEntities(location, radius);
    long count = remaining.stream()
      .filter(e -> e.getType().equals(entityType))
      .count();
    
    Assertions.assertEquals(0, count);
  }
}
```

### Integration Testing

**End-to-End Advanced Feature Tests:**
- Place blocks and verify they appear in world
- Fill regions and verify all blocks are correct type
- Spawn entities and verify they exist at coordinates
- Apply effects and verify player has effects
- Execute batches and verify all commands execute
- Create snapshots and verify they are listed
- Query history and verify entries are returned
- Test atomic batch rollback on failure

**Performance Tests:**
- Measure fill_region performance for various sizes
- Verify batch operations complete within reasonable time
- Test history query performance with large datasets
- Verify chunked operations don't block server thread

**Event Tests:**
- Trigger new event types and verify notifications
- Verify event history stores all events
- Test event subscription filtering for new event types

## Deployment Considerations

### Database for History

The Bridge Server requires persistent storage for history and audit logs:

**Options:**
1. **SQLite** - Simple, file-based, good for single-server deployments
2. **PostgreSQL** - Better for multi-server or high-volume deployments
3. **MongoDB** - Good for flexible event schema

**Recommended: SQLite for simplicity**

```typescript
interface HistoryDatabase {
  commands: Table<CommandHistoryEntry>
  events: Table<GameEvent>
  sessions: Table<PlayerSession>
  
  indexes: {
    commands_timestamp: Index
    commands_executor: Index
    events_timestamp: Index
    events_type: Index
  }
}
```

### Configuration Updates

**Bridge Server (.env):**
```env
# Existing config...

# History configuration
HISTORY_ENABLED=true
HISTORY_DATABASE_PATH=./data/history.db
HISTORY_RETENTION_DAYS=30
MAX_HISTORY_SIZE_MB=1000
MAX_BATCH_SIZE=50
```

**Minecraft Mod (minecraft-mcp-bridge.toml):**
```toml
# Existing config...

[limits]
max_batch_size = 50
max_region_volume = 100000
max_entity_spawn_count = 100
max_fill_blocks_per_tick = 1000

[events]
enabled = [
  # Existing events...
  "block_place",
  "entity_spawn",
  "entity_death",
  "item_pickup",
  "item_drop",
  "advancement",
  "chunk_load",
  "chunk_unload"
]

[history]
enable_snapshots = true
snapshot_directory = "world_snapshots"
max_snapshots = 10

[performance]
chunk_large_operations = true
blocks_per_tick = 1000
throttle_on_high_load = true
max_tps_threshold = 15.0
```

### Migration from Existing System

These features are additive and backward compatible:
- Existing tools continue to work unchanged
- New tools are added alongside existing ones
- Event subscriptions can include new event types
- Configuration is extended with new optional sections

### Monitoring

**New Metrics to Monitor:**
- History database size and growth rate
- Batch operation queue depth
- Large region operation duration
- Entity spawn/removal rates
- Event history query latency
- Snapshot creation frequency and size

## Security Considerations

### Additional Security Concerns

**Block Operations:**
- Limit region sizes to prevent griefing
- Validate block types against whitelist
- Rate limit large fill operations

**Entity Operations:**
- Limit entity spawn counts
- Prevent spawning dangerous entities (TNT, etc.) unless explicitly allowed
- Rate limit entity operations

**Batch Operations:**
- Limit batch size to prevent resource exhaustion
- Validate all commands in batch before execution
- Implement timeouts for long-running batches

**History Access:**
- Consider adding authentication for history queries
- Implement rate limiting on history queries
- Sanitize history data to remove sensitive information

### Updated Command Whitelist Examples

```toml
[commands]
allowed_patterns = [
  # Existing patterns...
  
  # Block operations
  "^place_block .*",
  "^break_block .*",
  "^fill_region .*",
  
  # Entity operations
  "^spawn_entity (zombie|skeleton|cow|pig) .*",  # Whitelist specific entities
  "^remove_entities .*",
  
  # Effects
  "^apply_effect \\w+ (speed|strength|regeneration) .*",  # Whitelist specific effects
]

# Dangerous patterns to avoid
# "^fill_region .* tnt$"  # Don't allow filling with TNT
# "^spawn_entity wither .*"  # Don't allow spawning bosses
```

## Technology Stack Updates

No changes to core technology stack. Additional dependencies:

| Component | New Dependencies | Purpose |
|-----------|-----------------|---------|
| Bridge Server | better-sqlite3 or pg | History database |
| Bridge Server | node-cron | Scheduled history purging |
| Minecraft Mod | None | Uses existing NeoForge APIs |

## Future Enhancements

- **Undo/Redo System** - Leverage history to implement undo functionality
- **World Diff Tool** - Compare snapshots to see changes over time
- **Advanced Filters** - More sophisticated entity and block queries
- **Scripting Support** - Allow complex multi-step operations
- **Permissions System** - Fine-grained control over which operations are allowed
- **Real-time Analytics** - Dashboard showing operation statistics
- **Backup Integration** - Automatic backups before large operations
- **Multi-world Support** - Better handling of multiple worlds/dimensions
