import crypto from 'crypto';
import { CryptoProvider } from '@secure-tunnel/core';

export class ChaCha20Poly1305CryptoProvider implements CryptoProvider {
  private static ALGORITHM = 'chacha20-poly1305';
  private static IV_LENGTH = 12; // 96 bits for standard IETF ChaCha20-Poly1305

  public async encrypt(
    data: string,
    secret: string,
  ): Promise<{ ciphertext: string; iv: string; tag?: string }> {
    try {
      const key = this.deriveKey(secret);
      const iv = crypto.randomBytes(ChaCha20Poly1305CryptoProvider.IV_LENGTH);
      // Node.js crypto supports chacha20-poly1305 with key and iv.
      const cipher = crypto.createCipheriv(
        ChaCha20Poly1305CryptoProvider.ALGORITHM,
        key,
        iv,
        { authTagLength: 16 } as crypto.CipherCCMOptions, // typecast for poly1305
      ) as crypto.CipherCCM;

      let ciphertext = cipher.update(data, 'utf8', 'base64');
      ciphertext += cipher.final('base64');
      const tag = cipher.getAuthTag().toString('base64');

      return {
        ciphertext,
        iv: iv.toString('base64'),
        tag,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(`ChaCha20-Poly1305 encryption failed: ${err.message}`);
    }
  }

  public async decrypt(
    ciphertext: string,
    secret: string,
    iv: string,
    tag?: string,
  ): Promise<string> {
    try {
      if (!tag) {
        throw new Error('Auth tag is required for ChaCha20-Poly1305 decryption');
      }

      const key = this.deriveKey(secret);
      const ivBuffer = Buffer.from(iv, 'base64');
      const tagBuffer = Buffer.from(tag, 'base64');
      const decipher = crypto.createDecipheriv(
        ChaCha20Poly1305CryptoProvider.ALGORITHM,
        key,
        ivBuffer,
        { authTagLength: 16 } as crypto.CipherCCMOptions,
      ) as crypto.DecipherCCM;
      decipher.setAuthTag(tagBuffer);

      let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(`ChaCha20-Poly1305 decryption failed: ${err.message}`);
    }
  }

  private deriveKey(secret: string): Buffer {
    // ChaCha20-Poly1305 requires a 32-byte key.
    return crypto.createHash('sha256').update(secret).digest();
  }
}
