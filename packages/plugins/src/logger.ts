import {
  TunnelPlugin,
  TunnelEnvelope,
  TunnelRequest,
  TunnelPluginContext,
} from '@secure-tunnel/core';
import { Logger } from '@secure-tunnel/logger';

export interface LoggerPluginOptions {
  logger: Logger;
}

export class LoggerPlugin implements TunnelPlugin {
  public readonly name = 'logger';
  private logger: Logger;

  constructor(options: LoggerPluginOptions) {
    this.logger = options.logger;
  }

  public async beforeDecrypt(
    envelope: TunnelEnvelope,
    context: TunnelPluginContext,
  ): Promise<void> {
    context.state.startTime = Date.now();
    this.logger.info('Gateway received tunnel envelope', {
      requestId: envelope.requestId,
      nonce: envelope.nonce,
      timestamp: envelope.timestamp,
      compressed: envelope.compressed,
      encrypted: envelope.encrypted,
    });
  }

  public async afterDecrypt(request: TunnelRequest, _context: TunnelPluginContext): Promise<void> {
    this.logger.info('Tunnel request decrypted successfully', {
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      clientTimestamp: request.timestamp,
    });
  }

  public async beforeForward(request: TunnelRequest, _context: TunnelPluginContext): Promise<void> {
    this.logger.info('Forwarding request internally to Express router', {
      requestId: request.requestId,
      method: request.method,
      url: request.url,
    });
  }

  public async afterForward(response: unknown, context: TunnelPluginContext): Promise<void> {
    const elapsed = context.state.startTime ? Date.now() - (context.state.startTime as number) : undefined;
    this.logger.info('Internal route executed successfully', {
      requestId: (context.state.requestId as string) || 'unknown',
      durationMs: elapsed,
    });
  }

  public async beforeEncrypt(
    envelope: TunnelEnvelope,
    _context: TunnelPluginContext,
  ): Promise<void> {
    this.logger.info('Preparing to encrypt response envelope', {
      requestId: envelope.requestId,
    });
  }

  public async afterEncrypt(envelope: TunnelEnvelope, context: TunnelPluginContext): Promise<void> {
    const elapsed = context.state.startTime ? Date.now() - (context.state.startTime as number) : undefined;
    this.logger.info('Gateway response prepared and encrypted', {
      requestId: envelope.requestId,
      totalDurationMs: elapsed,
      compressed: envelope.compressed,
      encrypted: envelope.encrypted,
    });
  }

  public async onError(error: Error, context: TunnelPluginContext): Promise<void> {
    const elapsed = context.state.startTime ? Date.now() - (context.state.startTime as number) : undefined;
    this.logger.error('Error occurred in tunnel processing', error, {
      requestId: (context.state.requestId as string) || 'unknown',
      durationMs: elapsed,
    });
  }
}
