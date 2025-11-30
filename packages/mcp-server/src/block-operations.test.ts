// Unit tests for block manipulation handlers
import { BridgeClient } from './bridge-client';
import { CommandResult } from '@minecraft-mcp-bridge/shared';

// Mock BridgeClient
jest.mock('./bridge-client');

describe('Block Manipulation Handlers', () => {
  let mockBridgeClient: jest.Mocked<BridgeClient>;

  beforeEach(() => {
    mockBridgeClient = new BridgeClient({
      url: 'ws://localhost:8080',
      authToken: 'test-token',
      reconnectAttempts: 5,
      reconnectDelay: 1000
    }) as jest.Mocked<BridgeClient>;
  });

  describe('place_block', () => {
    it('should forward place_block command to bridge server', async () => {
      const expectedResult: CommandResult = {
        success: true,
        message: 'Block placed'
      };

      mockBridgeClient.sendCommand = jest.fn().mockResolvedValue(expectedResult);

      const result = await mockBridgeClient.sendCommand('place_block', {
        x: 100,
        y: 64,
        z: 200,
        blockType: 'stone'
      });

      expect(mockBridgeClient.sendCommand).toHaveBeenCalledWith('place_block', {
        x: 100,
        y: 64,
        z: 200,
        blockType: 'stone'
      });
      expect(result).toEqual(expectedResult);
    });

    it('should forward place_block command with world parameter', async () => {
      const expectedResult: CommandResult = {
        success: true
      };

      mockBridgeClient.sendCommand = jest.fn().mockResolvedValue(expectedResult);

      const result = await mockBridgeClient.sendCommand('place_block', {
        x: 0,
        y: 100,
        z: 0,
        blockType: 'diamond_block',
        world: 'nether'
      });

      expect(mockBridgeClient.sendCommand).toHaveBeenCalledWith('place_block', {
        x: 0,
        y: 100,
        z: 0,
        blockType: 'diamond_block',
        world: 'nether'
      });
      expect(result).toEqual(expectedResult);
    });

    it('should handle invalid block type errors', async () => {
      mockBridgeClient.sendCommand = jest.fn().mockRejectedValue(
        new Error('[INVALID_BLOCK_TYPE] Block type does not exist: invalid_block')
      );

      await expect(mockBridgeClient.sendCommand('place_block', {
        x: 100,
        y: 64,
        z: 200,
        blockType: 'invalid_block'
      })).rejects.toThrow('[INVALID_BLOCK_TYPE] Block type does not exist');
    });
  });

  describe('break_block', () => {
    it('should forward break_block command to bridge server', async () => {
      const expectedResult: CommandResult = {
        success: true,
        message: 'Block broken'
      };

      mockBridgeClient.sendCommand = jest.fn().mockResolvedValue(expectedResult);

      const result = await mockBridgeClient.sendCommand('break_block', {
        x: 100,
        y: 64,
        z: 200
      });

      expect(mockBridgeClient.sendCommand).toHaveBeenCalledWith('break_block', {
        x: 100,
        y: 64,
        z: 200
      });
      expect(result).toEqual(expectedResult);
    });

    it('should forward break_block command with world parameter', async () => {
      const expectedResult: CommandResult = {
        success: true
      };

      mockBridgeClient.sendCommand = jest.fn().mockResolvedValue(expectedResult);

      const result = await mockBridgeClient.sendCommand('break_block', {
        x: 0,
        y: 100,
        z: 0,
        world: 'nether'
      });

      expect(mockBridgeClient.sendCommand).toHaveBeenCalledWith('break_block', {
        x: 0,
        y: 100,
        z: 0,
        world: 'nether'
      });
      expect(result).toEqual(expectedResult);
    });

    it('should handle chunk not loaded errors', async () => {
      mockBridgeClient.sendCommand = jest.fn().mockRejectedValue(
        new Error('[CHUNK_NOT_LOADED] Target chunk is not loaded')
      );

      await expect(mockBridgeClient.sendCommand('break_block', {
        x: 10000,
        y: 64,
        z: 10000
      })).rejects.toThrow('[CHUNK_NOT_LOADED] Target chunk is not loaded');
    });
  });

  describe('fill_region', () => {
    it('should forward fill_region command to bridge server', async () => {
      const expectedResult: CommandResult = {
        success: true,
        message: 'Region filled'
      };

      mockBridgeClient.sendCommand = jest.fn().mockResolvedValue(expectedResult);

      const result = await mockBridgeClient.sendCommand('fill_region', {
        x1: 100,
        y1: 64,
        z1: 200,
        x2: 110,
        y2: 74,
        z2: 210,
        blockType: 'stone'
      });

      expect(mockBridgeClient.sendCommand).toHaveBeenCalledWith('fill_region', {
        x1: 100,
        y1: 64,
        z1: 200,
        x2: 110,
        y2: 74,
        z2: 210,
        blockType: 'stone'
      });
      expect(result).toEqual(expectedResult);
    });

    it('should forward fill_region command with world parameter', async () => {
      const expectedResult: CommandResult = {
        success: true
      };

      mockBridgeClient.sendCommand = jest.fn().mockResolvedValue(expectedResult);

      const result = await mockBridgeClient.sendCommand('fill_region', {
        x1: 0,
        y1: 100,
        z1: 0,
        x2: 10,
        y2: 110,
        z2: 10,
        blockType: 'diamond_block',
        world: 'nether'
      });

      expect(mockBridgeClient.sendCommand).toHaveBeenCalledWith('fill_region', {
        x1: 0,
        y1: 100,
        z1: 0,
        x2: 10,
        y2: 110,
        z2: 10,
        blockType: 'diamond_block',
        world: 'nether'
      });
      expect(result).toEqual(expectedResult);
    });

    it('should handle region too large errors', async () => {
      mockBridgeClient.sendCommand = jest.fn().mockRejectedValue(
        new Error('[REGION_TOO_LARGE] Region exceeds size limit')
      );

      await expect(mockBridgeClient.sendCommand('fill_region', {
        x1: 0,
        y1: 0,
        z1: 0,
        x2: 1000,
        y2: 256,
        z2: 1000,
        blockType: 'stone'
      })).rejects.toThrow('[REGION_TOO_LARGE] Region exceeds size limit');
    });

    it('should handle invalid block type errors', async () => {
      mockBridgeClient.sendCommand = jest.fn().mockRejectedValue(
        new Error('[INVALID_BLOCK_TYPE] Block type does not exist: invalid_block')
      );

      await expect(mockBridgeClient.sendCommand('fill_region', {
        x1: 100,
        y1: 64,
        z1: 200,
        x2: 110,
        y2: 74,
        z2: 210,
        blockType: 'invalid_block'
      })).rejects.toThrow('[INVALID_BLOCK_TYPE] Block type does not exist');
    });
  });

  describe('replace_blocks', () => {
    it('should forward replace_blocks command to bridge server', async () => {
      const expectedResult: CommandResult = {
        success: true,
        message: 'Blocks replaced'
      };

      mockBridgeClient.sendCommand = jest.fn().mockResolvedValue(expectedResult);

      const result = await mockBridgeClient.sendCommand('replace_blocks', {
        x1: 100,
        y1: 64,
        z1: 200,
        x2: 110,
        y2: 74,
        z2: 210,
        sourceBlock: 'stone',
        targetBlock: 'diamond_block'
      });

      expect(mockBridgeClient.sendCommand).toHaveBeenCalledWith('replace_blocks', {
        x1: 100,
        y1: 64,
        z1: 200,
        x2: 110,
        y2: 74,
        z2: 210,
        sourceBlock: 'stone',
        targetBlock: 'diamond_block'
      });
      expect(result).toEqual(expectedResult);
    });

    it('should forward replace_blocks command with world parameter', async () => {
      const expectedResult: CommandResult = {
        success: true
      };

      mockBridgeClient.sendCommand = jest.fn().mockResolvedValue(expectedResult);

      const result = await mockBridgeClient.sendCommand('replace_blocks', {
        x1: 0,
        y1: 100,
        z1: 0,
        x2: 10,
        y2: 110,
        z2: 10,
        sourceBlock: 'dirt',
        targetBlock: 'grass_block',
        world: 'overworld'
      });

      expect(mockBridgeClient.sendCommand).toHaveBeenCalledWith('replace_blocks', {
        x1: 0,
        y1: 100,
        z1: 0,
        x2: 10,
        y2: 110,
        z2: 10,
        sourceBlock: 'dirt',
        targetBlock: 'grass_block',
        world: 'overworld'
      });
      expect(result).toEqual(expectedResult);
    });

    it('should handle region too large errors', async () => {
      mockBridgeClient.sendCommand = jest.fn().mockRejectedValue(
        new Error('[REGION_TOO_LARGE] Region exceeds size limit')
      );

      await expect(mockBridgeClient.sendCommand('replace_blocks', {
        x1: 0,
        y1: 0,
        z1: 0,
        x2: 1000,
        y2: 256,
        z2: 1000,
        sourceBlock: 'stone',
        targetBlock: 'diamond_block'
      })).rejects.toThrow('[REGION_TOO_LARGE] Region exceeds size limit');
    });

    it('should handle invalid source block type errors', async () => {
      mockBridgeClient.sendCommand = jest.fn().mockRejectedValue(
        new Error('[INVALID_BLOCK_TYPE] Block type does not exist: invalid_source')
      );

      await expect(mockBridgeClient.sendCommand('replace_blocks', {
        x1: 100,
        y1: 64,
        z1: 200,
        x2: 110,
        y2: 74,
        z2: 210,
        sourceBlock: 'invalid_source',
        targetBlock: 'stone'
      })).rejects.toThrow('[INVALID_BLOCK_TYPE] Block type does not exist');
    });

    it('should handle invalid target block type errors', async () => {
      mockBridgeClient.sendCommand = jest.fn().mockRejectedValue(
        new Error('[INVALID_BLOCK_TYPE] Block type does not exist: invalid_target')
      );

      await expect(mockBridgeClient.sendCommand('replace_blocks', {
        x1: 100,
        y1: 64,
        z1: 200,
        x2: 110,
        y2: 74,
        z2: 210,
        sourceBlock: 'stone',
        targetBlock: 'invalid_target'
      })).rejects.toThrow('[INVALID_BLOCK_TYPE] Block type does not exist');
    });
  });

  describe('error handling', () => {
    it('should handle invalid coordinates errors', async () => {
      mockBridgeClient.sendCommand = jest.fn().mockRejectedValue(
        new Error('[INVALID_COORDINATES] Coordinates outside world boundaries')
      );

      await expect(mockBridgeClient.sendCommand('place_block', {
        x: 100000,
        y: 1000,
        z: 100000,
        blockType: 'stone'
      })).rejects.toThrow('[INVALID_COORDINATES] Coordinates outside world boundaries');
    });

    it('should handle connection errors', async () => {
      mockBridgeClient.sendCommand = jest.fn().mockRejectedValue(
        new Error('[CONNECTION_ERROR] Not connected to Bridge Server')
      );

      await expect(mockBridgeClient.sendCommand('place_block', {
        x: 100,
        y: 64,
        z: 200,
        blockType: 'stone'
      })).rejects.toThrow('[CONNECTION_ERROR] Not connected to Bridge Server');
    });

    it('should handle timeout errors', async () => {
      mockBridgeClient.sendCommand = jest.fn().mockRejectedValue(
        new Error('[TIMEOUT] Request timed out after 30 seconds')
      );

      await expect(mockBridgeClient.sendCommand('fill_region', {
        x1: 0,
        y1: 0,
        z1: 0,
        x2: 100,
        y2: 100,
        z2: 100,
        blockType: 'stone'
      })).rejects.toThrow('[TIMEOUT] Request timed out after 30 seconds');
    });
  });
});
