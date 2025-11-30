package com.minecraft.mcp.bridge;

import com.google.gson.JsonObject;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

/**
 * Handles block manipulation operations including placing, breaking, filling regions,
 * and replacing blocks. Implements chunked processing for large operations to avoid
 * blocking the main server thread.
 */
public class BlockOperationsHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(BlockOperationsHandler.class);
    
    private final MinecraftServer server;
    private final Config config;
    
    // Configuration limits
    private int maxRegionVolume;
    private int blocksPerTick;
    private boolean chunkLargeOperations;
    
    public BlockOperationsHandler(MinecraftServer server, Config config) {
        this.server = server;
        this.config = config;
        
        // Load configuration limits
        this.maxRegionVolume = config.getMaxRegionVolume();
        this.blocksPerTick = config.getBlocksPerTick();
        this.chunkLargeOperations = config.isChunkLargeOperations();
        
        LOGGER.info("BlockOperationsHandler initialized with limits: maxRegionVolume={}, blocksPerTick={}, chunkLargeOperations={}",
            maxRegionVolume, blocksPerTick, chunkLargeOperations);
    }
    
    /**
     * Places a single block at the specified coordinates.
     * 
     * @param args JSON object containing x, y, z, blockType, and optional world
     * @return JsonObject with success status and message
     */
    public JsonObject placeBlock(JsonObject args) {
        try {
            // Parse arguments
            int x = args.get("x").getAsInt();
            int y = args.get("y").getAsInt();
            int z = args.get("z").getAsInt();
            String blockType = args.get("blockType").getAsString();
            String worldName = args.has("world") ? args.get("world").getAsString() : null;
            
            // Validate block type
            ResourceLocation blockKey = ResourceLocation.tryParse(blockType);
            if (blockKey == null) {
                return createErrorResponse("INVALID_BLOCK_TYPE", 
                    "Invalid block type format: " + blockType, blockType);
            }
            
            Block block = BuiltInRegistries.BLOCK.get(blockKey);
            if (block == Blocks.AIR && !blockType.equals("minecraft:air")) {
                return createErrorResponse("INVALID_BLOCK_TYPE", 
                    "Block type does not exist: " + blockType, blockType);
            }
            
            // Get target world
            ServerLevel level = getWorld(worldName);
            if (level == null) {
                return createErrorResponse("INVALID_WORLD", 
                    "World not found: " + worldName, worldName);
            }
            
            // Validate coordinates
            BlockPos pos = new BlockPos(x, y, z);
            if (!isValidCoordinate(level, pos)) {
                return createErrorResponse("INVALID_COORDINATES", 
                    "Coordinates outside world boundaries: " + pos, pos.toString());
            }
            
            // Check if chunk is loaded
            if (!level.isLoaded(pos)) {
                return createErrorResponse("CHUNK_NOT_LOADED", 
                    "Chunk not loaded at position: " + pos, pos.toString());
            }
            
            // Execute on main thread
            server.execute(() -> {
                try {
                    BlockState blockState = block.defaultBlockState();
                    level.setBlock(pos, blockState, 3); // Flag 3: notify neighbors and clients
                    LOGGER.info("Placed block {} at ({}, {}, {}) in {}", 
                        blockType, x, y, z, level.dimension().location());
                } catch (Exception e) {
                    LOGGER.error("Failed to place block", e);
                }
            });
            
            return createSuccessResponse("Block placed successfully");
            
        } catch (Exception e) {
            LOGGER.error("Error in placeBlock", e);
            return createErrorResponse("SERVER_ERROR", 
                "Failed to place block: " + e.getMessage(), null);
        }
    }
    
    /**
     * Breaks a block at the specified coordinates.
     * 
     * @param args JSON object containing x, y, z, and optional world
     * @return JsonObject with success status and message
     */
    public JsonObject breakBlock(JsonObject args) {
        try {
            // Parse arguments
            int x = args.get("x").getAsInt();
            int y = args.get("y").getAsInt();
            int z = args.get("z").getAsInt();
            String worldName = args.has("world") ? args.get("world").getAsString() : null;
            
            // Get target world
            ServerLevel level = getWorld(worldName);
            if (level == null) {
                return createErrorResponse("INVALID_WORLD", 
                    "World not found: " + worldName, worldName);
            }
            
            // Validate coordinates
            BlockPos pos = new BlockPos(x, y, z);
            if (!isValidCoordinate(level, pos)) {
                return createErrorResponse("INVALID_COORDINATES", 
                    "Coordinates outside world boundaries: " + pos, pos.toString());
            }
            
            // Check if chunk is loaded
            if (!level.isLoaded(pos)) {
                return createErrorResponse("CHUNK_NOT_LOADED", 
                    "Chunk not loaded at position: " + pos, pos.toString());
            }
            
            // Execute on main thread
            server.execute(() -> {
                try {
                    level.destroyBlock(pos, false); // false = don't drop items
                    LOGGER.info("Broke block at ({}, {}, {}) in {}", 
                        x, y, z, level.dimension().location());
                } catch (Exception e) {
                    LOGGER.error("Failed to break block", e);
                }
            });
            
            return createSuccessResponse("Block broken successfully");
            
        } catch (Exception e) {
            LOGGER.error("Error in breakBlock", e);
            return createErrorResponse("SERVER_ERROR", 
                "Failed to break block: " + e.getMessage(), null);
        }
    }
    
    /**
     * Fills a rectangular region with the specified block type.
     * Uses chunked processing for large regions to avoid blocking the server thread.
     * 
     * @param args JSON object containing x1, y1, z1, x2, y2, z2, blockType, and optional world
     * @return JsonObject with success status and message
     */
    public JsonObject fillRegion(JsonObject args) {
        try {
            // Parse arguments
            int x1 = args.get("x1").getAsInt();
            int y1 = args.get("y1").getAsInt();
            int z1 = args.get("z1").getAsInt();
            int x2 = args.get("x2").getAsInt();
            int y2 = args.get("y2").getAsInt();
            int z2 = args.get("z2").getAsInt();
            String blockType = args.get("blockType").getAsString();
            String worldName = args.has("world") ? args.get("world").getAsString() : null;
            
            // Validate block type
            ResourceLocation blockKey = ResourceLocation.tryParse(blockType);
            if (blockKey == null) {
                return createErrorResponse("INVALID_BLOCK_TYPE", 
                    "Invalid block type format: " + blockType, blockType);
            }
            
            Block block = BuiltInRegistries.BLOCK.get(blockKey);
            if (block == Blocks.AIR && !blockType.equals("minecraft:air")) {
                return createErrorResponse("INVALID_BLOCK_TYPE", 
                    "Block type does not exist: " + blockType, blockType);
            }
            
            // Get target world
            ServerLevel level = getWorld(worldName);
            if (level == null) {
                return createErrorResponse("INVALID_WORLD", 
                    "World not found: " + worldName, worldName);
            }
            
            // Normalize coordinates (ensure min/max are correct)
            int minX = Math.min(x1, x2);
            int maxX = Math.max(x1, x2);
            int minY = Math.min(y1, y2);
            int maxY = Math.max(y1, y2);
            int minZ = Math.min(z1, z2);
            int maxZ = Math.max(z1, z2);
            
            // Calculate volume
            long volume = (long)(maxX - minX + 1) * (maxY - minY + 1) * (maxZ - minZ + 1);
            
            // Check region size limit
            if (volume > maxRegionVolume) {
                return createErrorResponse("REGION_TOO_LARGE", 
                    "Region volume " + volume + " exceeds maximum of " + maxRegionVolume, 
                    String.valueOf(volume));
            }
            
            // Validate coordinates
            BlockPos minPos = new BlockPos(minX, minY, minZ);
            BlockPos maxPos = new BlockPos(maxX, maxY, maxZ);
            if (!isValidCoordinate(level, minPos) || !isValidCoordinate(level, maxPos)) {
                return createErrorResponse("INVALID_COORDINATES", 
                    "Coordinates outside world boundaries", null);
            }
            
            // Build list of positions to fill
            List<BlockPos> positions = new ArrayList<>();
            for (int x = minX; x <= maxX; x++) {
                for (int y = minY; y <= maxY; y++) {
                    for (int z = minZ; z <= maxZ; z++) {
                        positions.add(new BlockPos(x, y, z));
                    }
                }
            }
            
            // Execute fill operation
            if (chunkLargeOperations && volume > blocksPerTick) {
                // Process in chunks over multiple ticks
                processLargeOperation(level, positions, block.defaultBlockState());
                LOGGER.info("Started chunked fill operation for {} blocks in region ({},{},{}) to ({},{},{}) in {}",
                    volume, minX, minY, minZ, maxX, maxY, maxZ, level.dimension().location());
            } else {
                // Process all at once
                server.execute(() -> {
                    try {
                        for (BlockPos pos : positions) {
                            if (level.isLoaded(pos)) {
                                level.setBlock(pos, block.defaultBlockState(), 3);
                            }
                        }
                        LOGGER.info("Filled {} blocks in region ({},{},{}) to ({},{},{}) in {}",
                            volume, minX, minY, minZ, maxX, maxY, maxZ, level.dimension().location());
                    } catch (Exception e) {
                        LOGGER.error("Failed to fill region", e);
                    }
                });
            }
            
            return createSuccessResponse("Region fill operation started for " + volume + " blocks");
            
        } catch (Exception e) {
            LOGGER.error("Error in fillRegion", e);
            return createErrorResponse("SERVER_ERROR", 
                "Failed to fill region: " + e.getMessage(), null);
        }
    }
    
    /**
     * Replaces all blocks of a source type with a target type in the specified region.
     * Uses chunked processing for large regions.
     * 
     * @param args JSON object containing x1, y1, z1, x2, y2, z2, sourceBlock, targetBlock, and optional world
     * @return JsonObject with success status and message
     */
    public JsonObject replaceBlocks(JsonObject args) {
        try {
            // Parse arguments
            int x1 = args.get("x1").getAsInt();
            int y1 = args.get("y1").getAsInt();
            int z1 = args.get("z1").getAsInt();
            int x2 = args.get("x2").getAsInt();
            int y2 = args.get("y2").getAsInt();
            int z2 = args.get("z2").getAsInt();
            String sourceBlockType = args.get("sourceBlock").getAsString();
            String targetBlockType = args.get("targetBlock").getAsString();
            String worldName = args.has("world") ? args.get("world").getAsString() : null;
            
            // Validate source block type
            ResourceLocation sourceKey = ResourceLocation.tryParse(sourceBlockType);
            if (sourceKey == null) {
                return createErrorResponse("INVALID_BLOCK_TYPE", 
                    "Invalid source block type format: " + sourceBlockType, sourceBlockType);
            }
            
            Block sourceBlock = BuiltInRegistries.BLOCK.get(sourceKey);
            if (sourceBlock == Blocks.AIR && !sourceBlockType.equals("minecraft:air")) {
                return createErrorResponse("INVALID_BLOCK_TYPE", 
                    "Source block type does not exist: " + sourceBlockType, sourceBlockType);
            }
            
            // Validate target block type
            ResourceLocation targetKey = ResourceLocation.tryParse(targetBlockType);
            if (targetKey == null) {
                return createErrorResponse("INVALID_BLOCK_TYPE", 
                    "Invalid target block type format: " + targetBlockType, targetBlockType);
            }
            
            Block targetBlock = BuiltInRegistries.BLOCK.get(targetKey);
            if (targetBlock == Blocks.AIR && !targetBlockType.equals("minecraft:air")) {
                return createErrorResponse("INVALID_BLOCK_TYPE", 
                    "Target block type does not exist: " + targetBlockType, targetBlockType);
            }
            
            // Get target world
            ServerLevel level = getWorld(worldName);
            if (level == null) {
                return createErrorResponse("INVALID_WORLD", 
                    "World not found: " + worldName, worldName);
            }
            
            // Normalize coordinates
            int minX = Math.min(x1, x2);
            int maxX = Math.max(x1, x2);
            int minY = Math.min(y1, y2);
            int maxY = Math.max(y1, y2);
            int minZ = Math.min(z1, z2);
            int maxZ = Math.max(z1, z2);
            
            // Calculate volume
            long volume = (long)(maxX - minX + 1) * (maxY - minY + 1) * (maxZ - minZ + 1);
            
            // Check region size limit
            if (volume > maxRegionVolume) {
                return createErrorResponse("REGION_TOO_LARGE", 
                    "Region volume " + volume + " exceeds maximum of " + maxRegionVolume, 
                    String.valueOf(volume));
            }
            
            // Validate coordinates
            BlockPos minPos = new BlockPos(minX, minY, minZ);
            BlockPos maxPos = new BlockPos(maxX, maxY, maxZ);
            if (!isValidCoordinate(level, minPos) || !isValidCoordinate(level, maxPos)) {
                return createErrorResponse("INVALID_COORDINATES", 
                    "Coordinates outside world boundaries", null);
            }
            
            // Build list of positions to check and potentially replace
            List<BlockPos> positions = new ArrayList<>();
            for (int x = minX; x <= maxX; x++) {
                for (int y = minY; y <= maxY; y++) {
                    for (int z = minZ; z <= maxZ; z++) {
                        positions.add(new BlockPos(x, y, z));
                    }
                }
            }
            
            // Execute replace operation
            BlockState sourceState = sourceBlock.defaultBlockState();
            BlockState targetState = targetBlock.defaultBlockState();
            
            if (chunkLargeOperations && volume > blocksPerTick) {
                // Process in chunks over multiple ticks
                processLargeReplaceOperation(level, positions, sourceState, targetState);
                LOGGER.info("Started chunked replace operation for region ({},{},{}) to ({},{},{}) in {}",
                    minX, minY, minZ, maxX, maxY, maxZ, level.dimension().location());
            } else {
                // Process all at once
                server.execute(() -> {
                    try {
                        int replaced = 0;
                        for (BlockPos pos : positions) {
                            if (level.isLoaded(pos)) {
                                BlockState currentState = level.getBlockState(pos);
                                if (currentState.getBlock() == sourceBlock) {
                                    level.setBlock(pos, targetState, 3);
                                    replaced++;
                                }
                            }
                        }
                        LOGGER.info("Replaced {} blocks from {} to {} in region ({},{},{}) to ({},{},{}) in {}",
                            replaced, sourceBlockType, targetBlockType, minX, minY, minZ, maxX, maxY, maxZ, 
                            level.dimension().location());
                    } catch (Exception e) {
                        LOGGER.error("Failed to replace blocks", e);
                    }
                });
            }
            
            return createSuccessResponse("Block replacement operation started");
            
        } catch (Exception e) {
            LOGGER.error("Error in replaceBlocks", e);
            return createErrorResponse("SERVER_ERROR", 
                "Failed to replace blocks: " + e.getMessage(), null);
        }
    }
    
    /**
     * Processes a large fill operation in chunks over multiple ticks to avoid blocking the server.
     */
    private void processLargeOperation(ServerLevel level, List<BlockPos> positions, BlockState blockState) {
        new Thread(() -> {
            int totalBlocks = positions.size();
            int processedBlocks = 0;
            
            while (processedBlocks < totalBlocks) {
                final int startIndex = processedBlocks;
                final int endIndex = Math.min(startIndex + blocksPerTick, totalBlocks);
                
                server.execute(() -> {
                    try {
                        for (int i = startIndex; i < endIndex; i++) {
                            BlockPos pos = positions.get(i);
                            if (level.isLoaded(pos)) {
                                level.setBlock(pos, blockState, 3);
                            }
                        }
                    } catch (Exception e) {
                        LOGGER.error("Error processing chunk of blocks", e);
                    }
                });
                
                processedBlocks = endIndex;
                
                // Sleep to allow other operations to run
                try {
                    Thread.sleep(50); // 50ms = 1 tick
                } catch (InterruptedException e) {
                    LOGGER.error("Large operation interrupted", e);
                    break;
                }
            }
            
            LOGGER.info("Completed large fill operation: {} blocks processed", totalBlocks);
        }).start();
    }
    
    /**
     * Processes a large replace operation in chunks over multiple ticks.
     */
    private void processLargeReplaceOperation(ServerLevel level, List<BlockPos> positions, 
                                              BlockState sourceState, BlockState targetState) {
        new Thread(() -> {
            int totalBlocks = positions.size();
            int processedBlocks = 0;
            int totalReplaced = 0;
            
            while (processedBlocks < totalBlocks) {
                final int startIndex = processedBlocks;
                final int endIndex = Math.min(startIndex + blocksPerTick, totalBlocks);
                
                server.execute(() -> {
                    try {
                        int replaced = 0;
                        for (int i = startIndex; i < endIndex; i++) {
                            BlockPos pos = positions.get(i);
                            if (level.isLoaded(pos)) {
                                BlockState currentState = level.getBlockState(pos);
                                if (currentState.getBlock() == sourceState.getBlock()) {
                                    level.setBlock(pos, targetState, 3);
                                    replaced++;
                                }
                            }
                        }
                    } catch (Exception e) {
                        LOGGER.error("Error processing chunk of blocks", e);
                    }
                });
                
                processedBlocks = endIndex;
                
                // Sleep to allow other operations to run
                try {
                    Thread.sleep(50); // 50ms = 1 tick
                } catch (InterruptedException e) {
                    LOGGER.error("Large replace operation interrupted", e);
                    break;
                }
            }
            
            LOGGER.info("Completed large replace operation: {} blocks checked", totalBlocks);
        }).start();
    }
    
    /**
     * Gets the ServerLevel for the specified world name, or the overworld if null.
     */
    private ServerLevel getWorld(String worldName) {
        if (worldName == null || worldName.isEmpty()) {
            return server.overworld();
        }
        
        ResourceLocation worldKey = ResourceLocation.tryParse(worldName);
        if (worldKey == null) {
            return null;
        }
        
        for (ServerLevel level : server.getAllLevels()) {
            if (level.dimension().location().equals(worldKey)) {
                return level;
            }
        }
        
        return null;
    }
    
    /**
     * Validates that coordinates are within world boundaries.
     */
    private boolean isValidCoordinate(ServerLevel level, BlockPos pos) {
        // Check Y bounds (typically -64 to 320 in modern Minecraft)
        if (pos.getY() < level.getMinBuildHeight() || pos.getY() > level.getMaxBuildHeight()) {
            return false;
        }
        
        // X and Z are technically unbounded, but we check for reasonable values
        // to prevent integer overflow issues
        if (Math.abs(pos.getX()) > 30000000 || Math.abs(pos.getZ()) > 30000000) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Creates a success response JSON object.
     */
    private JsonObject createSuccessResponse(String message) {
        JsonObject response = new JsonObject();
        response.addProperty("success", true);
        response.addProperty("message", message);
        return response;
    }
    
    /**
     * Creates an error response JSON object with error code and details.
     */
    private JsonObject createErrorResponse(String code, String message, Object invalidValue) {
        JsonObject response = new JsonObject();
        response.addProperty("success", false);
        response.addProperty("error", message);
        
        JsonObject details = new JsonObject();
        details.addProperty("code", code);
        if (invalidValue != null) {
            details.addProperty("invalidValue", invalidValue.toString());
        }
        response.add("details", details);
        
        return response;
    }
}
