import WebSocket, { WebSocketServer } from 'ws';
import express from 'express';
import { BridgeMessage, MessageSource, ErrorCode } from '@minecraft-mcp-bridge/shared';
import { BridgeConfig, loadConfig } from './config';
import { ConnectionRegistry } from './connection-registry';
import { MessageRouter } from './message-router';
import { validateMessage } from './validation';
import { Logger } from './logger';
import { AuthManager } from './auth';
import { LatencyMonitor } from './latency-monitor';

const VERSION = '1.0.0';

export class BridgeServer {
  private wss: WebSocketServer;
  private app: express.Application;
  private config: BridgeConfig;
  private registry: ConnectionRegistry;
  private router: MessageRouter;
  private logger: Logger;
  private authManager: AuthManager;
  private latencyMonitor: LatencyMonitor;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(config: BridgeConfig) {
    this.config = config;
    this.logger = new Logger(config.logLevel);
    this.registry = new ConnectionRegistry(this.logger);
    this.latencyMonitor = new LatencyMonitor(this.logger, 60000); // Report every 60 seconds
    this.router = new MessageRouter(this.registry, this.logger, this.latencyMonitor);
    this.authManager = new AuthManager(config, this.logger);
    
    // Create Express app for health checks
    this.app = express();
    this.app.get('/health', (req, res) => {
      const latencyStats = this.latencyMonitor.getStats();
      res.json({
        status: 'ok',
        version: VERSION,
        connections: {
          mcp: this.registry.getMCPClients().length,
          minecraft: this.registry.getMinecraftClients().length
        },
        latency: {
          avgMs: latencyStats.overall.avgMs || 0,
          maxMs: latencyStats.overall.maxMs || 0,
          messagesForwarded: latencyStats.overall.count,
          over100ms: latencyStats.overall.over100ms
        }
      });
    });

    // Create WebSocket server
    this.wss = new WebSocketServer({ port: config.port });
    
    this.logger.info(`Bridge Server v${VERSION} starting`, {
      port: config.port,
      messageQueueSize: config.messageQueueSize,
      heartbeatInterval: config.heartbeatInterval
    });
  }

