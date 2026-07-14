import { CacheProvider } from '@secure-tunnel/core';

export interface GenericRedisClient {
  get(key: string): Promise<string | null | undefined> | string | null | undefined;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown> | unknown;
  del(key: string): Promise<unknown> | unknown;
}

export class RedisCacheProvider implements CacheProvider {
  private client: GenericRedisClient;

  constructor(client: unknown) {
    this.client = client as GenericRedisClient;
  }

  public async get(key: string): Promise<string | null> {
    const val = await this.client.get(key);
    return val || null;
  }

  public async set(key: string, value: string, ttlSeconds = 300): Promise<void> {
    // Try common redis set commands
    try {
      // standard command syntax: client.set(key, value, 'EX', ttlSeconds)
      await this.client.set(key, value, 'EX', ttlSeconds);
    } catch {
      // alternative options object syntax (newer node-redis): client.set(key, value, { EX: ttlSeconds })
      await this.client.set(key, value, { EX: ttlSeconds });
    }
  }

  public async has(key: string): Promise<boolean> {
    const val = await this.get(key);
    return val !== null;
  }

  public async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
