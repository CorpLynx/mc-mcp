// Configuration management for MCP Server
export interface MCPServerConfig {
  bridgeUrl: string;
  authToken: string;
  reconnectAttempts: number;
  reconnectDelay: number;
  logLevel: string;
}

export function loadConfig(): MCPServerConfig {
  return {
    bridgeUrl: process.env.BRIDGE_URL || 'ws://localhost:8080',
    authToken: process.env.AUTH_TOKEN || '',
    reconnectAttempts: parseInt(process.env.RECONNECT_ATTEMPTS || '5', 10),
    reconnectDelay: parseInt(process.env.RECONNECT_DELAY || '1000', 10),
    logLevel: process.env.LOG_LEVEL || 'INFO'
  };
}
