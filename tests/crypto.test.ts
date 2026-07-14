import { describe, it, expect, vi } from 'vitest';
import {
  AesGcmCryptoProvider,
  ChaCha20Poly1305CryptoProvider,
  HmacSignatureProvider,
  InMemoryCacheProvider,
  RedisCacheProvider,
} from '../packages/crypto/src';

describe('Crypto Providers', () => {
  const secretKey = 'my-super-secret-key-32-chars-long-123456';
  const plaintext = 'Hello, Secure Tunnel! This is a test message.';

  it('AesGcmCryptoProvider should encrypt and decrypt data correctly', async () => {
    const provider = new AesGcmCryptoProvider();
    const encrypted = await provider.encrypt(plaintext, secretKey);

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.tag).toBeDefined();

    const decrypted = await provider.decrypt(
      encrypted.ciphertext,
      secretKey,
      encrypted.iv,
      encrypted.tag,
    );
    expect(decrypted).toBe(plaintext);
  });

  it('AesGcmCryptoProvider should fail to decrypt with incorrect key', async () => {
    const provider = new AesGcmCryptoProvider();
    const encrypted = await provider.encrypt(plaintext, secretKey);
    const wrongKey = 'wrong-secret-key-123456789012345678';

    await expect(
      provider.decrypt(encrypted.ciphertext, wrongKey, encrypted.iv, encrypted.tag),
    ).rejects.toThrow();
  });

  it('ChaCha20Poly1305CryptoProvider should encrypt and decrypt correctly', async () => {
    const provider = new ChaCha20Poly1305CryptoProvider();
    const encrypted = await provider.encrypt(plaintext, secretKey);

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.tag).toBeDefined();

    const decrypted = await provider.decrypt(
      encrypted.ciphertext,
      secretKey,
      encrypted.iv,
      encrypted.tag,
    );
    expect(decrypted).toBe(plaintext);
  });
});

describe('Signature Provider', () => {
  const signatureKey = 'sig-key-12345';
  const data = 'some-payload-data';

  it('HmacSignatureProvider should sign and verify signatures', async () => {
    const provider = new HmacSignatureProvider();
    const signature = await provider.sign(data, signatureKey);

    expect(signature).toBeDefined();
    const isValid = await provider.verify(data, signature, signatureKey);
    expect(isValid).toBe(true);

    const isInvalid = await provider.verify(data + 'modified', signature, signatureKey);
    expect(isInvalid).toBe(false);
  });
});

describe('Caches (Replay Protection)', () => {
  it('InMemoryCacheProvider should support basic cache lifecycle and TTL', async () => {
    // Clean up fast for testing
    const cache = new InMemoryCacheProvider(100); 
    await cache.set('nonce-1', '1', 1); // 1 second TTL

    let hasNonce = await cache.has('nonce-1');
    expect(hasNonce).toBe(true);

    // Wait 1.1s for expiration
    await new Promise((resolve) => setTimeout(resolve, 1100));

    hasNonce = await cache.has('nonce-1');
    expect(hasNonce).toBe(false);

    cache.close();
  });

  it('RedisCacheProvider should wrap generic Redis client calls', async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue('value'),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
    };

    const redisCache = new RedisCacheProvider(mockClient);

    const val = await redisCache.get('test-key');
    expect(val).toBe('value');
    expect(mockClient.get).toHaveBeenCalledWith('test-key');

    await redisCache.set('test-key', 'val', 60);
    expect(mockClient.set).toHaveBeenCalled();

    await redisCache.del('test-key');
    expect(mockClient.del).toHaveBeenCalledWith('test-key');
  });
});
