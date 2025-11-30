// WebSocket client for connecting to Bridge Server
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { BridgeMessage, EventMessage, ResponseMessage, GameEvent } from '@minecraft-mcp-bridge/shared';
import { createLogger } from './logger';

const logger = createLogger(process.env.LOG_LEVEL || 'INFO');

export interface BridgeClientConfig {
  url: string;
  authToken: string;
  reconnectAttempts: number;
  reconnectDelay: number;
}

export class BridgeClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: BridgeClientConfig;
  private reconnectCount = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private pendingRequests = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }>();

  constructor(config: BridgeClientConfig) {
    super();
    this.config = config;
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      logger.debug('Already connected or connecting');
      return;
    }

    logger.info(`Connecting to Bridge Server at ${this.config.url}`);
    
    this.ws = new WebSocket(this.config.url, {
      headers: {
        'Authorization': `Bearer ${this.config.authToken}`
      }
    });

    this.ws.on('open', () => {
      logger.info('Connected to Bridge Server');
      this.isConnected = true;
      this.reconnectCount = 0;
      this.emit('connected');
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString()) as BridgeMessage;
        this.handleMessage(message);
      } catch (error) {
        logger.error('Failed to parse message from Bridge Server', error);
      }
    });

    this.ws.on('close', () => {
      logger.warn('Connection to Bridge Server closed');
      this.isConnected = false;
      this.emit('disconnected');
      this.attemptReconnect();
    });

    this.ws.on('error', (error) => {
      logger.error('WebSocket error', error);
      this.emit('error', error);
    });
  }

  private handleMessage(message: BridgeMessage): void {
    if (message.type === 'event') {
      const eventMessage = message as EventMessage;
      this.emit('event', eventMessage.payload);
    } else if (message.type === 'response') {
      const responseMessage = message as ResponseMessage;
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);
        if (responseMessage.payload.success) {
          pending.resolve(responseMessage.payload.data);
        } else {
          // Parse error response from Bridge Server
          const errorMessage = this.parseErrorResponse(responseMessage.payload.error);
          pending.reject(new Error(errorMessage));
        }
      }
    } else if (message.type === 'error') {
      // Handle error messages from Bridge Server
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);
        const errorMessage = this.parseErrorResponse(message.payload);
        pending.reject(new Error(errorMessage));
      }
    }
  }

  private parseErrorResponse(error: unknown): string {
    // Handle structured error responses from Bridge Server
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as any;
      
      // Check for structured error format with code and message
      if (errorObj.code && errorObj.message) {
        const details = errorObj.details ? ` (${JSON.stringify(errorObj.details)})` : '';
        return `[${errorObj.code}] ${errorObj.message}${details}`;
      }
      
      // Check for simple message field
      if (errorObj.message) {
        return errorObj.message;
      }
    }
    
    // Fallback to string representation
    if (typeof error === 'string') {
      return error;
    }
    
    return 'Unknown error occurred';
  }

  private attemptReconnect(): void {
    if (this.reconnectCount >= this.config.reconnectAttempts) {
      logger.error(`Failed to reconnect after ${this.config.reconnectAttempts} attempts`);
      return;
    }

    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectCount);
    this.reconnectCount++;
    
    logger.info(`Attempting reconnection ${this.reconnectCount}/${this.config.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  sendCommand(command: string, args: Record<string, unknown>): Promise<unknown> {
    return this.sendMessage('command', { command, args });
  }

  sendQuery(query: string, args: Record<string, unknown>): Promise<unknown> {
    return this.sendMessage('query', { query, args });
  }

  private sendMessage(type: 'command' | 'query', payload: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.ws) {
        reject(new Error('[CONNECTION_ERROR] Not connected to Bridge Server'));
        return;
      }

      const id = this.generateId();
      const message: BridgeMessage = {
        version: '1.0.0',
        type,
        id,
        timestamp: Date.now(),
        source: 'mcp',
        payload
      };

      // Set timeout with descriptive error message
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        const payloadInfo = typeof payload === 'object' && payload !== null 
          ? JSON.stringify(payload).substring(0, 100) 
          : String(payload);
        reject(new Error(`[TIMEOUT] Request timed out after 30 seconds (type: ${type}, payload: ${payloadInfo})`));
      }, 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.ws.send(JSON.stringify(message), (error) => {
        if (error) {
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          reject(new Error(`[CONNECTION_ERROR] Failed to send message: ${error.message}`));
        }
      });
    });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}
