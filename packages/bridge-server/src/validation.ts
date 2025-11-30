import { BridgeMessage, MessageType, MessageSource } from '@minecraft-mcp-bridge/shared';

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

const VALID_MESSAGE_TYPES: MessageType[] = ['event', 'command', 'query', 'response', 'error'];
const VALID_MESSAGE_SOURCES: MessageSource[] = ['mcp', 'minecraft'];

export function validateMessage(message: any): ValidationResult {
  const errors: string[] = [];

  // Check required fields
  if (!message.version || typeof message.version !== 'string') {
    errors.push('Missing or invalid version field');
  }

  if (!message.type || !VALID_MESSAGE_TYPES.includes(message.type)) {
    errors.push(`Invalid message type: ${message.type}`);
  }

  if (!message.id || typeof message.id !== 'string') {
    errors.push('Missing or invalid id field');
  }

  if (!message.timestamp || typeof message.timestamp !== 'number') {
    errors.push('Missing or invalid timestamp field');
  }

  if (!message.source || !VALID_MESSAGE_SOURCES.includes(message.source)) {
    errors.push(`Invalid message source: ${message.source}`);
  }

  if (message.payload === undefined) {
    errors.push('Missing payload field');
  }

  // Type-specific validation
  if (message.type === 'command') {
    if (!message.payload || typeof message.payload !== 'object') {
      errors.push('Command message must have object payload');
    } else {
      if (!message.payload.command || typeof message.payload.command !== 'string') {
        errors.push('Command payload must have command field');
      }
      if (!message.payload.args || typeof message.payload.args !== 'object') {
        errors.push('Command payload must have args field');
      }
    }
  }

  if (message.type === 'response') {
    if (!message.payload || typeof message.payload !== 'object') {
      errors.push('Response message must have object payload');
    } else {
      if (typeof message.payload.success !== 'boolean') {
        errors.push('Response payload must have boolean success field');
      }
    }
  }

  if (message.type === 'event') {
    if (!message.payload || typeof message.payload !== 'object') {
      errors.push('Event message must have object payload');
    } else {
      if (!message.payload.eventType || typeof message.payload.eventType !== 'string') {
        errors.push('Event payload must have eventType field');
      }
      if (!message.payload.timestamp || typeof message.payload.timestamp !== 'number') {
        errors.push('Event payload must have timestamp field');
      }
      if (!message.payload.data) {
        errors.push('Event payload must have data field');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

export function validateVersion(version: string): boolean {
  // Version should be in format X.Y.Z
  const versionRegex = /^\d+\.\d+\.\d+$/;
  return versionRegex.test(version);
}
