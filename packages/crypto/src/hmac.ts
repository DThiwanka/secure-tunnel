import crypto from 'crypto';
import { SignatureProvider } from '@secure-tunnel/core';

export class HmacSignatureProvider implements SignatureProvider {
  private algorithm: string;

  constructor(algorithm = 'sha256') {
    this.algorithm = algorithm;
  }

  public async sign(data: string, key: string): Promise<string> {
    try {
      return crypto.createHmac(this.algorithm, key).update(data).digest('base64');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(`HMAC signing failed: ${err.message}`);
    }
  }

  public async verify(data: string, signature: string, key: string): Promise<boolean> {
    try {
      const expected = await this.sign(data, key);
      // Use timingSafeEqual to protect against timing attacks
      const expectedBuffer = Buffer.from(expected);
      const signatureBuffer = Buffer.from(signature);

      if (expectedBuffer.length !== signatureBuffer.length) {
        return false;
      }
      return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
    } catch (error) {
      return false;
    }
  }
}
