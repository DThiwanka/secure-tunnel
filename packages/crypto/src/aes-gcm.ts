import crypto from 'crypto';
import { CryptoProvider } from '@secure-tunnel/core';

export class AesGcmCryptoProvider implements CryptoProvider {
  private static ALGORITHM = 'aes-256-gcm';
  private static IV_LENGTH = 12; // 96 bits is standard for GCM

  public async encrypt(
    data: string,
    secret: string,
  ): Promise<{ ciphertext: string; iv: string; tag?: string }> {
    try {
      // Derive a 256-bit key from the secret
      const key = this.deriveKey(secret);
      const iv = crypto.randomBytes(AesGcmCryptoProvider.IV_LENGTH);
      const cipher = crypto.createCipheriv(
        AesGcmCryptoProvider.ALGORITHM,
        key,
        iv,
      ) as crypto.CipherGCM;

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
      throw new Error(`AES-256-GCM encryption failed: ${err.message}`);
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
        throw new Error('Auth tag is required for AES-GCM decryption');
      }

      const key = this.deriveKey(secret);
      const ivBuffer = Buffer.from(iv, 'base64');
      const tagBuffer = Buffer.from(tag, 'base64');
      const decipher = crypto.createDecipheriv(
        AesGcmCryptoProvider.ALGORITHM,
        key,
        ivBuffer,
      ) as crypto.DecipherGCM;
      decipher.setAuthTag(tagBuffer);

      let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(`AES-256-GCM decryption failed: ${err.message}`);
    }
  }

  private deriveKey(secret: string): Buffer {
    // If the secret is already a 32-byte hex/base64 key, or we just hash it to get exactly 32 bytes.
    // Using sha256 to derive a secure 32-byte key from any arbitrary length secret.
    return crypto.createHash('sha256').update(secret).digest();
  }
}