  start(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws, req);
    });

    // Start heartbeat mechanism
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats();
    }, this.config.heartbeatInterval);

    // Start latency monitoring and reporting
    this.latencyMonitor.startReporting();

    // Start HTTP server for health checks
    const httpPort = this.config.port + 1;
    this.app.listen(httpPort, () => {
      this.logger.info(`Health check endpoint available at http://localhost:${httpPort}/health`);
    });

    this.logger.info('Bridge Server started successfully');
  }

  private handleConnection(ws: WebSocket, req: any): void {
    const clientId = this.generateClientId();
    let authenticated = false;
    let clientType: MessageSource | null = null;
    let clientVersion: string | null = null;

    this.logger.info('New connection attempt', { clientId });

    // Set up message handler
    ws.on('message', async (data: Buffer) => {
      try {
        const rawMessage = data.toString();
        const message = JSON.parse(rawMessage) as BridgeMessage;

        // Handle authentication message
        if (!authenticated) {
          const authResult = this.authManager.authenticate(message, ws);
          if (!authResult.success) {
            this.sendError(ws, message.id, ErrorCode.AUTH_FAILED, authResult.error || 'Authentication failed');
            ws.close();
            return;
          }
          
          authenticated = true;
          clientType = authResult.clientType!;
          clientVersion = message.version;

          // Version negotiation
          const versionResult = this.negotiateVersion(message.version);
          if (!versionResult.compatible) {
            this.logger.warn('Version mismatch', {
              clientVersion: message.version,
              serverVersion: VERSION,
              clientId
            });
            // Continue with graceful degradation
          }

          this.registry.addClient(clientId, ws, clientType, clientVersion);
          this.logger.info('Client authenticated', { clientId, clientType, version: clientVersion });
          
          // Send acknowledgment
          this.sendResponse(ws, message.id, { success: true, data: { version: VERSION } });
          return;
        }

        // Validate message schema
        const validationResult = validateMessage(message);
        if (!validationResult.valid) {
          this.logger.warn('Message validation failed', {
            clientId,
            errors: validationResult.errors
          });
          this.sendError(ws, message.id, ErrorCode.SCHEMA_ERROR, validationResult.errors?.join(', ') || 'Invalid message schema');
          return;
        }

        // Check authorization for commands
        if (message.type === 'command') {
          const authzResult = this.authManager.authorize(clientType!, message);
          if (!authzResult.authorized) {
            this.logger.warn('Command authorization failed', {
              clientId,
              clientType,
              command: (message.payload as any).command
            });
            this.sendError(ws, message.id, ErrorCode.PERMISSION_DENIED, authzResult.reason || 'Not authorized');
            return;
          }
        }

        // Log message forwarding
        this.logger.debug('Message received for routing', {
          messageId: message.id,
          type: message.type,
          source: message.source,
          clientId
        });

        // Route message (latency tracking is handled inside router)
        await this.router.routeMessage(message, clientId);

      } catch (error) {
        // Error handling and resilience
        this.logger.error('Error processing message', {
          clientId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        
        // Continue processing other messages
        try {
          const messageId = JSON.parse(data.toString()).id || 'unknown';
          this.sendError(ws, messageId, ErrorCode.SERVER_ERROR, 'Internal server error');
        } catch {
          // If we can't even parse the message ID, just log and continue
        }
      }
    });

    ws.on('close', () => {
      if (authenticated && clientId) {
        this.registry.removeClient(clientId);
        this.logger.info('Client disconnected', { clientId, clientType });
      }
    });

    ws.on('error', (error) => {
      this.logger.error('WebSocket error', {
        clientId,
        error: error.message,
        stack: error.stack
      });
    });

    // Set up ping/pong for heartbeat
    (ws as any).isAlive = true;
    ws.on('pong', () => {
      (ws as any).isAlive = true;
    });
  }

  private checkHeartbeats(): void {
    this.wss.clients.forEach((ws) => {
      if ((ws as any).isAlive === false) {
        this.logger.warn('Client failed heartbeat check, terminating connection');
        return ws.terminate();
      }

      (ws as any).isAlive = false;
      ws.ping();
    });
  }

  private negotiateVersion(clientVersion: string): { compatible: boolean; version: string } {
    // Simple version negotiation - accept 1.x.x versions
    const clientMajor = clientVersion.split('.')[0];
    const serverMajor = VERSION.split('.')[0];
    
    return {
      compatible: clientMajor === serverMajor,
      version: VERSION
    };
  }

  private sendError(ws: WebSocket, messageId: string, code: ErrorCode, message: string): void {
    const errorMessage: BridgeMessage = {
      version: VERSION,
      type: 'error',
      id: messageId,
      timestamp: Date.now(),
      source: 'minecraft', // Bridge acts as minecraft for error responses
      payload: {
        success: false,
        error: {
          code,
          message
        }
      }
    };

    ws.send(JSON.stringify(errorMessage));
  }

  private sendResponse(ws: WebSocket, messageId: string, payload: any): void {
    const response: BridgeMessage = {
      version: VERSION,
      type: 'response',
      id: messageId,
      timestamp: Date.now(),
      source: 'minecraft', // Bridge acts as minecraft for responses
      payload
    };

    ws.send(JSON.stringify(response));
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Stop latency monitoring
    this.latencyMonitor.stopReporting();
    
    // Generate final latency report
    this.latencyMonitor.reportStats();
    
    this.wss.close();
    this.logger.info('Bridge Server stopped');
  }
}

// Main entry point
if (require.main === module) {
  const config = loadConfig();
  const server = new BridgeServer(config);
  server.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    server.stop();
    process.exit(0);
  });
}

export { loadConfig } from './config';
