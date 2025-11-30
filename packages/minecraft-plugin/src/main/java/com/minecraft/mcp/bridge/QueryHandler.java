package com.minecraft.mcp.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import net.minecraft.core.BlockPos;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.AABB;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.concurrent.CompletableFuture;

public class QueryHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(QueryHandler.class);
    
    private final MinecraftServer server;
    
    public QueryHandler(MinecraftServer server) {
        this.server = server;
    }
    
    public CompletableFuture<JsonObject> handleQuery(JsonObject queryMessage) {
        CompletableFuture<JsonObject> future = new CompletableFuture<>();
        
        try {
            JsonObject payload = queryMessage.getAsJsonObject("payload");
            String query = payload.get("query").getAsString();
            JsonObject args = payload.has("args") ? payload.getAsJsonObject("args") : new JsonObject();
            
            LOGGER.info("Handling query: {}", query);
            
            server.execute(() -> {
                try {
                    JsonObject result = switch (query) {
                        case "get_online_players" -> getOnlinePlayers();
                        case "get_player_info" -> getPlayerInfo(args);
                        case "get_server_info" -> getServerInfo();
                        case "get_world_info" -> getWorldInfo(args);
                        default -> createErrorResponse("Unknown query: " + query);
                    };
                    future.complete(result);
                } catch (Exception e) {
                    LOGGER.error("Error executing query", e);
                    future.complete(createErrorResponse("Query execution failed: " + e.getMessage()));
                }
            });
        } catch (Exception e) {
            LOGGER.error("Error handling query", e);
            future.complete(createErrorResponse("Query handling failed: " + e.getMessage()));
        }
        
        return future;
    }
    
    private JsonObject getOnlinePlayers() {
        try {
            JsonArray players = new JsonArray();
            for (ServerPlayer player : server.getPlayerList().getPlayers()) {
                players.add(player.getName().getString());
            }
            
            JsonObject data = new JsonObject();
            data.add("players", players);
            
            return createSuccessResponse(data);
        } catch (Exception e) {
            LOGGER.error("Error getting online players", e);
            return createErrorResponse("Failed to get online players: " + e.getMessage());
        }
    }
    
    private JsonObject getPlayerInfo(JsonObject args) {
        try {
            String playerName = args.get("player").getAsString();
            ServerPlayer player = server.getPlayerList().getPlayerByName(playerName);
            
            if (player == null) {
                return createErrorResponse("Player not found: " + playerName);
            }
            
            JsonObject playerInfo = new JsonObject();
            playerInfo.addProperty("name", player.getName().getString());
            playerInfo.addProperty("uuid", player.getUUID().toString());
            playerInfo.addProperty("health", player.getHealth());
            playerInfo.addProperty("foodLevel", player.getFoodData().getFoodLevel());
            playerInfo.addProperty("gameMode", player.gameMode.getGameModeForPlayer().getName());
            
            // Location
            JsonObject location = new JsonObject();
            location.addProperty("world", player.level().dimension().location().toString());
            location.addProperty("x", player.getX());
            location.addProperty("y", player.getY());
            location.addProperty("z", player.getZ());
            playerInfo.add("location", location);
            
            // Inventory summary
            JsonArray inventory = new JsonArray();
            for (int i = 0; i < player.getInventory().getContainerSize(); i++) {
                var itemStack = player.getInventory().getItem(i);
                if (!itemStack.isEmpty()) {
                    JsonObject item = new JsonObject();
                    item.addProperty("type", itemStack.getItem().toString());
                    item.addProperty("quantity", itemStack.getCount());
                    if (itemStack.hasCustomHoverName()) {
                        item.addProperty("displayName", itemStack.getHoverName().getString());
                    }
                    inventory.add(item);
                }
            }
            playerInfo.add("inventory", inventory);
            
            return createSuccessResponse(playerInfo);
        } catch (Exception e) {
            LOGGER.error("Error getting player info", e);
            return createErrorResponse("Failed to get player info: " + e.getMessage());
        }
    }
    
    private JsonObject getServerInfo() {
        try {
            JsonObject serverInfo = new JsonObject();
            serverInfo.addProperty("version", server.getServerVersion());
            serverInfo.addProperty("onlinePlayers", server.getPlayerList().getPlayerCount());
            serverInfo.addProperty("maxPlayers", server.getPlayerList().getMaxPlayers());
            
            // Get info from overworld
            ServerLevel overworld = server.overworld();
            serverInfo.addProperty("timeOfDay", overworld.getDayTime());
            serverInfo.addProperty("weather", overworld.isRaining() ? "rain" : "clear");
            
            // TPS calculation (simplified - would need more sophisticated tracking in production)
            serverInfo.addProperty("tps", 20.0);
            
            return createSuccessResponse(serverInfo);
        } catch (Exception e) {
            LOGGER.error("Error getting server info", e);
            return createErrorResponse("Failed to get server info: " + e.getMessage());
        }
    }
    
    private JsonObject getWorldInfo(JsonObject args) {
        try {
            double x = args.get("x").getAsDouble();
            double y = args.get("y").getAsDouble();
            double z = args.get("z").getAsDouble();
            int radius = args.has("radius") ? args.get("radius").getAsInt() : 10;
            String worldName = args.has("world") ? args.get("world").getAsString() : "minecraft:overworld";
            
            // Find the world
            ServerLevel level = null;
            for (ServerLevel serverLevel : server.getAllLevels()) {
                if (serverLevel.dimension().location().toString().equals(worldName)) {
                    level = serverLevel;
                    break;
                }
            }
            
            if (level == null) {
                return createErrorResponse("World not found: " + worldName);
            }
            
            JsonObject worldInfo = new JsonObject();
            
            // Get blocks in radius
            JsonArray blocks = new JsonArray();
            BlockPos center = new BlockPos((int) x, (int) y, (int) z);
            for (int dx = -radius; dx <= radius; dx++) {
                for (int dy = -radius; dy <= radius; dy++) {
                    for (int dz = -radius; dz <= radius; dz++) {
                        BlockPos pos = center.offset(dx, dy, dz);
                        BlockState state = level.getBlockState(pos);
                        
                        if (!state.isAir()) {
                            JsonObject block = new JsonObject();
                            block.addProperty("type", state.getBlock().getName().getString());
                            
                            JsonObject location = new JsonObject();
                            location.addProperty("world", worldName);
                            location.addProperty("x", pos.getX());
                            location.addProperty("y", pos.getY());
                            location.addProperty("z", pos.getZ());
                            block.add("location", location);
                            
                            blocks.add(block);
                        }
                    }
                }
            }
            worldInfo.add("blocks", blocks);
            
            // Get entities in radius
            JsonArray entities = new JsonArray();
            AABB boundingBox = new AABB(
                x - radius, y - radius, z - radius,
                x + radius, y + radius, z + radius
            );
            List<Entity> nearbyEntities = level.getEntities(null, boundingBox);
            
            for (Entity entity : nearbyEntities) {
                JsonObject entityObj = new JsonObject();
                entityObj.addProperty("type", entity.getType().toString());
                
                JsonObject location = new JsonObject();
                location.addProperty("world", worldName);
                location.addProperty("x", entity.getX());
                location.addProperty("y", entity.getY());
                location.addProperty("z", entity.getZ());
                entityObj.add("location", location);
                
                if (entity.hasCustomName()) {
                    entityObj.addProperty("name", entity.getCustomName().getString());
                }
                
                entities.add(entityObj);
            }
            worldInfo.add("entities", entities);
            
            return createSuccessResponse(worldInfo);
        } catch (Exception e) {
            LOGGER.error("Error getting world info", e);
            return createErrorResponse("Failed to get world info: " + e.getMessage());
        }
    }
    
    private JsonObject createSuccessResponse(JsonObject data) {
        JsonObject response = new JsonObject();
        response.addProperty("success", true);
        response.add("data", data);
        return response;
    }
    
    private JsonObject createErrorResponse(String error) {
        JsonObject response = new JsonObject();
        response.addProperty("success", false);
        response.addProperty("error", error);
        return response;
    }
}
