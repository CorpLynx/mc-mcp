import { BridgeMessage } from '@minecraft-mcp-bridge/shared';
import { ConnectionRegistry } from './connection-registry';
import { Logger } from './logger';
import { LatencyMonitor } from './latency-monitor';

interface QueuedMessage {
  message: BridgeMessage;
  sourceClientId: string;
  timestamp: number;
}

export class MessageRouter {
  private registry: ConnectionRegistry;
  private logger: Logger;
  private latencyMonitor: LatencyMonitor;
  private messageQueue: QueuedMessage[] = [];
  private maxQueueSize: number = 1000;
  // Cache for serialized messages to avoid re-serialization
  private serializationCache: Map<string, string> = new Map();
  private maxCacheSize: number = 100;

  constructor(registry: ConnectionRegistry, logger: Logger, latencyMonitor: LatencyMonitor, maxQueueSize: number = 1000) {
    this.registry = registry;
    this.logger = logger;
    this.latencyMonitor = latencyMonitor;
    this.maxQueueSize = maxQueueSize;
  }

  async routeMessage(message: BridgeMessage, sourceClientId: string): Promise<void> {
    const routeStart = Date.now();

    try {
      // Add timestamp when bridge receives the message
      message.receivedAt = routeStart;

      // Determine destination based on source
      const destinations = message.source === 'mcp' 
        ? this.registry.getMinecraftClients()
        : this.registry.getMCPClients();

      if (destinations.length === 0) {
        // Queue message if no destinations available
        this.queueMessage(message, sourceClientId);
        this.logger.warn('No destination clients available, message queued', {
          messageId: message.id,
          source: message.source,
          queueSize: this.messageQueue.length
        });
        return;
      }

      // Add timestamp when bridge forwards the message
      message.forwardedAt = Date.now();

      // Optimize: Serialize message once for all destinations
      const messageStr = this.serializeMessage(message);
      let successCount = 0;

      for (const dest of destinations) {
        try {
          dest.ws.send(messageStr);
          successCount++;
          
          const forwardLatency = Date.now() - routeStart;
          
          // Record latency metrics
          this.latencyMonitor.recordLatency(message.type, forwardLatency);
          
          this.logger.debug('Message forwarded', {
            messageId: message.id,
            type: message.type,
            source: message.source,
            destinationId: dest.id,
            latencyMs: forwardLatency
          });
        } catch (error) {
          this.logger.error('Failed to forward message to client', {
            messageId: message.id,
            destinationId: dest.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      if (successCount === 0) {
        // All forwards failed, queue the message
        this.queueMessage(message, sourceClientId);
      }

    } catch (error) {
      this.logger.error('Error routing message', {
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Optimized message serialization with caching for identical messages
   */
  private serializeMessage(message: BridgeMessage): string {
    // For most messages, we serialize directly (they're unique)
    // But we cache the serialization to avoid re-parsing if needed
    const cacheKey = `${message.id}_${message.timestamp}`;
    
    if (this.serializationCache.has(cacheKey)) {
      return this.serializationCache.get(cacheKey)!;
    }

    const serialized = JSON.stringify(message);
    
    // Manage cache size
    if (this.serializationCache.size >= this.maxCacheSize) {
      // Remove oldest entry (first key)
      const firstKey = this.serializationCache.keys().next().value;
      this.serializationCache.delete(firstKey);
    }
    
    this.serializationCache.set(cacheKey, serialized);
    return serialized;
  }

  private queueMessage(message: BridgeMessage, sourceClientId: string): void {
    // Check queue overflow
    if (this.messageQueue.length >= this.maxQueueSize) {
      // Remove oldest message
      const removed = this.messageQueue.shift();
      this.logger.warn('Message queue overflow, oldest message dropped', {
        droppedMessageId: removed?.message.id,
        queueSize: this.messageQueue.length
      });
    }

    this.messageQueue.push({
      message,
      sourceClientId,
      timestamp: Date.now()
    });
  }

  // Process queued messages when clients reconnect
  processQueue(): void {
    if (this.messageQueue.length === 0) {
      return;
    }

    this.logger.info('Processing queued messages', { count: this.messageQueue.length });

    const messagesToProcess = [...this.messageQueue];
    this.messageQueue = [];

    for (const queued of messagesToProcess) {
      this.routeMessage(queued.message, queued.sourceClientId).catch(error => {
        this.logger.error('Error processing queued message', {
          messageId: queued.message.id,
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }
  }

  getQueueSize(): number {
    return this.messageQueue.length;
  }
}
