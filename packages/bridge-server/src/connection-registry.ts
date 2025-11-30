import WebSocket from 'ws';
import { MessageSource } from '@minecraft-mcp-bridge/shared';
import { Logger } from './logger';

export interface ClientInfo {
  id: string;
  ws: WebSocket;
  type: MessageSource;
  version: string;
  connectedAt: number;
}

export class ConnectionRegistry {
  private clients: Map<string, ClientInfo> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  addClient(id: string, ws: WebSocket, type: MessageSource, version: string): void {
    this.clients.set(id, {
      id,
      ws,
      type,
      version,
      connectedAt: Date.now()
    });
    this.logger.info('Client registered', { id, type, version });
  }

  removeClient(id: string): void {
    const client = this.clients.get(id);
    if (client) {
      this.clients.delete(id);
      this.logger.info('Client unregistered', { id, type: client.type });
    }
  }

  getClient(id: string): ClientInfo | undefined {
    return this.clients.get(id);
  }

  getMCPClients(): ClientInfo[] {
    return Array.from(this.clients.values()).filter(c => c.type === 'mcp');
  }

  getMinecraftClients(): ClientInfo[] {
    return Array.from(this.clients.values()).filter(c => c.type === 'minecraft');
  }

  getAllClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }
}
