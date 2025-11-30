import { BridgeClient } from './bridge-client';
import { PlayerInfo, ServerInfo, WorldInfo } from '@minecraft-mcp-bridge/shared';

// Mock the BridgeClient
jest.mock('./bridge-client');

describe('Query Tool Handlers', () => {
  let mockBridgeClient: jest.Mocked<BridgeClient>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock instance
    mockBridgeClient = new BridgeClient({
      url: 'ws://localhost:8080',
      authToken: 'test-token',
      reconnectAttempts: 5,
      reconnectDelay: 1000
    }) as jest.Mocked<BridgeClient>;
  });

  describe('get_online_players', () => {
    it('should return list of online players', async () => {
      const expectedPlayers = ['Player1', 'Player2', 'Player3'];
      mockBridgeClient.sendQuery = jest.fn().mockResolvedValue(expectedPlayers);

      const result = await mockBridgeClient.sendQuery('get_online_players', {});

      expect(result).toEqual(expectedPlayers);
      expect(mockBridgeClient.sendQuery).toHaveBeenCalledWith('get_online_players', {});
    });

    it('should handle empty player list', async () => {
      mockBridgeClient.sendQuery = jest.fn().mockResolvedValue([]);

      const result = await mockBridgeClient.sendQuery('get_online_players', {});

      expect(result).toEqual([]);
    });

    it('should throw error on failure', async () => {
      mockBridgeClient.sendQuery = jest.fn().mockRejectedValue(new Error('Connection failed'));

      await expect(mockBridgeClient.sendQuery('get_online_players', {}))
        .rejects.toThrow('Connection failed');
    });
  });

  describe('get_player_info', () => {
    it('should return player information', async () => {
      const expectedInfo: PlayerInfo = {
        name: 'TestPlayer',
        uuid: '123e4567-e89b-12d3-a456-426614174000',
        health: 20,
        foodLevel: 20,
        location: { world: 'world', x: 100, y: 64, z: 200 },
        gameMode: 'SURVIVAL',
        inventory: [
          { type: 'diamond_sword', quantity: 1 },
          { type: 'bread', quantity: 16 }
        ]
      };
      mockBridgeClient.sendQuery = jest.fn().mockResolvedValue(expectedInfo);

      const result = await mockBridgeClient.sendQuery('get_player_info', { player: 'TestPlayer' });

      expect(result).toEqual(expectedInfo);
      expect(mockBridgeClient.sendQuery).toHaveBeenCalledWith('get_player_info', { player: 'TestPlayer' });
    });

    it('should throw error for non-existent player', async () => {
      mockBridgeClient.sendQuery = jest.fn().mockRejectedValue(
        new Error('[PLAYER_NOT_FOUND] Player not found')
      );

      await expect(mockBridgeClient.sendQuery('get_player_info', { player: 'NonExistent' }))
        .rejects.toThrow('PLAYER_NOT_FOUND');
    });
  });

  describe('get_server_info', () => {
    it('should return server information', async () => {
      const expectedInfo: ServerInfo = {
        version: '1.20.1',
        onlinePlayers: 5,
        maxPlayers: 20,
        timeOfDay: 6000,
        weather: 'clear',
        tps: 20.0
      };
      mockBridgeClient.sendQuery = jest.fn().mockResolvedValue(expectedInfo);

      const result = await mockBridgeClient.sendQuery('get_server_info', {});

      expect(result).toEqual(expectedInfo);
      expect(mockBridgeClient.sendQuery).toHaveBeenCalledWith('get_server_info', {});
    });
  });

  describe('get_world_info', () => {
    it('should return world information for given coordinates', async () => {
      const expectedInfo: WorldInfo = {
        blocks: [
          { type: 'stone', location: { world: 'world', x: 100, y: 64, z: 200 } },
          { type: 'dirt', location: { world: 'world', x: 101, y: 64, z: 200 } }
        ],
        entities: [
          { type: 'zombie', location: { world: 'world', x: 102, y: 64, z: 201 } }
        ]
      };
      mockBridgeClient.sendQuery = jest.fn().mockResolvedValue(expectedInfo);

      const result = await mockBridgeClient.sendQuery('get_world_info', {
        x: 100,
        y: 64,
        z: 200,
        radius: 10
      });

      expect(result).toEqual(expectedInfo);
      expect(mockBridgeClient.sendQuery).toHaveBeenCalledWith('get_world_info', {
        x: 100,
        y: 64,
        z: 200,
        radius: 10
      });
    });

    it('should handle empty world area', async () => {
      const expectedInfo: WorldInfo = {
        blocks: [],
        entities: []
      };
      mockBridgeClient.sendQuery = jest.fn().mockResolvedValue(expectedInfo);

      const result = await mockBridgeClient.sendQuery('get_world_info', {
        x: 0,
        y: 0,
        z: 0,
        radius: 5
      });

      expect(result).toEqual(expectedInfo);
    });
  });
});
