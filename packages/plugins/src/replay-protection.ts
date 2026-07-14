import {
  TunnelPlugin,
  TunnelEnvelope,
  TunnelPluginContext,
  ReplayAttackError,
  CacheProvider,
} from '@secure-tunnel/core';

export interface ReplayProtectionPluginOptions {
  cacheProvider: CacheProvider;
  toleranceSeconds?: number; // default 300 seconds
  enabled?: boolean;
}

export class ReplayProtectionPlugin implements TunnelPlugin {
  public readonly name = 'replay-protection';
  private cacheProvider: CacheProvider;
  private toleranceSeconds: number;
  private enabled: boolean;

  constructor(options: ReplayProtectionPluginOptions) {
    this.cacheProvider = options.cacheProvider;
    this.toleranceSeconds = options.toleranceSeconds !== undefined ? options.toleranceSeconds : 300;
    this.enabled = options.enabled !== false;
  }

  public async beforeDecrypt(
    envelope: TunnelEnvelope,
    _context: TunnelPluginContext,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const { timestamp, nonce } = envelope;
    const now = Date.now();
    const ageSeconds = Math.abs(now - timestamp) / 1000;

    // 1. Verify request timestamp is within tolerance window
    if (ageSeconds > this.toleranceSeconds) {
      throw new ReplayAttackError(
        `Request timestamp is expired or skewed by ${ageSeconds.toFixed(1)}s (max: ${this.toleranceSeconds}s)`,
      );
    }

    // 2. Check and store nonce in cache to prevent reuse
    const cacheKey = `secure-tunnel:nonce:${nonce}`;
    const isReplayed = await this.cacheProvider.has(cacheKey);
    if (isReplayed) {
      throw new ReplayAttackError(`Duplicate request nonce detected (replay attack): ${nonce}`);
    }

    // Store nonce for the duration of the tolerance window
    await this.cacheProvider.set(cacheKey, '1', this.toleranceSeconds);
  }
}
