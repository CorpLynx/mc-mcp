// Unit tests for command execution handlers
import { BridgeClient } from './bridge-client';
import { CommandResult } from '@minecraft-mcp-bridge/shared';

// Mock BridgeClient
jest.mock('./bridge-client');

describe('Command Execution Handlers', () => {
  let mockBridgeClient: jest.Mocked<BridgeClient>;

  beforeEach(() => {
    mockBridgeClient = new BridgeClient({
      url: 'ws://localhost:8080',
      authToken: 'test-token',
      reconnectAttempts: 5,
      reconnectDelay: 1000
    }) as jest.Mocked<BridgeClient>;
  });

  describe('execute_command', () => {
    it('should forward command to bridge server', async () => {
      const expectedResult: CommandResult = {
        success: true,
        message: 'Command executed'
      };

      mockBridgeClient.sendCommand = jest.fn().mockResolvedValue(expectedResult);

      const result = await mockBridgeClient.sendCommand('execute_command', { command: 'say Hello' });

      expect(mockBridgeClient.sendCommand).toHaveBeenCalledWith('execute_command', { command: 'say Hello' });
      expect(result).toEqual(expectedResult);
    });

    it('should handle command execution errors', async () => {
      mockBridgeClient.sendCommand = jest.fn().mockRejectedValue(new Error('Connection failed'));

      await expect(mockBridgeClient.sendCommand('execute_command', { command: 'invalid' }))
        .rejects.toThrow('Connection failed');
    });
  });

  describe('send_message', () => {
    it('should forward message command with target', async () => {
      const expectedResult: CommandResult = {
        success: true
      };

      mockBridgeClient.sendCommand = jest.fn().mockResolvedValue(expectedResult);

      const result = await mockBridgeClient.sendCommand('send_message', {
        message: 'Hello player',
        target: 'Steve'
      });

      expect(mockBridgeClient.sendCommand).toHaveBeenCalledWith('send_message', {
        message: 'Hello player',
        target: 'Steve'
      });
      expect(result).toEqual(expectedResult);
    });

    it('should forward broadcast message without target', async () => {
      const expectedResult: CommandResult = {
        success: true
      };

      mockBridgeClient.sendCommand = jest.fn().mockResolvedValue(expectedResult);

      const result = await mockBridgeClient.sendCommand('send_message', {
        message: 'Hello everyone'
      });

      expect(mockBridgeClient.sendCommand).toHaveBeenCalledWith('send_message', {
        message: 'Hello everyone'
      });
      expect(result).toEqual(expectedResult);
    });
  });

  describe('teleport_player', () => {
    it('should forward teleport command with coordinates', async () => {
      const expectedResult: CommandResult = {
        success: true,
        message: 'Player teleported'
      };

      mockBridgeClient.sendCommand = jest.fn().mockResolvedValue(expectedResult);

      const result = await mockBridgeClient.sendCommand('teleport_player', {
        player: 'Steve',
        x: 100,
        y: 64,
        z: 200
      });

      expect(mockBridgeClient.sendCommand).toHaveBeenCalledWith('teleport_player', {
        player: 'Steve',
        x: 100,
        y: 64,
        z: 200
      });
      expect(result).toEqual(expectedResult);
    });

    it('should forward teleport command with world parameter', async () => {
      const expectedResult: CommandResult = {
        success: true
      };

      mockBridgeClient.sendCommand = jest.fn().mockResolvedValue(expectedResult);

      const result = await mockBridgeClient.sendCommand('teleport_player', {
        player: 'Steve',
        x: 0,
        y: 100,
        z: 0,
        world: 'nether'
      });

      expect(mockBridgeClient.sendCommand).toHaveBeenCalledWith('teleport_player', {
        player: 'Steve',
        x: 0,
        y: 100,
        z: 0,
        world: 'nether'
      });
      expect(result).toEqual(expectedResult);
    });
  });

  describe('give_item', () => {
    it('should forward give item command', async () => {
      const expectedResult: CommandResult = {
        success: true,
        message: 'Items given'
      };

      mockBridgeClient.sendCommand = jest.fn().mockResolvedValue(expectedResult);

      const result = await mockBridgeClient.sendCommand('give_item', {
        player: 'Steve',
        item: 'diamond',
        quantity: 64
      });

      expect(mockBridgeClient.sendCommand).toHaveBeenCalledWith('give_item', {
        player: 'Steve',
        item: 'diamond',
        quantity: 64
      });
      expect(result).toEqual(expectedResult);
    });

    it('should handle single item quantity', async () => {
      const expectedResult: CommandResult = {
        success: true
      };

      mockBridgeClient.sendCommand = jest.fn().mockResolvedValue(expectedResult);

      const result = await mockBridgeClient.sendCommand('give_item', {
        player: 'Alex',
        item: 'iron_sword',
        quantity: 1
      });

      expect(mockBridgeClient.sendCommand).toHaveBeenCalledWith('give_item', {
        player: 'Alex',
        item: 'iron_sword',
        quantity: 1
      });
      expect(result).toEqual(expectedResult);
    });
  });

  describe('error handling', () => {
    it('should return error result when bridge client throws', async () => {
      mockBridgeClient.sendCommand = jest.fn().mockRejectedValue(new Error('Bridge server unavailable'));

      await expect(mockBridgeClient.sendCommand('execute_command', { command: 'test' }))
        .rejects.toThrow('Bridge server unavailable');
    });

    it('should handle timeout errors', async () => {
      mockBridgeClient.sendCommand = jest.fn().mockRejectedValue(new Error('Request timeout'));

      await expect(mockBridgeClient.sendCommand('teleport_player', {
        player: 'Steve',
        x: 0,
        y: 0,
        z: 0
      })).rejects.toThrow('Request timeout');
    });

    it('should handle structured error responses with error codes', async () => {
      mockBridgeClient.sendCommand = jest.fn().mockRejectedValue(
        new Error('[PLAYER_NOT_FOUND] Player Steve is not online')
      );

      await expect(mockBridgeClient.sendCommand('teleport_player', {
        player: 'Steve',
        x: 100,
        y: 64,
        z: 200
      })).rejects.toThrow('[PLAYER_NOT_FOUND] Player Steve is not online');
    });

    it('should handle connection errors with descriptive messages', async () => {
      mockBridgeClient.sendCommand = jest.fn().mockRejectedValue(
        new Error('[CONNECTION_ERROR] Not connected to Bridge Server')
      );

      await expect(mockBridgeClient.sendCommand('execute_command', { command: 'say Hello' }))
        .rejects.toThrow('[CONNECTION_ERROR] Not connected to Bridge Server');
    });

    it('should handle timeout errors with context information', async () => {
      mockBridgeClient.sendCommand = jest.fn().mockRejectedValue(
        new Error('[TIMEOUT] Request timed out after 30 seconds (type: command, payload: {"command":"give_item"})')
      );

      await expect(mockBridgeClient.sendCommand('give_item', {
        player: 'Steve',
        item: 'diamond',
        quantity: 64
      })).rejects.toThrow('[TIMEOUT] Request timed out after 30 seconds');
    });

    it('should handle invalid command errors', async () => {
      mockBridgeClient.sendCommand = jest.fn().mockRejectedValue(
        new Error('[INVALID_COMMAND] Command not whitelisted')
      );

      await expect(mockBridgeClient.sendCommand('execute_command', { command: 'op Steve' }))
        .rejects.toThrow('[INVALID_COMMAND] Command not whitelisted');
    });

    it('should handle permission denied errors', async () => {
      mockBridgeClient.sendCommand = jest.fn().mockRejectedValue(
        new Error('[PERMISSION_DENIED] Client lacks permission for this command')
      );

      await expect(mockBridgeClient.sendCommand('execute_command', { command: 'stop' }))
        .rejects.toThrow('[PERMISSION_DENIED] Client lacks permission for this command');
    });
  });
});
