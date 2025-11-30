import WebSocket from 'ws';
import { Logger } from './logger';

export interface ReconnectionConfig {
  maxAttempts: number;
  initialDelay: number; // in milliseconds
  maxDelay: number; // in milliseconds
}

export class ReconnectionManager {
  private url: string;
  private config: ReconnectionConfig;
  private logger: Logger;
  private attempts: number = 0;
  private reconnectTimeout?: NodeJS.Timeout;
  private ws?: WebSocket;
  private onConnect?: (ws: WebSocket) => void;
  private onMessage?: (data: Buffer) => void;
  private onError?: (error: Error) => void;

  constructor(
    url: string,
    config: ReconnectionConfig,
    logger: Logger
  ) {
    this.url = url;
    this.config = config;
    this.logger = logger;
  }

  connect(
    onConnect: (ws: WebSocket) => void,
    onMessage: (data: Buffer) => void,
    onError?: (error: Error) => void
  ): void {
    this.onConnect = onConnect;
    this.onMessage = onMessage;
    this.onError = onError;
    this.attemptConnection();
  }

  private attemptConnection(): void {
    this.logger.info('Attempting connection', {
      url: this.url,
      attempt: this.attempts + 1,
      maxAttempts: this.config.maxAttempts
    });

    try {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        this.logger.info('Connection established', { url: this.url });
        this.attempts = 0; // Reset attempts on successful connection
        if (this.onConnect && this.ws) {
          this.onConnect(this.ws);
        }
      });

      this.ws.on('message', (data: Buffer) => {
        if (this.onMessage) {
          this.onMessage(data);
        }
      });

      this.ws.on('error', (error: Error) => {
        this.logger.error('WebSocket error', {
          url: this.url,
          error: error.message,
          stack: error.stack
        });
        if (this.onError) {
          this.onError(error);
        }
      });

      this.ws.on('close', () => {
        this.logger.warn('Connection closed', { url: this.url });
        this.scheduleReconnection();
      });

    } catch (error) {
      this.logger.error('Connection attempt failed', {
        url: this.url,
        error: error instanceof Error ? error.message : String(error)
      });
      this.scheduleReconnection();
    }
  }

  private scheduleReconnection(): void {
    if (this.attempts >= this.config.maxAttempts) {
      this.logger.error('Max reconnection attempts reached', {
        url: this.url,
        attempts: this.attempts
      });
      return;
    }

    // Calculate exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(
      this.config.initialDelay * Math.pow(2, this.attempts),
      this.config.maxDelay
    );

    this.attempts++;

    this.logger.info('Scheduling reconnection', {
      url: this.url,
      attempt: this.attempts,
      delayMs: delay
    });

    this.reconnectTimeout = setTimeout(() => {
      this.attemptConnection();
    }, delay);
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
    }
    this.logger.info('Disconnected', { url: this.url });
  }

  send(data: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      this.logger.warn('Cannot send message, connection not open', { url: this.url });
    }
  }
}
