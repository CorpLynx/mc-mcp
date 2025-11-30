package com.minecraft.mcp.bridge;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

public class BridgeClient extends WebSocketClient {
    private static final Logger LOGGER = LoggerFactory.getLogger(BridgeClient.class);
    private static final String MESSAGE_VERSION = "1.0.0";
    
    private final Gson gson;
    private final Config config;
    private final ConcurrentHashMap<String, CompletableFuture<JsonObject>> pendingRequests;
    private Consumer<JsonObject> eventHandler;
    private int reconnectAttempt = 0;
    private boolean shouldReconnect = true;
    
    public BridgeClient(URI serverUri, Config config) {
        super(serverUri);
        this.config = config;
        this.gson = new Gson();
        this.pendingRequests = new ConcurrentHashMap<>();
        
        // Add auth token to headers if required
        if (config.isRequireAuth() && !config.getAuthToken().isEmpty()) {
            this.addHeader("Authorization", "Bearer " + config.getAuthToken());
        }
    }
    
    @Override
    public void onOpen(ServerHandshake handshake) {
        LOGGER.info("Connected to Bridge Server at {}", getURI());
        reconnectAttempt = 0;
    }
    
    @Override
    public void onMessage(String message) {
        try {
            JsonObject json = gson.fromJson(message, JsonObject.class);
            String type = json.get("type").getAsString();
            String id = json.has("id") ? json.get("id").getAsString() : null;
            
            LOGGER.debug("Received message: type={}, id={}", type, id);
            
            if ("response".equals(type) || "error".equals(type)) {
                // Handle response to a command/query
                if (id != null && pendingRequests.containsKey(id)) {
                    CompletableFuture<JsonObject> future = pendingRequests.remove(id);
                    future.complete(json);
                }
            } else if ("command".equals(type) || "query".equals(type)) {
                // Handle incoming command/query from MCP Server
                if (eventHandler != null) {
                    eventHandler.accept(json);
                }
            }
        } catch (Exception e) {
            LOGGER.error("Failed to process message: {}", message, e);
        }
    }
    
    @Override
    public void onClose(int code, String reason, boolean remote) {
        LOGGER.warn("Disconnected from Bridge Server: code={}, reason={}, remote={}", code, reason, remote);
        
        if (shouldReconnect && reconnectAttempt < config.getReconnectAttempts()) {
            reconnectAttempt++;
            int delay = (int) (config.getReconnectDelay() * Math.pow(2, reconnectAttempt - 1));
            LOGGER.info("Attempting reconnection {} of {} in {}ms", 
                reconnectAttempt, config.getReconnectAttempts(), delay);
            
            try {
                Thread.sleep(delay);
                this.reconnect();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                LOGGER.error("Reconnection interrupted", e);
            }
        } else if (reconnectAttempt >= config.getReconnectAttempts()) {
            LOGGER.error("Max reconnection attempts reached, giving up");
        }
    }
    
    @Override
    public void onError(Exception ex) {
        LOGGER.error("WebSocket error occurred", ex);
    }
    
    public void sendEvent(String eventType, JsonObject eventData) {
        try {
            JsonObject message = new JsonObject();
            message.addProperty("version", MESSAGE_VERSION);
            message.addProperty("type", "event");
            message.addProperty("id", java.util.UUID.randomUUID().toString());
            message.addProperty("timestamp", System.currentTimeMillis());
            message.addProperty("source", "minecraft");
            
            JsonObject payload = new JsonObject();
            payload.addProperty("eventType", eventType);
            payload.addProperty("timestamp", System.currentTimeMillis());
            payload.add("data", eventData);
            
            message.add("payload", payload);
            
            String json = gson.toJson(message);
            this.send(json);
            
            LOGGER.debug("Sent event: type={}", eventType);
        } catch (Exception e) {
            LOGGER.error("Failed to send event: {}", eventType, e);
        }
    }
    
    public CompletableFuture<JsonObject> sendCommand(String commandType, JsonObject commandData) {
        CompletableFuture<JsonObject> future = new CompletableFuture<>();
        
        try {
            String id = java.util.UUID.randomUUID().toString();
            pendingRequests.put(id, future);
            
            JsonObject message = new JsonObject();
            message.addProperty("version", MESSAGE_VERSION);
            message.addProperty("type", "response");
            message.addProperty("id", id);
            message.addProperty("timestamp", System.currentTimeMillis());
            message.addProperty("source", "minecraft");
            message.add("payload", commandData);
            
            String json = gson.toJson(message);
            this.send(json);
            
            LOGGER.debug("Sent command response: id={}", id);
        } catch (Exception e) {
            LOGGER.error("Failed to send command response", e);
            future.completeExceptionally(e);
        }
        
        return future;
    }
    
    public void setEventHandler(Consumer<JsonObject> handler) {
        this.eventHandler = handler;
    }
    
    public void shutdown() {
        shouldReconnect = false;
        this.close();
    }
}
