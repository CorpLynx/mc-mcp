// Location types
export interface Location {
  world: string;
  x: number;
  y: number;
  z: number;
}

// Game Event types
export type GameEventType = 'player_join' | 'player_quit' | 'player_chat' | 'player_death' | 'block_break';

export interface PlayerJoinEvent {
  player: string;
  uuid: string;
}

export interface PlayerQuitEvent {
  player: string;
  uuid: string;
}

export interface PlayerChatEvent {
  player: string;
  message: string;
}

export interface PlayerDeathEvent {
  player: string;
  cause: string;
  location: Location;
  killer?: string;
}

export interface BlockBreakEvent {
  player: string;
  blockType: string;
  location: Location;
}

export interface GameEvent {
  eventType: GameEventType;
  timestamp: number;
  data: PlayerJoinEvent | PlayerQuitEvent | PlayerChatEvent | PlayerDeathEvent | BlockBreakEvent;
}

// Server State types
export interface ItemStack {
  type: string;
  quantity: number;
  displayName?: string;
}

export interface PlayerInfo {
  name: string;
  uuid: string;
  health: number;
  foodLevel: number;
  location: Location;
  gameMode: string;
  inventory: ItemStack[];
}

export interface ServerInfo {
  version: string;
  onlinePlayers: number;
  maxPlayers: number;
  timeOfDay: number;
  weather: string;
  tps: number;
}

export interface BlockInfo {
  type: string;
  location: Location;
}

export interface EntityInfo {
  type: string;
  location: Location;
  name?: string;
}

export interface WorldInfo {
  blocks: BlockInfo[];
  entities: EntityInfo[];
}

// Command Result types
export interface CommandResult {
  success: boolean;
  message?: string;
  error?: string;
}

// Bridge Message types
export type MessageType = 'event' | 'command' | 'query' | 'response' | 'error';
export type MessageSource = 'mcp' | 'minecraft';

export interface BridgeMessage {
  version: string;
  type: MessageType;
  id: string;
  timestamp: number;
  source: MessageSource;
  payload: unknown;
  // Latency tracking fields
  receivedAt?: number;  // When bridge received the message
  forwardedAt?: number; // When bridge forwarded the message
}

export interface EventMessage extends BridgeMessage {
  type: 'event';
  payload: GameEvent;
}

export interface CommandMessage extends BridgeMessage {
  type: 'command';
  payload: {
    command: string;
    args: Record<string, unknown>;
  };
}

export interface ResponseMessage extends BridgeMessage {
  type: 'response';
  payload: {
    success: boolean;
    data?: unknown;
    error?: string;
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Error codes
export enum ErrorCode {
  AUTH_FAILED = 'AUTH_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_COMMAND = 'INVALID_COMMAND',
  PLAYER_NOT_FOUND = 'PLAYER_NOT_FOUND',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  SCHEMA_ERROR = 'SCHEMA_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT = 'TIMEOUT'
}
