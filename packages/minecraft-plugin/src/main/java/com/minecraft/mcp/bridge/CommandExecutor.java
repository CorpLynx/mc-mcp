package com.minecraft.mcp.bridge;

import com.google.gson.JsonObject;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class CommandExecutor {
    private static final Logger LOGGER = LoggerFactory.getLogger(CommandExecutor.class);
    
    private final MinecraftServer server;
    private final Config config;
    private final BlockOperationsHandler blockOperationsHandler;
    
    public CommandExecutor(MinecraftServer server, Config config) {
        this.server = server;
        this.config = config;
        this.blockOperationsHandler = new BlockOperationsHandler(server, config);
    }
    
    public JsonObject handleCommand(JsonObject commandMessage) {
        try {
            JsonObject payload = commandMessage.getAsJsonObject("payload");
            String command = payload.get("command").getAsString();
            JsonObject args = payload.has("args") ? payload.getAsJsonObject("args") : new JsonObject();
            
            LOGGER.info("Executing command: {}", command);
            
            return switch (command) {
                case "execute_command" -> executeCommand(args);
                case "send_message" -> sendMessage(args);
                case "teleport_player" -> teleportPlayer(args);
                case "give_item" -> giveItem(args);
                case "place_block" -> blockOperationsHandler.placeBlock(args);
                case "break_block" -> blockOperationsHandler.breakBlock(args);
                case "fill_region" -> blockOperationsHandler.fillRegion(args);
                case "replace_blocks" -> blockOperationsHandler.replaceBlocks(args);
                default -> createErrorResponse("Unknown command: " + command);
            };
        } catch (Exception e) {
            LOGGER.error("Error handling command", e);
            return createErrorResponse("Command execution failed: " + e.getMessage());
        }
    }
    
    private JsonObject executeCommand(JsonObject args) {
        try {
            String command = args.get("command").getAsString();
            
            // Validate command length
            if (command.length() > config.getMaxCommandLength()) {
                return createErrorResponse("Command exceeds maximum length of " + config.getMaxCommandLength());
            }
            
            // Validate against whitelist
            if (!config.isCommandAllowed(command)) {
                LOGGER.warn("Command not allowed by whitelist: {}", command);
                return createErrorResponse("Command not allowed by whitelist");
            }
            
            // Execute on main server thread
            server.execute(() -> {
                try {
                    CommandSourceStack source = server.createCommandSourceStack();
                    server.getCommands().performPrefixedCommand(source, command);
                    LOGGER.info("Command executed successfully: {}", command);
                } catch (Exception e) {
                    LOGGER.error("Command execution failed: {}", command, e);
                }
            });
            
            return createSuccessResponse("Command executed");
        } catch (Exception e) {
            LOGGER.error("Error executing command", e);
            return createErrorResponse("Failed to execute command: " + e.getMessage());
        }
    }
    
    private JsonObject sendMessage(JsonObject args) {
        try {
            String message = args.get("message").getAsString();
            String target = args.has("target") ? args.get("target").getAsString() : null;
            
            server.execute(() -> {
                try {
                    Component textComponent = Component.literal(message);
                    
                    if (target != null && !target.isEmpty()) {
                        // Send to specific player
                        ServerPlayer player = server.getPlayerList().getPlayerByName(target);
                        if (player != null) {
                            player.sendSystemMessage(textComponent);
                            LOGGER.info("Message sent to {}: {}", target, message);
                        } else {
                            LOGGER.warn("Player not found: {}", target);
                        }
                    } else {
                        // Broadcast to all players
                        server.getPlayerList().broadcastSystemMessage(textComponent, false);
                        LOGGER.info("Message broadcast to all players: {}", message);
                    }
                } catch (Exception e) {
                    LOGGER.error("Failed to send message", e);
                }
            });
            
            return createSuccessResponse("Message sent");
        } catch (Exception e) {
            LOGGER.error("Error sending message", e);
            return createErrorResponse("Failed to send message: " + e.getMessage());
        }
    }
    
    private JsonObject teleportPlayer(JsonObject args) {
        try {
            String playerName = args.get("player").getAsString();
            double x = args.get("x").getAsDouble();
            double y = args.get("y").getAsDouble();
            double z = args.get("z").getAsDouble();
            String worldName = args.has("world") ? args.get("world").getAsString() : null;
            
            server.execute(() -> {
                try {
                    ServerPlayer player = server.getPlayerList().getPlayerByName(playerName);
                    if (player == null) {
                        LOGGER.warn("Player not found: {}", playerName);
                        return;
                    }
                    
                    ServerLevel targetLevel = player.serverLevel();
                    if (worldName != null && !worldName.isEmpty()) {
                        ResourceLocation worldKey = new ResourceLocation(worldName);
                        for (ServerLevel level : server.getAllLevels()) {
                            if (level.dimension().location().equals(worldKey)) {
                                targetLevel = level;
                                break;
                            }
                        }
                    }
                    
                    player.teleportTo(targetLevel, x, y, z, player.getYRot(), player.getXRot());
                    LOGGER.info("Teleported {} to ({}, {}, {}) in {}", 
                        playerName, x, y, z, targetLevel.dimension().location());
                } catch (Exception e) {
                    LOGGER.error("Failed to teleport player", e);
                }
            });
            
            return createSuccessResponse("Player teleported");
        } catch (Exception e) {
            LOGGER.error("Error teleporting player", e);
            return createErrorResponse("Failed to teleport player: " + e.getMessage());
        }
    }
    
    private JsonObject giveItem(JsonObject args) {
        try {
            String playerName = args.get("player").getAsString();
            String itemName = args.get("item").getAsString();
            int quantity = args.get("quantity").getAsInt();
            
            server.execute(() -> {
                try {
                    ServerPlayer player = server.getPlayerList().getPlayerByName(playerName);
                    if (player == null) {
                        LOGGER.warn("Player not found: {}", playerName);
                        return;
                    }
                    
                    ResourceLocation itemKey = new ResourceLocation(itemName);
                    Item item = BuiltInRegistries.ITEM.get(itemKey);
                    
                    if (item == null) {
                        LOGGER.warn("Item not found: {}", itemName);
                        return;
                    }
                    
                    ItemStack itemStack = new ItemStack(item, quantity);
                    player.addItem(itemStack);
                    
                    LOGGER.info("Gave {} x{} to {}", itemName, quantity, playerName);
                } catch (Exception e) {
                    LOGGER.error("Failed to give item", e);
                }
            });
            
            return createSuccessResponse("Item given");
        } catch (Exception e) {
            LOGGER.error("Error giving item", e);
            return createErrorResponse("Failed to give item: " + e.getMessage());
        }
    }
    
    private JsonObject createSuccessResponse(String message) {
        JsonObject response = new JsonObject();
        response.addProperty("success", true);
        response.addProperty("message", message);
        return response;
    }
    
    private JsonObject createErrorResponse(String error) {
        JsonObject response = new JsonObject();
        response.addProperty("success", false);
        response.addProperty("error", error);
        return response;
    }
}
