import {
  TunnelPlugin,
  CryptoProvider,
  TunnelEnvelope,
  TunnelPluginContext,
  EncryptionError,
} from '@secure-tunnel/core';

export interface EncryptionPluginOptions {
  cryptoProvider: CryptoProvider;
  secretKey: string | (() => Promise<string> | string);
  algorithm?: string;
  enabled?: boolean;
}

export class EncryptionPlugin implements TunnelPlugin {
  public readonly name = 'encryption';
  private cryptoProvider: CryptoProvider;
  private secretKey: string | (() => Promise<string> | string);
  private algorithm: string;
  private enabled: boolean;

  constructor(options: EncryptionPluginOptions) {
    this.cryptoProvider = options.cryptoProvider;
    this.secretKey = options.secretKey;
    this.algorithm = options.algorithm || 'aes-256-gcm';
    this.enabled = options.enabled !== false;
  }

  private async getSecretKey(): Promise<string> {
    if (typeof this.secretKey === 'function') {
      return await this.secretKey();
    }
    return this.secretKey;
  }

  public async beforeDecrypt(
    envelope: TunnelEnvelope,
    _context: TunnelPluginContext,
  ): Promise<void> {
    if (!this.enabled || !envelope.encrypted) {
      return;
    }

    try {
      const parts = envelope.payload.split(':');
      if (parts.length < 2) {
        throw new Error(
          'Invalid encrypted payload format. Expected iv:tag:ciphertext or iv:ciphertext',
        );
      }

      let iv = '';
      let tag = '';
      let ciphertext = '';

      if (parts.length === 3) {
        [iv, tag, ciphertext] = parts;
      } else {
        [iv, ciphertext] = parts;
      }

      const secret = await this.getSecretKey();
      const decrypted = await this.cryptoProvider.decrypt(ciphertext, secret, iv, tag || undefined);
      envelope.payload = decrypted;
      envelope.encrypted = false; // Decrypted successfully
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new EncryptionError(`Decryption failed: ${err.message}`);
    }
  }

  public async afterEncrypt(
    envelope: TunnelEnvelope,
    _context: TunnelPluginContext,
  ): Promise<void> {
    if (!this.enabled || envelope.encrypted) {
      return;
    }

    try {
      const secret = await this.getSecretKey();
      const result = await this.cryptoProvider.encrypt(envelope.payload, secret);

      // Serialize as iv:tag:ciphertext
      envelope.payload = `${result.iv}:${result.tag || ''}:${result.ciphertext}`;
      envelope.encrypted = true;
      envelope.algorithm = this.algorithm;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new EncryptionError(`Encryption failed: ${err.message}`);
    }
  }
}
