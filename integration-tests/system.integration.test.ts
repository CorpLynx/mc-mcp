/**
 * Integration Tests for Minecraft MCP Bridge System
 * 
 * These tests verify the complete system behavior by starting all three components:
 * - Bridge Server
 * - MCP Server (simulated)
 * - Minecraft Mod (simulated)
 * 
 * Tests cover:
 * - Event flow: Minecraft event → Bridge → MCP notification
 * - Command flow: MCP tool invocation → Bridge → Minecraft execution
 * - Reconnection: Connection failure → automatic reconnection
 * - Authentication: Invalid token → connection rejection
 * - Authorization: Unauthorized command → rejection
 * 
 * Validates: Requirements 6.5
 */

import WebSocket from 'ws';
import { BridgeServer, loadConfig as loadBridgeConfig } from '../packages/bridge-server/src/index';
import {
  BridgeMessage,
  GameEvent,
  CommandResult,
  MessageSource,
  ErrorCode
} from '../packages/shared/src/types';

// Test configuration
const TEST_PORT = 18080;
const TEST_MCP_TOKEN = 'test-mcp-token-123';
const TEST_MINECRAFT_TOKEN = 'test-minecraft-token-456';
const INVALID_TOKEN = 'invalid-token-999';

describe('Minecraft MCP Bridge Integration Tests', () => {
  let bridgeServer: BridgeServer;
  let mcpClient: WebSocket | null = null;
  let minecraftClient: WebSocket | null = null;

  beforeAll(() => {
    // Set up test environment variables
    process.env.PORT = TEST_PORT.toString();
    process.env.MCP_AUTH_TOKENS = TEST_MCP_TOKEN;
    process.env.MINECRAFT_AUTH_TOKEN = TEST_MINECRAFT_TOKEN;
    process.env.MESSAGE_QUEUE_SIZE = '1000';
    process.env.HEARTBEAT_INTERVAL = '30000';
    process.env.LOG_LEVEL = 'error'; // Reduce noise in tests

    // Start Bridge Server
    const config = loadBridgeConfig();
    bridgeServer = new BridgeServer(config);
    bridgeServer.start();
  });

  afterAll((done) => {
    // Stop Bridge Server
    bridgeServer.stop();
    
    // Give time for cleanup
    setTimeout(done, 1000);
  });

  afterEach((done) => {
    // Clean up connections after each test
    if (mcpClient) {
      mcpClient.close();
      mcpClient = null;
    }
    if (minecraftClient) {
      minecraftClient.close();
      minecraftClient = null;
    }
    
    // Give time for connections to close
    setTimeout(done, 500);
  });

  /**
   * Helper function to create and authenticate a client
   */
  async function createAuthenticatedClient(
    clientType: MessageSource,
    authToken: string
  ): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
      
      ws.on('open', () => {
        // Send authentication message
        const authMessage: BridgeMessage = {
          version: '1.0.0',
          type: 'command',
          id: `auth-${Date.now()}`,
          timestamp: Date.now(),
          source: clientType,
          payload: {
            authToken
          }
        };
        
        ws.send(JSON.stringify(authMessage));
      });

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString()) as BridgeMessage;
        
        // Check for authentication response
        if (message.type === 'response') {
          const payload = message.payload as any;
          if (payload.success) {
            resolve(ws);
          } else {
            reject(new Error('Authentication failed'));
          }
        } else if (message.type === 'error') {
          reject(new Error('Authentication error'));
        }
      });

      ws.on('error', (error) => {
        reject(error);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, 5000);
    });
  }

  /**
   * Helper function to send a message and wait for response
   */
  async function sendAndWaitForResponse(
    ws: WebSocket,
    message: BridgeMessage,
    timeoutMs: number = 5000
  ): Promise<BridgeMessage> {
    return new Promise((resolve, reject) => {
      const messageHandler = (data: Buffer) => {
        const response = JSON.parse(data.toString()) as BridgeMessage;
        
        // Match response by ID
        if (response.id === message.id) {
          ws.removeListener('message', messageHandler);
          clearTimeout(timeout);
          resolve(response);
        }
      };

      ws.on('message', messageHandler);

      ws.send(JSON.stringify(message), (error) => {
        if (error) {
          ws.removeListener('message', messageHandler);
          reject(error);
        }
      });

      const timeout = setTimeout(() => {
        ws.removeListener('message', messageHandler);
        reject(new Error('Response timeout'));
      }, timeoutMs);
    });
  }

  /**
   * Test 1: Event Flow
   * Trigger Minecraft event → verify MCP notification
   */
  describe('Event Flow', () => {
    it('should forward player join event from Minecraft to MCP', async () => {
      // Authenticate both clients
      mcpClient = await createAuthenticatedClient('mcp', TEST_MCP_TOKEN);
      minecraftClient = await createAuthenticatedClient('minecraft', TEST_MINECRAFT_TOKEN);

      // Set up MCP client to receive events
      const eventReceived = new Promise<GameEvent>((resolve) => {
        mcpClient!.on('message', (data: Buffer) => {
          const message = JSON.parse(data.toString()) as BridgeMessage;
          
          if (message.type === 'event') {
            resolve(message.payload as GameEvent);
          }
        });
      });

      // Simulate Minecraft sending a player join event
      const playerJoinEvent: GameEvent = {
        eventType: 'player_join',
        timestamp: Date.now(),
        data: {
          player: 'TestPlayer',
          uuid: '12345678-1234-1234-1234-123456789abc'
        }
      };

      const eventMessage: BridgeMessage = {
        version: '1.0.0',
        type: 'event',
        id: `event-${Date.now()}`,
        timestamp: Date.now(),
        source: 'minecraft',
        payload: playerJoinEvent
      };

      minecraftClient.send(JSON.stringify(eventMessage));

      // Wait for event to be received by MCP client
      const receivedEvent = await eventReceived;

      // Verify event was forwarded correctly
      expect(receivedEvent.eventType).toBe('player_join');
      expect((receivedEvent.data as any).player).toBe('TestPlayer');
      expect((receivedEvent.data as any).uuid).toBe('12345678-1234-1234-1234-123456789abc');
    });

    it('should forward player chat event from Minecraft to MCP', async () => {
      mcpClient = await createAuthenticatedClient('mcp', TEST_MCP_TOKEN);
      minecraftClient = await createAuthenticatedClient('minecraft', TEST_MINECRAFT_TOKEN);

      const eventReceived = new Promise<GameEvent>((resolve) => {
        mcpClient!.on('message', (data: Buffer) => {
          const message = JSON.parse(data.toString()) as BridgeMessage;
          
          if (message.type === 'event') {
            resolve(message.payload as GameEvent);
          }
        });
      });

      const chatEvent: GameEvent = {
        eventType: 'player_chat',
        timestamp: Date.now(),
        data: {
          player: 'TestPlayer',
          message: 'Hello, world!'
        }
      };

      const eventMessage: BridgeMessage = {
        version: '1.0.0',
        type: 'event',
        id: `event-${Date.now()}`,
        timestamp: Date.now(),
        source: 'minecraft',
        payload: chatEvent
      };

      minecraftClient.send(JSON.stringify(eventMessage));

      const receivedEvent = await eventReceived;

      expect(receivedEvent.eventType).toBe('player_chat');
      expect((receivedEvent.data as any).player).toBe('TestPlayer');
      expect((receivedEvent.data as any).message).toBe('Hello, world!');
    });
  });

  /**
   * Test 2: Command Flow
   * Invoke MCP tool → verify Minecraft command execution
   */
  describe('Command Flow', () => {
    it('should forward execute_command from MCP to Minecraft and return result', async () => {
      mcpClient = await createAuthenticatedClient('mcp', TEST_MCP_TOKEN);
      minecraftClient = await createAuthenticatedClient('minecraft', TEST_MINECRAFT_TOKEN);

      // Set up Minecraft client to respond to commands
      minecraftClient.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString()) as BridgeMessage;
        
        if (message.type === 'command') {
          // Simulate successful command execution
          const response: BridgeMessage = {
            version: '1.0.0',
            type: 'response',
            id: message.id,
            timestamp: Date.now(),
            source: 'minecraft',
            payload: {
              success: true,
              data: {
                success: true,
                message: 'Command executed successfully'
              }
            }
          };
          
          minecraftClient!.send(JSON.stringify(response));
        }
      });

      // Send command from MCP client
      const commandMessage: BridgeMessage = {
        version: '1.0.0',
        type: 'command',
        id: `cmd-${Date.now()}`,
        timestamp: Date.now(),
        source: 'mcp',
        payload: {
          command: 'execute_command',
          args: {
            command: 'say Hello from MCP'
          }
        }
      };

      const response = await sendAndWaitForResponse(mcpClient, commandMessage);

      expect(response.type).toBe('response');
      expect((response.payload as any).success).toBe(true);
      expect((response.payload as any).data.success).toBe(true);
    });

    it('should forward send_message command from MCP to Minecraft', async () => {
      mcpClient = await createAuthenticatedClient('mcp', TEST_MCP_TOKEN);
      minecraftClient = await createAuthenticatedClient('minecraft', TEST_MINECRAFT_TOKEN);

      const commandReceived = new Promise<BridgeMessage>((resolve) => {
        minecraftClient!.on('message', (data: Buffer) => {
          const message = JSON.parse(data.toString()) as BridgeMessage;
          
          if (message.type === 'command') {
            resolve(message);
            
            // Send success response
            const response: BridgeMessage = {
              version: '1.0.0',
              type: 'response',
              id: message.id,
              timestamp: Date.now(),
              source: 'minecraft',
              payload: {
                success: true,
                data: { success: true }
              }
            };
            
            minecraftClient!.send(JSON.stringify(response));
          }
        });
      });

      const commandMessage: BridgeMessage = {
        version: '1.0.0',
        type: 'command',
        id: `cmd-${Date.now()}`,
        timestamp: Date.now(),
        source: 'mcp',
        payload: {
          command: 'send_message',
          args: {
            message: 'Test message',
            target: 'TestPlayer'
          }
        }
      };

      mcpClient.send(JSON.stringify(commandMessage));

      const receivedCommand = await commandReceived;

      expect(receivedCommand.type).toBe('command');
      expect((receivedCommand.payload as any).command).toBe('send_message');
      expect((receivedCommand.payload as any).args.message).toBe('Test message');
      expect((receivedCommand.payload as any).args.target).toBe('TestPlayer');
    });

    it('should handle command errors from Minecraft', async () => {
      mcpClient = await createAuthenticatedClient('mcp', TEST_MCP_TOKEN);
      minecraftClient = await createAuthenticatedClient('minecraft', TEST_MINECRAFT_TOKEN);

      minecraftClient.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString()) as BridgeMessage;
        
        if (message.type === 'command') {
          // Simulate command failure
          const response: BridgeMessage = {
            version: '1.0.0',
            type: 'response',
            id: message.id,
            timestamp: Date.now(),
            source: 'minecraft',
            payload: {
              success: false,
              error: 'Player not found'
            }
          };
          
          minecraftClient!.send(JSON.stringify(response));
        }
      });

      const commandMessage: BridgeMessage = {
        version: '1.0.0',
        type: 'command',
        id: `cmd-${Date.now()}`,
        timestamp: Date.now(),
        source: 'mcp',
        payload: {
          command: 'teleport_player',
          args: {
            player: 'NonExistentPlayer',
            x: 100,
            y: 64,
            z: 100
          }
        }
      };

      const response = await sendAndWaitForResponse(mcpClient, commandMessage);

      expect(response.type).toBe('response');
      expect((response.payload as any).success).toBe(false);
      expect((response.payload as any).error).toBe('Player not found');
    });
  });

  /**
   * Test 3: Reconnection
   * Kill connection → verify automatic reconnection
   */
  describe('Reconnection', () => {
    it('should allow client to reconnect after disconnection', async () => {
      // Create and authenticate initial connection
      mcpClient = await createAuthenticatedClient('mcp', TEST_MCP_TOKEN);

      // Verify connection is established
      expect(mcpClient.readyState).toBe(WebSocket.OPEN);

      // Close the connection
      mcpClient.close();

      // Wait for connection to close
      await new Promise((resolve) => {
        mcpClient!.on('close', resolve);
      });

      // Wait a bit before reconnecting
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Reconnect
      mcpClient = await createAuthenticatedClient('mcp', TEST_MCP_TOKEN);

      // Verify reconnection is successful
      expect(mcpClient.readyState).toBe(WebSocket.OPEN);

      // Verify we can still send messages after reconnection
      minecraftClient = await createAuthenticatedClient('minecraft', TEST_MINECRAFT_TOKEN);

      const eventReceived = new Promise<GameEvent>((resolve) => {
        mcpClient!.on('message', (data: Buffer) => {
          const message = JSON.parse(data.toString()) as BridgeMessage;
          
          if (message.type === 'event') {
            resolve(message.payload as GameEvent);
          }
        });
      });

      const testEvent: GameEvent = {
        eventType: 'player_join',
        timestamp: Date.now(),
        data: {
          player: 'ReconnectTest',
          uuid: '99999999-9999-9999-9999-999999999999'
        }
      };

      const eventMessage: BridgeMessage = {
        version: '1.0.0',
        type: 'event',
        id: `event-${Date.now()}`,
        timestamp: Date.now(),
        source: 'minecraft',
        payload: testEvent
      };

      minecraftClient.send(JSON.stringify(eventMessage));

      const receivedEvent = await eventReceived;

      expect(receivedEvent.eventType).toBe('player_join');
      expect((receivedEvent.data as any).player).toBe('ReconnectTest');
    });
  });

  /**
   * Test 4: Authentication
   * Connect with invalid token → verify rejection
   */
  describe('Authentication', () => {
    it('should reject connection with invalid token', async () => {
      await expect(
        createAuthenticatedClient('mcp', INVALID_TOKEN)
      ).rejects.toThrow();
    });

    it('should reject connection with missing token', async () => {
      const connectionFailed = new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
        
        ws.on('open', () => {
          // Send authentication message without token
          const authMessage: BridgeMessage = {
            version: '1.0.0',
            type: 'command',
            id: `auth-${Date.now()}`,
            timestamp: Date.now(),
            source: 'mcp',
            payload: {}
          };
          
          ws.send(JSON.stringify(authMessage));
        });

        ws.on('message', (data: Buffer) => {
          const message = JSON.parse(data.toString()) as BridgeMessage;
          
          if (message.type === 'error') {
            ws.close();
            resolve();
          }
        });

        ws.on('close', () => {
          resolve();
        });

        ws.on('error', () => {
          resolve();
        });

        setTimeout(() => {
          reject(new Error('Expected connection to be rejected'));
        }, 5000);
      });

      await connectionFailed;
    });

    it('should accept connection with valid MCP token', async () => {
      mcpClient = await createAuthenticatedClient('mcp', TEST_MCP_TOKEN);
      expect(mcpClient.readyState).toBe(WebSocket.OPEN);
    });

    it('should accept connection with valid Minecraft token', async () => {
      minecraftClient = await createAuthenticatedClient('minecraft', TEST_MINECRAFT_TOKEN);
      expect(minecraftClient.readyState).toBe(WebSocket.OPEN);
    });
  });

  /**
   * Test 5: Authorization
   * Invoke unauthorized command → verify rejection
   */
  describe('Authorization', () => {
    it('should reject dangerous commands from MCP client', async () => {
      mcpClient = await createAuthenticatedClient('mcp', TEST_MCP_TOKEN);
      minecraftClient = await createAuthenticatedClient('minecraft', TEST_MINECRAFT_TOKEN);

      // Try to execute a dangerous command (e.g., 'stop')
      const dangerousCommand: BridgeMessage = {
        version: '1.0.0',
        type: 'command',
        id: `cmd-${Date.now()}`,
        timestamp: Date.now(),
        source: 'mcp',
        payload: {
          command: 'execute_command',
          args: {
            command: 'stop'
          }
        }
      };

      const response = await sendAndWaitForResponse(mcpClient, dangerousCommand);

      expect(response.type).toBe('error');
      expect((response.payload as any).error.code).toBe(ErrorCode.PERMISSION_DENIED);
    });

    it('should reject events from MCP client', async () => {
      mcpClient = await createAuthenticatedClient('mcp', TEST_MCP_TOKEN);

      // Try to send an event from MCP client (should be rejected)
      const unauthorizedEvent: BridgeMessage = {
        version: '1.0.0',
        type: 'event',
        id: `event-${Date.now()}`,
        timestamp: Date.now(),
        source: 'mcp',
        payload: {
          eventType: 'player_join',
          timestamp: Date.now(),
          data: {
            player: 'Hacker',
            uuid: '00000000-0000-0000-0000-000000000000'
          }
        }
      };

      const response = await sendAndWaitForResponse(mcpClient, unauthorizedEvent, 3000);

      expect(response.type).toBe('error');
      expect((response.payload as any).error.code).toBe(ErrorCode.PERMISSION_DENIED);
    });

    it('should reject commands from Minecraft client', async () => {
      minecraftClient = await createAuthenticatedClient('minecraft', TEST_MINECRAFT_TOKEN);

      // Try to send a command from Minecraft client (should be rejected)
      const unauthorizedCommand: BridgeMessage = {
        version: '1.0.0',
        type: 'command',
        id: `cmd-${Date.now()}`,
        timestamp: Date.now(),
        source: 'minecraft',
        payload: {
          command: 'execute_command',
          args: {
            command: 'say Unauthorized'
          }
        }
      };

      const response = await sendAndWaitForResponse(minecraftClient, unauthorizedCommand, 3000);

      expect(response.type).toBe('error');
      expect((response.payload as any).error.code).toBe(ErrorCode.PERMISSION_DENIED);
    });
  });

  /**
   * Test 6: Query Flow
   * Test query commands from MCP to Minecraft
   */
  describe('Query Flow', () => {
    it('should forward get_online_players query from MCP to Minecraft', async () => {
      mcpClient = await createAuthenticatedClient('mcp', TEST_MCP_TOKEN);
      minecraftClient = await createAuthenticatedClient('minecraft', TEST_MINECRAFT_TOKEN);

      minecraftClient.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString()) as BridgeMessage;
        
        if (message.type === 'query') {
          // Simulate query response
          const response: BridgeMessage = {
            version: '1.0.0',
            type: 'response',
            id: message.id,
            timestamp: Date.now(),
            source: 'minecraft',
            payload: {
              success: true,
              data: ['Player1', 'Player2', 'Player3']
            }
          };
          
          minecraftClient!.send(JSON.stringify(response));
        }
      });

      const queryMessage: BridgeMessage = {
        version: '1.0.0',
        type: 'query',
        id: `query-${Date.now()}`,
        timestamp: Date.now(),
        source: 'mcp',
        payload: {
          query: 'get_online_players',
          args: {}
        }
      };

      const response = await sendAndWaitForResponse(mcpClient, queryMessage);

      expect(response.type).toBe('response');
      expect((response.payload as any).success).toBe(true);
      expect((response.payload as any).data).toEqual(['Player1', 'Player2', 'Player3']);
    });

    it('should handle query errors from Minecraft', async () => {
      mcpClient = await createAuthenticatedClient('mcp', TEST_MCP_TOKEN);
      minecraftClient = await createAuthenticatedClient('minecraft', TEST_MINECRAFT_TOKEN);

      minecraftClient.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString()) as BridgeMessage;
        
        if (message.type === 'query') {
          // Simulate query error
          const response: BridgeMessage = {
            version: '1.0.0',
            type: 'response',
            id: message.id,
            timestamp: Date.now(),
            source: 'minecraft',
            payload: {
              success: false,
              error: 'Player not found'
            }
          };
          
          minecraftClient!.send(JSON.stringify(response));
        }
      });

      const queryMessage: BridgeMessage = {
        version: '1.0.0',
        type: 'query',
        id: `query-${Date.now()}`,
        timestamp: Date.now(),
        source: 'mcp',
        payload: {
          query: 'get_player_info',
          args: {
            player: 'NonExistentPlayer'
          }
        }
      };

      const response = await sendAndWaitForResponse(mcpClient, queryMessage);

      expect(response.type).toBe('response');
      expect((response.payload as any).success).toBe(false);
      expect((response.payload as any).error).toBe('Player not found');
    });
  });

  /**
   * Test 7: Message Latency
   * Verify messages are forwarded within acceptable time limits
   */
  describe('Message Latency', () => {
    it('should forward events within 100ms', async () => {
      mcpClient = await createAuthenticatedClient('mcp', TEST_MCP_TOKEN);
      minecraftClient = await createAuthenticatedClient('minecraft', TEST_MINECRAFT_TOKEN);

      const startTime = Date.now();
      
      const eventReceived = new Promise<number>((resolve) => {
        mcpClient!.on('message', (data: Buffer) => {
          const message = JSON.parse(data.toString()) as BridgeMessage;
          
          if (message.type === 'event') {
            const endTime = Date.now();
            resolve(endTime - startTime);
          }
        });
      });

      const testEvent: GameEvent = {
        eventType: 'player_chat',
        timestamp: Date.now(),
        data: {
          player: 'LatencyTest',
          message: 'Testing latency'
        }
      };

      const eventMessage: BridgeMessage = {
        version: '1.0.0',
        type: 'event',
        id: `event-${Date.now()}`,
        timestamp: Date.now(),
        source: 'minecraft',
        payload: testEvent
      };

      minecraftClient.send(JSON.stringify(eventMessage));

      const latency = await eventReceived;

      // Verify latency is within acceptable range (100ms requirement)
      expect(latency).toBeLessThan(100);
    });
  });
});
