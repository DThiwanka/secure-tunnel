import {
  TunnelPlugin,
  TunnelEnvelope,
  TunnelPluginContext,
  CacheProvider,
  GatewayError,
} from '@secure-tunnel/core';

export interface RateLimitPluginOptions {
  cacheProvider: CacheProvider;
  limit?: number; // Max requests
  windowSeconds?: number; // Time window
  keyGenerator?: (
    envelope: TunnelEnvelope,
    context: TunnelPluginContext,
  ) => string | Promise<string>;
}

export class RateLimitPlugin implements TunnelPlugin {
  public readonly name = 'rate-limit';
  private cacheProvider: CacheProvider;
  private limit: number;
  private windowSeconds: number;
  private keyGenerator: (
    envelope: TunnelEnvelope,
    context: TunnelPluginContext,
  ) => string | Promise<string>;

  constructor(options: RateLimitPluginOptions) {
    this.cacheProvider = options.cacheProvider;
    this.limit = options.limit !== undefined ? options.limit : 60;
    this.windowSeconds = options.windowSeconds !== undefined ? options.windowSeconds : 60;
    this.keyGenerator =
      options.keyGenerator ||
      ((_envelope, context) => {
        // Standard fallback: use IP address if available on server, or default key
        const rawReq = context.rawRequest as { ip?: string; headers?: Record<string, string> } | undefined;
        return rawReq?.ip || (rawReq?.headers ? rawReq.headers['x-forwarded-for'] || '' : '') || 'global-client';
      });
  }

  public async beforeDecrypt(
    envelope: TunnelEnvelope,
    context: TunnelPluginContext,
  ): Promise<void> {
    const key = await this.keyGenerator(envelope, context);
    const cacheKey = `secure-tunnel:rate-limit:${key}`;

    const currentVal = await this.cacheProvider.get(cacheKey);
    const count = currentVal ? parseInt(currentVal, 10) : 0;

    if (count >= this.limit) {
      throw new GatewayError('Too Many Requests', 429);
    }

    await this.cacheProvider.set(cacheKey, (count + 1).toString(), this.windowSeconds);
  }
}
