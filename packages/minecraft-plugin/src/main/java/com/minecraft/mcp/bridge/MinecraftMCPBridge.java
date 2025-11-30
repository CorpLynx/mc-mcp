package com.minecraft.mcp.bridge;

import com.google.gson.JsonObject;
import net.minecraft.server.MinecraftServer;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.server.ServerStartedEvent;
import net.neoforged.neoforge.event.server.ServerStoppingEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.nio.file.Path;
import java.nio.file.Paths;

@Mod("minecraft_mcp_bridge")
public class MinecraftMCPBridge {
    private static final Logger LOGGER = LoggerFactory.getLogger(MinecraftMCPBridge.class);
    private static final String MOD_VERSION = "1.0.0";
    
    private Config config;
    private BridgeClient bridgeClient;
    private EventHandler eventHandler;
    private CommandExecutor commandExecutor;
    private QueryHandler queryHandler;
    
    public MinecraftMCPBridge(IEventBus modEventBus) {
        LOGGER.info("Initializing Minecraft MCP Bridge v{}", MOD_VERSION);
        
        // Register this class to receive forge events
        NeoForge.EVENT_BUS.register(this);
    }
    
    @SubscribeEvent
    public void onServerStarted(ServerStartedEvent event) {
        try {
            MinecraftServer server = event.getServer();
            
            LOGGER.info("=== Minecraft MCP Bridge Startup ===");
            LOGGER.info("Version: {}", MOD_VERSION);
            
            // Load configuration
            Path configPath = Paths.get("config", "minecraft-mcp-bridge.toml");
            config = Config.load(configPath);
            
            LOGGER.info("Configuration loaded:");
            LOGGER.info("  Bridge URL: {}", config.getBridgeUrl());
            LOGGER.info("  Reconnect attempts: {}", config.getReconnectAttempts());
            LOGGER.info("  Enabled events: {}", config.getEnabledEvents());
            LOGGER.info("  Command patterns: {}", config.getAllowedCommandPatterns().size());
            LOGGER.info("  Log level: {}", config.getLogLevel());
            
            // Initialize command and query handlers
            commandExecutor = new CommandExecutor(server, config);
            queryHandler = new QueryHandler(server);
            
            // Initialize WebSocket client
            URI bridgeUri = new URI(config.getBridgeUrl());
            bridgeClient = new BridgeClient(bridgeUri, config);
            
            // Set up message handler for incoming commands/queries
            bridgeClient.setEventHandler(message -> {
                try {
                    String type = message.get("type").getAsString();
                    String id = message.has("id") ? message.get("id").getAsString() : null;
                    
                    if ("command".equals(type)) {
                        LOGGER.info("Received command from Bridge Server: id={}", id);
                        JsonObject response = commandExecutor.handleCommand(message);
                        
                        // Send response back
                        if (id != null) {
                            bridgeClient.sendCommand("response", response);
                        }
                    } else if ("query".equals(type)) {
                        LOGGER.info("Received query from Bridge Server: id={}", id);
                        queryHandler.handleQuery(message).thenAccept(response -> {
                            // Send response back
                            if (id != null) {
                                bridgeClient.sendCommand("response", response);
                            }
                        });
                    }
                } catch (Exception e) {
                    LOGGER.error("Error handling message from Bridge Server", e);
                }
            });
            
            // Initialize event handler
            eventHandler = new EventHandler(bridgeClient, config);
            NeoForge.EVENT_BUS.register(eventHandler);
            
            // Connect to Bridge Server
            LOGGER.info("Connecting to Bridge Server at {}", config.getBridgeUrl());
            bridgeClient.connect();
            
            LOGGER.info("=== Minecraft MCP Bridge Started Successfully ===");
            
        } catch (Exception e) {
            LOGGER.error("Failed to start Minecraft MCP Bridge", e);
        }
    }
    
    @SubscribeEvent
    public void onServerStopping(ServerStoppingEvent event) {
        try {
            LOGGER.info("Shutting down Minecraft MCP Bridge");
            
            if (bridgeClient != null) {
                bridgeClient.shutdown();
                LOGGER.info("Disconnected from Bridge Server");
            }
            
            LOGGER.info("Minecraft MCP Bridge stopped");
        } catch (Exception e) {
            LOGGER.error("Error during shutdown", e);
        }
    }
}
