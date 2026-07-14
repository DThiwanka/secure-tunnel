import {
  TunnelPlugin,
  SignatureProvider,
  TunnelEnvelope,
  TunnelPluginContext,
  SignatureError,
} from '@secure-tunnel/core';

export interface SignaturePluginOptions {
  signatureProvider: SignatureProvider;
  signatureKey: string | (() => Promise<string> | string);
  enabled?: boolean;
}

export class SignaturePlugin implements TunnelPlugin {
  public readonly name = 'signature';
  private signatureProvider: SignatureProvider;
  private signatureKey: string | (() => Promise<string> | string);
  private enabled: boolean;

  constructor(options: SignaturePluginOptions) {
    this.signatureProvider = options.signatureProvider;
    this.signatureKey = options.signatureKey;
    this.enabled = options.enabled !== false;
  }

  private async getSignatureKey(): Promise<string> {
    if (typeof this.signatureKey === 'function') {
      return await this.signatureKey();
    }
    return this.signatureKey;
  }

  private constructSigningString(envelope: TunnelEnvelope): string {
    // Construct a canonical representation to sign
    return [
      envelope.payload,
      envelope.timestamp.toString(),
      envelope.nonce,
      envelope.requestId,
    ].join(':');
  }

  public async beforeDecrypt(
    envelope: TunnelEnvelope,
    _context: TunnelPluginContext,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    if (!envelope.signature) {
      throw new SignatureError('Signature is missing from the request envelope');
    }

    const signingKey = await this.getSignatureKey();
    const dataToVerify = this.constructSigningString(envelope);
    const isValid = await this.signatureProvider.verify(
      dataToVerify,
      envelope.signature,
      signingKey,
    );

    if (!isValid) {
      throw new SignatureError('Invalid request signature or payload has been tampered with');
    }
  }

  public async afterEncrypt(
    envelope: TunnelEnvelope,
    _context: TunnelPluginContext,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const signingKey = await this.getSignatureKey();
    const dataToSign = this.constructSigningString(envelope);
    const signature = await this.signatureProvider.sign(dataToSign, signingKey);

    envelope.signature = signature;
  }
}
