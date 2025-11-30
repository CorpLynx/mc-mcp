package com.minecraft.mcp.bridge;

import com.google.gson.JsonObject;
import net.minecraft.world.entity.player.Player;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.neoforge.event.ServerChatEvent;
import net.neoforged.neoforge.event.entity.living.LivingDeathEvent;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.event.level.BlockEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class EventHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(EventHandler.class);
    
    private final BridgeClient bridgeClient;
    private final Config config;
    
    public EventHandler(BridgeClient bridgeClient, Config config) {
        this.bridgeClient = bridgeClient;
        this.config = config;
    }
    
    @SubscribeEvent
    public void onPlayerJoin(PlayerEvent.PlayerLoggedInEvent event) {
        try {
            if (!config.isEventEnabled("player_join")) {
                return;
            }
            
            Player player = event.getEntity();
            
            JsonObject eventData = new JsonObject();
            eventData.addProperty("player", player.getName().getString());
            eventData.addProperty("uuid", player.getUUID().toString());
            
            bridgeClient.sendEvent("player_join", eventData);
            
            LOGGER.debug("Player join event sent: {}", player.getName().getString());
        } catch (Exception e) {
            LOGGER.error("Error handling player join event", e);
        }
    }
    
    @SubscribeEvent
    public void onPlayerQuit(PlayerEvent.PlayerLoggedOutEvent event) {
        try {
            if (!config.isEventEnabled("player_quit")) {
                return;
            }
            
            Player player = event.getEntity();
            
            JsonObject eventData = new JsonObject();
            eventData.addProperty("player", player.getName().getString());
            eventData.addProperty("uuid", player.getUUID().toString());
            
            bridgeClient.sendEvent("player_quit", eventData);
            
            LOGGER.debug("Player quit event sent: {}", player.getName().getString());
        } catch (Exception e) {
            LOGGER.error("Error handling player quit event", e);
        }
    }
    
    @SubscribeEvent
    public void onPlayerChat(ServerChatEvent event) {
        try {
            if (!config.isEventEnabled("player_chat")) {
                return;
            }
            
            Player player = event.getPlayer();
            String message = event.getMessage().getString();
            
            JsonObject eventData = new JsonObject();
            eventData.addProperty("player", player.getName().getString());
            eventData.addProperty("message", message);
            
            bridgeClient.sendEvent("player_chat", eventData);
            
            LOGGER.debug("Player chat event sent: {} - {}", player.getName().getString(), message);
        } catch (Exception e) {
            LOGGER.error("Error handling player chat event", e);
        }
    }
    
    @SubscribeEvent
    public void onPlayerDeath(LivingDeathEvent event) {
        try {
            // Filter for players only
            if (!(event.getEntity() instanceof Player player)) {
                return;
            }
            
            if (!config.isEventEnabled("player_death")) {
                return;
            }
            
            JsonObject eventData = new JsonObject();
            eventData.addProperty("player", player.getName().getString());
            eventData.addProperty("cause", event.getSource().getMsgId());
            
            // Add location
            JsonObject location = new JsonObject();
            location.addProperty("world", player.level().dimension().location().toString());
            location.addProperty("x", player.getX());
            location.addProperty("y", player.getY());
            location.addProperty("z", player.getZ());
            eventData.add("location", location);
            
            // Add killer if present
            if (event.getSource().getEntity() != null) {
                eventData.addProperty("killer", event.getSource().getEntity().getName().getString());
            }
            
            bridgeClient.sendEvent("player_death", eventData);
            
            LOGGER.debug("Player death event sent: {}", player.getName().getString());
        } catch (Exception e) {
            LOGGER.error("Error handling player death event", e);
        }
    }
    
    @SubscribeEvent
    public void onBlockBreak(BlockEvent.BreakEvent event) {
        try {
            if (!config.isEventEnabled("block_break")) {
                return;
            }
            
            Player player = event.getPlayer();
            
            JsonObject eventData = new JsonObject();
            eventData.addProperty("player", player.getName().getString());
            eventData.addProperty("blockType", event.getState().getBlock().getName().getString());
            
            // Add location
            JsonObject location = new JsonObject();
            location.addProperty("world", player.level().dimension().location().toString());
            location.addProperty("x", event.getPos().getX());
            location.addProperty("y", event.getPos().getY());
            location.addProperty("z", event.getPos().getZ());
            eventData.add("location", location);
            
            bridgeClient.sendEvent("block_break", eventData);
            
            LOGGER.debug("Block break event sent: {} broke {}", 
                player.getName().getString(), 
                event.getState().getBlock().getName().getString());
        } catch (Exception e) {
            LOGGER.error("Error handling block break event", e);
        }
    }
}
