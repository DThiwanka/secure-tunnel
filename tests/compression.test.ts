import { describe, it, expect } from 'vitest';
import { GzipCompressionProvider, BrotliCompressionProvider } from '../packages/compression/src';

describe('Compression Providers', () => {
  const message = 'Hello, compression! '.repeat(50); // Large enough to check reduction

  it('GzipCompressionProvider should compress and decompress data correctly', async () => {
    const provider = new GzipCompressionProvider();
    const compressed = await provider.compress(message);

    expect(compressed.length).toBeLessThan(Buffer.byteLength(message));

    const decompressed = await provider.decompress(compressed);
    expect(decompressed).toBe(message);
  });

  it('BrotliCompressionProvider should compress and decompress data correctly', async () => {
    const provider = new BrotliCompressionProvider();
    const compressed = await provider.compress(message);

    expect(compressed.length).toBeLessThan(Buffer.byteLength(message));

    const decompressed = await provider.decompress(compressed);
    expect(decompressed).toBe(message);
  });
});
