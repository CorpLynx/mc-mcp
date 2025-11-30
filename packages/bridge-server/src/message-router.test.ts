import { MessageRouter } from './message-router';
import { ConnectionRegistry } from './connection-registry';
import { Logger } from './logger';
import { LatencyMonitor } from './latency-monitor';
import { BridgeMessage } from '@minecraft-mcp-bridge/shared';
import WebSocket from 'ws';

// Mock WebSocket
class MockWebSocket {
  sent: string[] = [];
  
  send(data: string): void {
    this.sent.push(data);
  }
}

describe('MessageRouter', () => {
  let router: MessageRouter;
  let registry: ConnectionRegistry;
  let logger: Logger;
  let latencyMonitor: LatencyMonitor;

  beforeEach(() => {
    logger = new Logger('error');
    registry = new ConnectionRegistry(logger);
    latencyMonitor = new LatencyMonitor(logger);
    router = new MessageRouter(registry, logger, latencyMonitor);
  });

  describe('routeMessage with latency tracking', () => {
    it('should add receivedAt and forwardedAt timestamps to messages', async () => {
      const mockWs = new MockWebSocket() as any;
      registry.addClient('client1', mockWs, 'minecraft', '1.0.0');

      const message: BridgeMessage = {
        version: '1.0.0',
        type: 'command',
        id: 'msg1',
        timestamp: Date.now(),
        source: 'mcp',
        payload: { command: 'test', args: {} }
      };

      await router.routeMessage(message, 'source1');

      expect(message.receivedAt).toBeDefined();
      expect(message.forwardedAt).toBeDefined();
      expect(message.forwardedAt).toBeGreaterThanOrEqual(message.receivedAt!);
    });

    it('should record latency metrics when forwarding messages', async () => {
      const mockWs = new MockWebSocket() as any;
      registry.addClient('client1', mockWs, 'minecraft', '1.0.0');

      const message: BridgeMessage = {
        version: '1.0.0',
        type: 'event',
        id: 'msg1',
        timestamp: Date.now(),
        source: 'mcp',
        payload: {}
      };

      await router.routeMessage(message, 'source1');

      const stats = latencyMonitor.getStats();
      expect(stats.overall.count).toBe(1);
      expect(stats.byType['event']).toBeDefined();
      expect(stats.byType['event'].count).toBe(1);
    });

    it('should forward messages to correct destinations', async () => {
      const mcpWs = new MockWebSocket() as any;
      const minecraftWs = new MockWebSocket() as any;
      
      registry.addClient('mcp1', mcpWs, 'mcp', '1.0.0');
      registry.addClient('minecraft1', minecraftWs, 'minecraft', '1.0.0');

      // Message from MCP should go to Minecraft
      const mcpMessage: BridgeMessage = {
        version: '1.0.0',
        type: 'command',
        id: 'msg1',
        timestamp: Date.now(),
        source: 'mcp',
        payload: {}
      };

      await router.routeMessage(mcpMessage, 'mcp1');
      expect(minecraftWs.sent.length).toBe(1);
      expect(mcpWs.sent.length).toBe(0);

      // Message from Minecraft should go to MCP
      const minecraftMessage: BridgeMessage = {
        version: '1.0.0',
        type: 'event',
        id: 'msg2',
        timestamp: Date.now(),
        source: 'minecraft',
        payload: {}
      };

      await router.routeMessage(minecraftMessage, 'minecraft1');
      expect(mcpWs.sent.length).toBe(1);
      expect(minecraftWs.sent.length).toBe(1);
    });

    it('should serialize message only once for multiple destinations', async () => {
      const mcp1 = new MockWebSocket() as any;
      const mcp2 = new MockWebSocket() as any;
      
      registry.addClient('mcp1', mcp1, 'mcp', '1.0.0');
      registry.addClient('mcp2', mcp2, 'mcp', '1.0.0');

      const message: BridgeMessage = {
        version: '1.0.0',
        type: 'event',
        id: 'msg1',
        timestamp: Date.now(),
        source: 'minecraft',
        payload: { test: 'data' }
      };

      await router.routeMessage(message, 'minecraft1');

      // Both clients should receive the same serialized message
      expect(mcp1.sent.length).toBe(1);
      expect(mcp2.sent.length).toBe(1);
      expect(mcp1.sent[0]).toBe(mcp2.sent[0]);
    });

    it('should measure latency under 100ms for fast operations', async () => {
      const mockWs = new MockWebSocket() as any;
      registry.addClient('client1', mockWs, 'minecraft', '1.0.0');

      const message: BridgeMessage = {
        version: '1.0.0',
        type: 'command',
        id: 'msg1',
        timestamp: Date.now(),
        source: 'mcp',
        payload: {}
      };

      await router.routeMessage(message, 'source1');

      const stats = latencyMonitor.getStats();
      // Latency should be very low for this simple operation
      expect(stats.overall.avgMs).toBeLessThan(100);
      expect(stats.overall.over100ms).toBe(0);
    });
  });

  describe('message queueing', () => {
    it('should queue messages when no destinations available', async () => {
      const message: BridgeMessage = {
        version: '1.0.0',
        type: 'command',
        id: 'msg1',
        timestamp: Date.now(),
        source: 'mcp',
        payload: {}
      };

      await router.routeMessage(message, 'source1');

      expect(router.getQueueSize()).toBe(1);
    });
  });
});
