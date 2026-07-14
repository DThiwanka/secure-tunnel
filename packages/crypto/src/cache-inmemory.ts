import { CacheProvider } from '@secure-tunnel/core';

interface CacheEntry {
  value: string;
  expiresAt: number;
}

export class InMemoryCacheProvider implements CacheProvider {
  private cache = new Map<string, CacheEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(cleanupIntervalMs = 60000) {
    // Periodically evict expired entries to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.evictExpired(), cleanupIntervalMs);
    // Unref the timer so it doesn't block process exit in Node
    if (this.cleanupInterval && typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  public async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  public async set(key: string, value: string, ttlSeconds = 300): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  public async has(key: string): Promise<boolean> {
    const val = await this.get(key);
    return val !== null;
  }

  public async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  public close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}
