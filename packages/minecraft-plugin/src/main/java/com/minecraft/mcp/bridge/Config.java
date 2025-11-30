package com.minecraft.mcp.bridge;

import com.moandjiezana.toml.Toml;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

public class Config {
    private static final Logger LOGGER = LoggerFactory.getLogger(Config.class);
    
    private String bridgeUrl;
    private String authToken;
    private int reconnectAttempts;
    private int reconnectDelay;
    private List<String> enabledEvents;
    private List<Pattern> allowedCommandPatterns;
    private boolean requireAuth;
    private int maxCommandLength;
    private String logLevel;
    
    // Block operation limits
    private int maxRegionVolume;
    private int blocksPerTick;
    private boolean chunkLargeOperations;
    
    public Config() {
        // Default values
        this.bridgeUrl = "ws://localhost:8080";
        this.authToken = "";
        this.reconnectAttempts = 5;
        this.reconnectDelay = 5000;
        this.enabledEvents = new ArrayList<>();
        this.allowedCommandPatterns = new ArrayList<>();
        this.requireAuth = true;
        this.maxCommandLength = 256;
        this.logLevel = "INFO";
        
        // Block operation defaults
        this.maxRegionVolume = 100000;
        this.blocksPerTick = 1000;
        this.chunkLargeOperations = true;
    }
    
    public static Config load(Path configPath) {
        Config config = new Config();
        
        try {
            File configFile = configPath.toFile();
            
            // Create default config if it doesn't exist
            if (!configFile.exists()) {
                LOGGER.info("Config file not found, creating default config at: {}", configPath);
                createDefaultConfig(configPath);
            }
            
            Toml toml = new Toml().read(configFile);
            
            // Load bridge settings
            if (toml.contains("bridge")) {
                Toml bridge = toml.getTable("bridge");
                config.bridgeUrl = bridge.getString("url", config.bridgeUrl);
                config.authToken = bridge.getString("auth_token", config.authToken);
                config.reconnectAttempts = bridge.getLong("reconnect_attempts", (long) config.reconnectAttempts).intValue();
                config.reconnectDelay = bridge.getLong("reconnect_delay", (long) config.reconnectDelay).intValue();
            }
            
            // Load event settings
            if (toml.contains("events")) {
                Toml events = toml.getTable("events");
                List<String> enabled = events.getList("enabled");
                if (enabled != null) {
                    config.enabledEvents = new ArrayList<>(enabled);
                }
            }
            
            // Load command settings
            if (toml.contains("commands")) {
                Toml commands = toml.getTable("commands");
                List<String> patterns = commands.getList("allowed_patterns");
                if (patterns != null) {
                    config.allowedCommandPatterns = new ArrayList<>();
                    for (String pattern : patterns) {
                        try {
                            config.allowedCommandPatterns.add(Pattern.compile(pattern));
                        } catch (Exception e) {
                            LOGGER.error("Invalid command pattern: {}", pattern, e);
                        }
                    }
                }
            }
            
            // Load security settings
            if (toml.contains("security")) {
                Toml security = toml.getTable("security");
                config.requireAuth = security.getBoolean("require_auth", config.requireAuth);
                config.maxCommandLength = security.getLong("max_command_length", (long) config.maxCommandLength).intValue();
            }
            
            // Load logging settings
            if (toml.contains("logging")) {
                Toml logging = toml.getTable("logging");
                config.logLevel = logging.getString("level", config.logLevel);
            }
            
            // Load limits settings
            if (toml.contains("limits")) {
                Toml limits = toml.getTable("limits");
                config.maxRegionVolume = limits.getLong("max_region_volume", (long) config.maxRegionVolume).intValue();
                config.blocksPerTick = limits.getLong("blocks_per_tick", (long) config.blocksPerTick).intValue();
            }
            
            // Load performance settings
            if (toml.contains("performance")) {
                Toml performance = toml.getTable("performance");
                config.chunkLargeOperations = performance.getBoolean("chunk_large_operations", config.chunkLargeOperations);
                // Override blocks_per_tick if specified in performance section
                if (performance.contains("blocks_per_tick")) {
                    config.blocksPerTick = performance.getLong("blocks_per_tick", (long) config.blocksPerTick).intValue();
                }
            }
            
            LOGGER.info("Configuration loaded successfully from: {}", configPath);
            
        } catch (Exception e) {
            LOGGER.error("Failed to load configuration, using defaults", e);
        }
        
        return config;
    }

    
    private static void createDefaultConfig(Path configPath) throws IOException {
        String defaultConfig = """
[bridge]
url = "ws://localhost:8080"
auth_token = "secret"
reconnect_attempts = 5
reconnect_delay = 5000

[events]
enabled = [
    "player_join",
    "player_quit",
    "player_chat",
    "player_death",
    "block_break"
]

[commands]
allowed_patterns = [
    "^say .*",
    "^tp \\\\w+ -?\\\\d+ -?\\\\d+ -?\\\\d+$",
    "^give \\\\w+ \\\\w+ \\\\d+$"
]

[security]
require_auth = true
max_command_length = 256

[logging]
level = "INFO"
""";
        
        Files.createDirectories(configPath.getParent());
        Files.writeString(configPath, defaultConfig);
    }
    
    public void reload(Path configPath) {
        Config newConfig = load(configPath);
        this.bridgeUrl = newConfig.bridgeUrl;
        this.authToken = newConfig.authToken;
        this.reconnectAttempts = newConfig.reconnectAttempts;
        this.reconnectDelay = newConfig.reconnectDelay;
        this.enabledEvents = newConfig.enabledEvents;
        this.allowedCommandPatterns = newConfig.allowedCommandPatterns;
        this.requireAuth = newConfig.requireAuth;
        this.maxCommandLength = newConfig.maxCommandLength;
        this.logLevel = newConfig.logLevel;
        this.maxRegionVolume = newConfig.maxRegionVolume;
        this.blocksPerTick = newConfig.blocksPerTick;
        this.chunkLargeOperations = newConfig.chunkLargeOperations;
        LOGGER.info("Configuration reloaded");
    }
    
    public boolean isEventEnabled(String eventType) {
        return enabledEvents.isEmpty() || enabledEvents.contains(eventType);
    }
    
    public boolean isCommandAllowed(String command) {
        if (allowedCommandPatterns.isEmpty()) {
            return true; // Allow all if no patterns specified
        }
        
        for (Pattern pattern : allowedCommandPatterns) {
            if (pattern.matcher(command).matches()) {
                return true;
            }
        }
        return false;
    }
    
    // Getters
    public String getBridgeUrl() { return bridgeUrl; }
    public String getAuthToken() { return authToken; }
    public int getReconnectAttempts() { return reconnectAttempts; }
    public int getReconnectDelay() { return reconnectDelay; }
    public List<String> getEnabledEvents() { return enabledEvents; }
    public List<Pattern> getAllowedCommandPatterns() { return allowedCommandPatterns; }
    public boolean isRequireAuth() { return requireAuth; }
    public int getMaxCommandLength() { return maxCommandLength; }
    public String getLogLevel() { return logLevel; }
    public int getMaxRegionVolume() { return maxRegionVolume; }
    public int getBlocksPerTick() { return blocksPerTick; }
    public boolean isChunkLargeOperations() { return chunkLargeOperations; }
}
