export interface BridgeConfig {
  port: number;
  mcpAuthTokens: string[];
  minecraftAuthToken: string;
  messageQueueSize: number;
  heartbeatInterval: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export function loadConfig(): BridgeConfig {
  return {
    port: parseInt(process.env.PORT || '8080', 10),
    mcpAuthTokens: process.env.MCP_AUTH_TOKENS?.split(',') || [],
    minecraftAuthToken: process.env.MINECRAFT_AUTH_TOKEN || '',
    messageQueueSize: parseInt(process.env.MESSAGE_QUEUE_SIZE || '1000', 10),
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
    logLevel: (process.env.LOG_LEVEL as any) || 'info'
  };
}
