#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { BridgeClient } from './bridge-client.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import {
  GameEvent,
  GameEventType,
  PlayerInfo,
  ServerInfo,
  WorldInfo,
  CommandResult
} from '@minecraft-mcp-bridge/shared';

const config = loadConfig();
const logger = createLogger(config.logLevel);
const VERSION = '1.0.0';

// Subscription management
// Note: MCP Server runs one instance per client (stdio transport), so we track a single client's subscriptions
let currentSubscription: Set<GameEventType> | null = null; // null means subscribe to all events (default)

// Log component startup with version and config (Requirement 7.1)
logger.info(`MCP Server starting - version ${VERSION}`);
logger.info(`Configuration loaded`, {
  version: VERSION,
  bridgeUrl: config.bridgeUrl,
  reconnectAttempts: config.reconnectAttempts,
  reconnectDelay: config.reconnectDelay,
  logLevel: config.logLevel,
  authTokenConfigured: config.authToken.length > 0
});

// Create MCP Server
const server = new Server(
  {
    name: 'minecraft-mcp-server',
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Create Bridge Client
const bridgeClient = new BridgeClient({
  url: config.bridgeUrl,
  authToken: config.authToken,
  reconnectAttempts: config.reconnectAttempts,
  reconnectDelay: config.reconnectDelay
});

// Handle connection events (Requirement 7.1 - Log connection status changes)
bridgeClient.on('connected', () => {
  logger.info('Bridge connection established', { bridgeUrl: config.bridgeUrl, status: 'connected' });
});

bridgeClient.on('disconnected', () => {
  logger.warn('Bridge connection lost', { bridgeUrl: config.bridgeUrl, status: 'disconnected' });
});

bridgeClient.on('error', (error) => {
  logger.error('Bridge connection error', { 
    bridgeUrl: config.bridgeUrl, 
    error: error instanceof Error ? error.message : 'Unknown error',
    status: 'error'
  });
});

// Handle game events from Bridge Server
bridgeClient.on('event', (event: GameEvent) => {
  handleGameEvent(event);
});

function handleGameEvent(event: GameEvent): void {
  // Filter based on subscriptions
  // If currentSubscription is null, send all events (default behavior - Requirement 8.5)
  // If currentSubscription is set, only send events that match the subscription (Requirement 8.2, 8.3)
  const shouldSendEvent = currentSubscription === null || currentSubscription.has(event.eventType);
  
  if (shouldSendEvent) {
    // Serialize event to MCP notification format
    const notification = serializeEventToNotification(event);
    
    // Emit notification to connected LLM clients
    server.notification({
      method: 'notifications/minecraft/event',
      params: notification
    });
    
    logger.debug(`Event notification sent: ${event.eventType}`);
  } else {
    logger.debug(`Event filtered out: ${event.eventType} (not in subscription)`);
  }
}

function serializeEventToNotification(event: GameEvent): Record<string, unknown> {
  const base = {
    eventType: event.eventType,
    timestamp: event.timestamp
  };

  switch (event.eventType) {
    case 'player_join':
      return {
        ...base,
        player: (event.data as any).player,
        uuid: (event.data as any).uuid
      };
    case 'player_quit':
      return {
        ...base,
        player: (event.data as any).player,
        uuid: (event.data as any).uuid
      };
    case 'player_chat':
      return {
        ...base,
        player: (event.data as any).player,
        message: (event.data as any).message
      };
    case 'player_death':
      return {
        ...base,
        player: (event.data as any).player,
        cause: (event.data as any).cause,
        location: (event.data as any).location,
        killer: (event.data as any).killer
      };
    case 'block_break':
      return {
        ...base,
        player: (event.data as any).player,
        blockType: (event.data as any).blockType,
        location: (event.data as any).location
      };
    default:
      return base;
  }
}

// Define MCP Tools
const tools: Tool[] = [
  {
    name: 'execute_command',
    description: 'Execute a Minecraft server command',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The command to execute (without leading slash)'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'send_message',
    description: 'Send a message to a player or broadcast to all players',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to send'
        },
        target: {
          type: 'string',
          description: 'Optional player name to send to (omit to broadcast)'
        }
      },
      required: ['message']
    }
  },
  {
    name: 'teleport_player',
    description: 'Teleport a player to specific coordinates',
    inputSchema: {
      type: 'object',
      properties: {
        player: {
          type: 'string',
          description: 'The player name to teleport'
        },
        x: {
          type: 'number',
          description: 'X coordinate'
        },
        y: {
          type: 'number',
          description: 'Y coordinate'
        },
        z: {
          type: 'number',
          description: 'Z coordinate'
        },
        world: {
          type: 'string',
          description: 'Optional world name'
        }
      },
      required: ['player', 'x', 'y', 'z']
    }
  },
  {
    name: 'give_item',
    description: 'Give items to a player',
    inputSchema: {
      type: 'object',
      properties: {
        player: {
          type: 'string',
          description: 'The player name'
        },
        item: {
          type: 'string',
          description: 'The item type (e.g., diamond, iron_sword)'
        },
        quantity: {
          type: 'number',
          description: 'The quantity to give'
        }
      },
      required: ['player', 'item', 'quantity']
    }
  },
  {
    name: 'get_online_players',
    description: 'Get a list of currently online players',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_player_info',
    description: 'Get detailed information about a specific player',
    inputSchema: {
      type: 'object',
      properties: {
        player: {
          type: 'string',
          description: 'The player name'
        }
      },
      required: ['player']
    }
  },
  {
    name: 'get_server_info',
    description: 'Get information about the Minecraft server',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_world_info',
    description: 'Get information about blocks and entities in a specific area',
    inputSchema: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
          description: 'Center X coordinate'
        },
        y: {
          type: 'number',
          description: 'Center Y coordinate'
        },
        z: {
          type: 'number',
          description: 'Center Z coordinate'
        },
        radius: {
          type: 'number',
          description: 'Radius to search within'
        }
      },
      required: ['x', 'y', 'z', 'radius']
    }
  },
  {
    name: 'subscribe_events',
    description: 'Subscribe to specific Minecraft event types',
    inputSchema: {
      type: 'object',
      properties: {
        eventTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['player_join', 'player_quit', 'player_chat', 'player_death', 'block_break']
          },
          description: 'Array of event types to subscribe to (empty array for all events)'
        }
      },
      required: ['eventTypes']
    }
  },
  {
    name: 'lightning_strike',
    description: 'Strike lightning at specific coordinates',
    inputSchema: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
          description: 'X coordinate'
        },
        y: {
          type: 'number',
          description: 'Y coordinate'
        },
        z: {
          type: 'number',
          description: 'Z coordinate'
        },
        world: {
          type: 'string',
          description: 'Optional world name'
        }
      },
      required: ['x', 'y', 'z']
    }
  },
  {
    name: 'set_time',
    description: 'Set the time of day in the Minecraft world',
    inputSchema: {
      type: 'object',
      properties: {
        time: {
          type: 'number',
          description: 'Time value (0-24000, where 0=dawn, 6000=noon, 12000=dusk, 18000=midnight)'
        },
        world: {
          type: 'string',
          description: 'Optional world name'
        }
      },
      required: ['time']
    }
  },
  {
    name: 'spawn_entity',
    description: 'Spawn an entity at specific coordinates',
    inputSchema: {
      type: 'object',
      properties: {
        entityType: {
          type: 'string',
          description: 'The entity type to spawn (e.g., zombie, creeper, cow, villager)'
        },
        x: {
          type: 'number',
          description: 'X coordinate'
        },
        y: {
          type: 'number',
          description: 'Y coordinate'
        },
        z: {
          type: 'number',
          description: 'Z coordinate'
        },
        world: {
          type: 'string',
          description: 'Optional world name'
        },
        count: {
          type: 'number',
          description: 'Number of entities to spawn (default: 1)'
        }
      },
      required: ['entityType', 'x', 'y', 'z']
    }
  }
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  // Log tool invocation with arguments (Requirement 7.1)
  logger.info(`Tool invoked: ${name}`, { arguments: args });

  try {
    let result: unknown;

    switch (name) {
      case 'execute_command':
        result = await handleExecuteCommand(args as { command: string });
        break;
      case 'send_message':
        result = await handleSendMessage(args as { message: string; target?: string });
        break;
      case 'teleport_player':
        result = await handleTeleportPlayer(args as { player: string; x: number; y: number; z: number; world?: string });
        break;
      case 'give_item':
        result = await handleGiveItem(args as { player: string; item: string; quantity: number });
        break;
      case 'get_online_players':
        result = await handleGetOnlinePlayers();
        break;
      case 'get_player_info':
        result = await handleGetPlayerInfo(args as { player: string });
        break;
      case 'get_server_info':
        result = await handleGetServerInfo();
        break;
      case 'get_world_info':
        result = await handleGetWorldInfo(args as { x: number; y: number; z: number; radius: number });
        break;
      case 'subscribe_events':
        result = handleSubscribeEvents(args as { eventTypes: GameEventType[] });
        break;
      case 'lightning_strike':
        result = await handleLightningStrike(args as { x: number; y: number; z: number; world?: string });
        break;
      case 'set_time':
        result = await handleSetTime(args as { time: number; world?: string });
        break;
      case 'spawn_entity':
        result = await handleSpawnEntity(args as { entityType: string; x: number; y: number; z: number; world?: string; count?: number });
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    // Log successful tool completion with result summary (Requirement 7.1)
    logger.info(`Tool ${name} completed successfully`, { result: summarizeResult(result) });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    // Log tool failure with error details (Requirement 7.1)
    logger.error(`Tool ${name} failed`, { error: error instanceof Error ? error.message : 'Unknown error', arguments: args });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: errorMessage
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

// Helper function to summarize results for logging
function summarizeResult(result: unknown): unknown {
  if (result === null || result === undefined) {
    return result;
  }
  
  if (typeof result === 'object') {
    const obj = result as any;
    
    // For arrays, log count and first few items
    if (Array.isArray(obj)) {
      return {
        type: 'array',
        count: obj.length,
        sample: obj.slice(0, 3)
      };
    }
    
    // For objects with success field (CommandResult), log the status
    if ('success' in obj) {
      return {
        success: obj.success,
        hasError: 'error' in obj,
        hasMessage: 'message' in obj
      };
    }
    
    // For other objects, log the keys
    return {
      type: 'object',
      keys: Object.keys(obj)
    };
  }
  
  return result;
}

// Command execution handlers
async function handleExecuteCommand(args: { command: string }): Promise<CommandResult> {
  try {
    const response = await bridgeClient.sendCommand('execute_command', { command: args.command });
    return response as CommandResult;
  } catch (error) {
    // Parse error responses from Bridge Server and return descriptive error messages
    const errorMessage = error instanceof Error ? error.message : 'Command execution failed';
    logger.error(`Command execution failed: ${args.command}`, error);
    return {
      success: false,
      error: `Failed to execute command '${args.command}': ${errorMessage}`
    };
  }
}

async function handleSendMessage(args: { message: string; target?: string }): Promise<CommandResult> {
  try {
    const response = await bridgeClient.sendCommand('send_message', {
      message: args.message,
      target: args.target
    });
    return response as CommandResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
    const targetInfo = args.target ? ` to player '${args.target}'` : ' (broadcast)';
    logger.error(`Failed to send message${targetInfo}`, error);
    return {
      success: false,
      error: `Failed to send message${targetInfo}: ${errorMessage}`
    };
  }
}

async function handleTeleportPlayer(args: { player: string; x: number; y: number; z: number; world?: string }): Promise<CommandResult> {
  try {
    const response = await bridgeClient.sendCommand('teleport_player', args);
    return response as CommandResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to teleport player';
    const worldInfo = args.world ? ` in world '${args.world}'` : '';
    logger.error(`Failed to teleport player '${args.player}' to (${args.x}, ${args.y}, ${args.z})${worldInfo}`, error);
    return {
      success: false,
      error: `Failed to teleport player '${args.player}' to coordinates (${args.x}, ${args.y}, ${args.z})${worldInfo}: ${errorMessage}`
    };
  }
}

async function handleGiveItem(args: { player: string; item: string; quantity: number }): Promise<CommandResult> {
  try {
    const response = await bridgeClient.sendCommand('give_item', args);
    return response as CommandResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to give item';
    logger.error(`Failed to give ${args.quantity}x ${args.item} to player '${args.player}'`, error);
    return {
      success: false,
      error: `Failed to give ${args.quantity}x '${args.item}' to player '${args.player}': ${errorMessage}`
    };
  }
}

// Query handlers
async function handleGetOnlinePlayers(): Promise<string[]> {
  try {
    const response = await bridgeClient.sendQuery('get_online_players', {});
    return response as string[];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get online players';
    logger.error('Failed to get online players', error);
    throw new Error(`Failed to retrieve online players list: ${errorMessage}`);
  }
}

async function handleGetPlayerInfo(args: { player: string }): Promise<PlayerInfo> {
  try {
    const response = await bridgeClient.sendQuery('get_player_info', { player: args.player });
    return response as PlayerInfo;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get player info';
    logger.error(`Failed to get info for player '${args.player}'`, error);
    throw new Error(`Failed to retrieve information for player '${args.player}': ${errorMessage}`);
  }
}

async function handleGetServerInfo(): Promise<ServerInfo> {
  try {
    const response = await bridgeClient.sendQuery('get_server_info', {});
    return response as ServerInfo;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get server info';
    logger.error('Failed to get server info', error);
    throw new Error(`Failed to retrieve server information: ${errorMessage}`);
  }
}

async function handleGetWorldInfo(args: { x: number; y: number; z: number; radius: number }): Promise<WorldInfo> {
  try {
    const response = await bridgeClient.sendQuery('get_world_info', args);
    return response as WorldInfo;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get world info';
    logger.error(`Failed to get world info at (${args.x}, ${args.y}, ${args.z}) with radius ${args.radius}`, error);
    throw new Error(`Failed to retrieve world information at coordinates (${args.x}, ${args.y}, ${args.z}) with radius ${args.radius}: ${errorMessage}`);
  }
}

// Subscription handler (Requirement 8.1, 8.4)
function handleSubscribeEvents(args: { eventTypes: GameEventType[] }): { success: boolean; message: string } {
  // Validate event types
  const validEventTypes: GameEventType[] = ['player_join', 'player_quit', 'player_chat', 'player_death', 'block_break'];
  const invalidTypes = args.eventTypes.filter(type => !validEventTypes.includes(type));
  
  if (invalidTypes.length > 0) {
    // Log invalid subscription attempt (Requirement 7.1)
    logger.warn(`Invalid event types in subscription request`, { 
      invalidTypes, 
      validTypes: validEventTypes,
      requestedTypes: args.eventTypes
    });
    return {
      success: false,
      message: `Invalid event types: ${invalidTypes.join(', ')}. Valid types are: ${validEventTypes.join(', ')}`
    };
  }
  
  if (args.eventTypes.length === 0) {
    // Empty array means subscribe to all events (Requirement 8.5)
    const previousSubscription = currentSubscription ? Array.from(currentSubscription) : null;
    currentSubscription = null;
    // Log subscription change (Requirement 7.1)
    logger.info('Client subscription updated to all events', { 
      previousSubscription,
      newSubscription: 'all',
      eventTypes: validEventTypes
    });
    return {
      success: true,
      message: 'Subscribed to all events'
    };
  } else {
    // Subscribe to specific event types (Requirement 8.1, 8.4)
    const previousSubscription = currentSubscription ? Array.from(currentSubscription) : null;
    currentSubscription = new Set(args.eventTypes);
    // Log subscription change (Requirement 7.1)
    logger.info(`Client subscription updated to specific events`, { 
      previousSubscription,
      newSubscription: args.eventTypes,
      eventCount: args.eventTypes.length
    });
    return {
      success: true,
      message: `Subscribed to: ${args.eventTypes.join(', ')}`
    };
  }
}

// Additional command handlers
async function handleLightningStrike(args: { x: number; y: number; z: number; world?: string }): Promise<CommandResult> {
  try {
    const response = await bridgeClient.sendCommand('lightning_strike', args);
    return response as CommandResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to strike lightning';
    const worldInfo = args.world ? ` in world '${args.world}'` : '';
    logger.error(`Failed to strike lightning at (${args.x}, ${args.y}, ${args.z})${worldInfo}`, error);
    return {
      success: false,
      error: `Failed to strike lightning at coordinates (${args.x}, ${args.y}, ${args.z})${worldInfo}: ${errorMessage}`
    };
  }
}

async function handleSetTime(args: { time: number; world?: string }): Promise<CommandResult> {
  try {
    const response = await bridgeClient.sendCommand('set_time', args);
    return response as CommandResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to set time';
    const worldInfo = args.world ? ` in world '${args.world}'` : '';
    logger.error(`Failed to set time to ${args.time}${worldInfo}`, error);
    return {
      success: false,
      error: `Failed to set time to ${args.time}${worldInfo}: ${errorMessage}`
    };
  }
}

async function handleSpawnEntity(args: { entityType: string; x: number; y: number; z: number; world?: string; count?: number }): Promise<CommandResult> {
  try {
    const response = await bridgeClient.sendCommand('spawn_entity', args);
    return response as CommandResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to spawn entity';
    const worldInfo = args.world ? ` in world '${args.world}'` : '';
    const countInfo = args.count ? ` (${args.count}x)` : '';
    logger.error(`Failed to spawn ${args.entityType}${countInfo} at (${args.x}, ${args.y}, ${args.z})${worldInfo}`, error);
    return {
      success: false,
      error: `Failed to spawn ${args.entityType}${countInfo} at coordinates (${args.x}, ${args.y}, ${args.z})${worldInfo}: ${errorMessage}`
    };
  }
}

// Start server
async function main() {
  // Connect to Bridge Server
  logger.info('Initiating connection to Bridge Server');
  bridgeClient.connect();

  // Start MCP server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log server ready status (Requirement 7.1)
  logger.info('MCP Server ready and listening on stdio', {
    version: VERSION,
    transport: 'stdio',
    toolsRegistered: tools.length,
    bridgeConnectionStatus: bridgeClient.getConnectionStatus() ? 'connected' : 'connecting'
  });
}

main().catch((error) => {
  logger.error('Fatal error during startup', { 
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
});
