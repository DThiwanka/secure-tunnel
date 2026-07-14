import {
  TunnelPlugin,
  CompressionProvider,
  TunnelEnvelope,
  TunnelPluginContext,
} from '@secure-tunnel/core';

export interface CompressionPluginOptions {
  compressionProvider: CompressionProvider;
  compressionType?: 'gzip' | 'brotli';
  threshold?: number; // Minimum size in bytes to trigger compression
  enabled?: boolean;
}

export class CompressionPlugin implements TunnelPlugin {
  public readonly name = 'compression';
  private compressionProvider: CompressionProvider;
  private compressionType: 'gzip' | 'brotli';
  private threshold: number;
  private enabled: boolean;

  constructor(options: CompressionPluginOptions) {
    this.compressionProvider = options.compressionProvider;
    this.compressionType = options.compressionType || 'gzip';
    this.threshold = options.threshold !== undefined ? options.threshold : 1024;
    this.enabled = options.enabled !== false;
  }

  public async beforeDecrypt(
    envelope: TunnelEnvelope,
    _context: TunnelPluginContext,
  ): Promise<void> {
    if (!this.enabled || !envelope.compressed) {
      return;
    }

    try {
      const compressedBuffer = Buffer.from(envelope.payload, 'base64');
      const decompressed = await this.compressionProvider.decompress(compressedBuffer);
      envelope.payload = decompressed;
      envelope.compressed = false;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(`Decompression failed: ${err.message}`);
    }
  }

  public async beforeEncrypt(
    envelope: TunnelEnvelope,
    _context: TunnelPluginContext,
  ): Promise<void> {
    if (!this.enabled || envelope.compressed) {
      return;
    }

    const payloadLength = Buffer.byteLength(envelope.payload, 'utf8');
    if (payloadLength < this.threshold) {
      return;
    }

    try {
      const compressedBuffer = await this.compressionProvider.compress(envelope.payload);
      envelope.payload = compressedBuffer.toString('base64');
      envelope.compressed = true;
      envelope.compressionType = this.compressionType;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(`Compression failed: ${err.message}`);
    }
  }
}
