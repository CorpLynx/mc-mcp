import WebSocket from 'ws';
import { BridgeMessage, MessageSource } from '@minecraft-mcp-bridge/shared';
import { BridgeConfig } from './config';
import { Logger } from './logger';

export interface AuthResult {
  success: boolean;
  clientType?: MessageSource;
  error?: string;
}

export interface AuthzResult {
  authorized: boolean;
  reason?: string;
}

export class AuthManager {
  private config: BridgeConfig;
  private logger: Logger;
  private authenticatedClients: Map<WebSocket, MessageSource> = new Map();

  constructor(config: BridgeConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  authenticate(message: BridgeMessage, ws: WebSocket): AuthResult {
    // Extract auth token from message payload
    const authToken = (message.payload as any)?.authToken;

    if (!authToken || typeof authToken !== 'string') {
      this.logger.warn('Authentication failed: missing token');
      return {
        success: false,
        error: 'Missing authentication token'
      };
    }

    // Check if it's an MCP client
    if (this.config.mcpAuthTokens.includes(authToken)) {
      this.authenticatedClients.set(ws, 'mcp');
      return {
        success: true,
        clientType: 'mcp'
      };
    }

    // Check if it's a Minecraft client
    if (authToken === this.config.minecraftAuthToken) {
      this.authenticatedClients.set(ws, 'minecraft');
      return {
        success: true,
        clientType: 'minecraft'
      };
    }

    this.logger.warn('Authentication failed: invalid token');
    return {
      success: false,
      error: 'Invalid authentication token'
    };
  }

  authorize(clientType: MessageSource, message: BridgeMessage): AuthzResult {
    // Authorization rules:
    // - MCP clients can send commands and queries
    // - Minecraft clients can send events and responses
    
    if (message.type === 'command' || message.type === 'query') {
      if (clientType !== 'mcp') {
        return {
          authorized: false,
          reason: 'Only MCP clients can send commands and queries'
        };
      }
    }

    if (message.type === 'event') {
      if (clientType !== 'minecraft') {
        return {
          authorized: false,
          reason: 'Only Minecraft clients can send events'
        };
      }
    }

    // Additional command-specific authorization
    if (message.type === 'command') {
      const command = (message.payload as any)?.command;
      
      // Check for dangerous commands (this is a basic example)
      const dangerousCommands = ['stop', 'restart', 'op', 'deop'];
      if (dangerousCommands.some(cmd => command?.startsWith(cmd))) {
        this.logger.warn('Blocked dangerous command', { command });
        return {
          authorized: false,
          reason: `Command '${command}' is not permitted`
        };
      }
    }

    return { authorized: true };
  }

  getClientType(ws: WebSocket): MessageSource | undefined {
    return this.authenticatedClients.get(ws);
  }

  removeClient(ws: WebSocket): void {
    this.authenticatedClients.delete(ws);
  }
}
