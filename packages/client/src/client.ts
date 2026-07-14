import {
  PluginRegistry,
  TunnelEnvelope,
  TunnelRequest,
  TunnelPluginContext,
  ValidationError,
  TunnelPlugin,
  CryptoProvider,
  SignatureProvider,
  CompressionProvider,
} from '@secure-tunnel/core';
import { AesGcmCryptoProvider, HmacSignatureProvider } from '@secure-tunnel/crypto';
import { GzipCompressionProvider } from '@secure-tunnel/compression';
import {
  EncryptionPlugin,
  CompressionPlugin,
  SignaturePlugin,
  TracingPlugin,
} from '@secure-tunnel/plugins';

export interface ClientOptions {
  endpoint: string;
  secretKey?: string;
  signatureKey?: string;
  encryption?: boolean;
  signing?: boolean;
  compression?: boolean;
  algorithm?: 'aes-256-gcm' | 'chacha20-poly1305';
  compressionType?: 'gzip' | 'brotli';
  plugins?: TunnelPlugin[];
  cryptoProvider?: CryptoProvider;
  signatureProvider?: SignatureProvider;
  compressionProvider?: CompressionProvider;
  fetch?: typeof fetch;
  defaultHeaders?: Record<string, string>;
}

export class TunnelClient {
  private endpoint: string;
  private registry: PluginRegistry;
  private fetchImpl: typeof fetch;
  private defaultHeaders: Record<string, string>;

  constructor(options: ClientOptions) {
    this.endpoint = options.endpoint;
    this.fetchImpl = options.fetch || globalThis.fetch.bind(globalThis);
    this.defaultHeaders = options.defaultHeaders || {};

    const encryption = options.encryption !== false;
    const signing = options.signing !== false;
    const compression = options.compression !== false;
    const algorithm = options.algorithm || 'aes-256-gcm';
    const compressionType = options.compressionType || 'gzip';

    const cryptoProvider = options.cryptoProvider || new AesGcmCryptoProvider();
    const signatureProvider = options.signatureProvider || new HmacSignatureProvider();
    const compressionProvider = options.compressionProvider || new GzipCompressionProvider();

    this.registry = new PluginRegistry();

    // 1. Tracing
    this.registry.register(new TracingPlugin());

    // 2. Signature (Symmetric Client-Server Signing)
    if (signing && options.signatureKey) {
      this.registry.register(
        new SignaturePlugin({
          signatureProvider,
          signatureKey: options.signatureKey,
        }),
      );
    }

    // 3. Encryption (Symmetric Client-Server Encryption)
    if (encryption && options.secretKey) {
      this.registry.register(
        new EncryptionPlugin({
          cryptoProvider,
          secretKey: options.secretKey,
          algorithm,
        }),
      );
    }

    // 4. Compression (Symmetric Client-Server Compression)
    if (compression) {
      this.registry.register(
        new CompressionPlugin({
          compressionProvider,
          compressionType,
        }),
      );
    }

    // Custom plugins
    if (options.plugins) {
      for (const plugin of options.plugins) {
        this.registry.register(plugin);
      }
    }
  }

  private generateNonce(): string {
    if (
      typeof globalThis.crypto !== 'undefined' &&
      typeof globalThis.crypto.getRandomValues === 'function'
    ) {
      const array = new Uint32Array(4);
      globalThis.crypto.getRandomValues(array);
      return Array.from(array, (dec) => dec.toString(16).padStart(8, '0')).join('');
    }
    return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  }

  private generateUUID(): string {
    if (
      typeof globalThis.crypto !== 'undefined' &&
      typeof globalThis.crypto.randomUUID === 'function'
    ) {
      return globalThis.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Prepares a request envelope from standard request parts, runs encrypt/sign pipelines.
   */
  public async prepareEnvelope(
    method: string,
    url: string,
    body?: unknown,
    headers?: Record<string, string>,
    query?: Record<string, unknown>,
  ): Promise<{ envelope: TunnelEnvelope; context: TunnelPluginContext }> {
    const requestId = this.generateUUID();
    const nonce = this.generateNonce();

    const tunnelReq: TunnelRequest = {
      method: method.toUpperCase(),
      url,
      headers: { ...this.defaultHeaders, ...headers },
      body,
      query: query || {},
      params: {},
      timestamp: Date.now(),
      nonce,
      requestId,
    };

    const envelope: TunnelEnvelope = {
      payload: JSON.stringify(tunnelReq),
      timestamp: tunnelReq.timestamp,
      nonce,
      requestId,
      encrypted: false,
      compressed: false,
    };

    const context: TunnelPluginContext = {
      state: { requestId },
    };

    // Client Outgoing Pipeline: beforeEncrypt -> afterEncrypt
    await this.registry.runBeforeEncrypt(envelope, context);
    await this.registry.runAfterEncrypt(envelope, context);

    return { envelope, context };
  }

  /**
   * Unwraps and decrypts/decompresses an incoming response envelope
   */
  public async unwrapEnvelope<T = unknown>(
    envelope: TunnelEnvelope,
    context?: TunnelPluginContext,
  ): Promise<T> {
    if (!envelope || typeof envelope !== 'object' || !envelope.payload) {
      throw new ValidationError('Invalid response envelope received from Gateway');
    }

    const ctx = context || { state: {} };

    // Client Incoming Pipeline: beforeDecrypt -> afterDecrypt
    await this.registry.runBeforeDecrypt(envelope, ctx);

    let decryptedResponse: unknown;
    try {
      decryptedResponse = JSON.parse(envelope.payload);
    } catch {
      decryptedResponse = envelope.payload;
    }

    const decryptedObj = decryptedResponse as {
      error?: { message?: string; code?: string; statusCode?: number };
    } | null;

    if (decryptedObj && decryptedObj.error) {
      const errObj = decryptedObj.error;
      const err = new Error(errObj.message || 'Gateway error') as Error & {
        code?: string;
        statusCode?: number;
      };
      err.code = errObj.code;
      err.statusCode = errObj.statusCode;
      await this.registry.runOnError(err, ctx);
      throw err;
    }

    await this.registry.runAfterDecrypt(decryptedResponse as TunnelRequest, ctx);
    return decryptedResponse as T;
  }

  /**
   * Executes a tunneled request via fetch and returns decrypted response data
   */
  public async request<T = unknown>(
    method: string,
    url: string,
    body?: unknown,
    headers?: Record<string, string>,
    query?: Record<string, unknown>,
  ): Promise<T> {
    const { envelope, context } = await this.prepareEnvelope(method, url, body, headers, query);

    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(envelope),
    });

    const responseBody = await response.text();
    let responseEnvelope: TunnelEnvelope;

    try {
      responseEnvelope = JSON.parse(responseBody) as TunnelEnvelope;
    } catch {
      throw new Error(`Failed to parse gateway response envelope as JSON: ${responseBody}`);
    }

    if (!response.ok && !responseEnvelope.payload) {
      throw new Error(`Gateway returned HTTP ${response.status}: ${responseBody}`);
    }

    const decryptedData = await this.unwrapEnvelope<T>(responseEnvelope, context);
    return decryptedData;
  }

  public async get<T = unknown>(
    url: string,
    headers?: Record<string, string>,
    query?: Record<string, unknown>,
  ): Promise<T> {
    return this.request<T>('GET', url, undefined, headers, query);
  }

  public async post<T = unknown>(
    url: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>('POST', url, body, headers);
  }

  public async put<T = unknown>(
    url: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>('PUT', url, body, headers);
  }

  public async patch<T = unknown>(
    url: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>('PATCH', url, body, headers);
  }

  public async delete<T = unknown>(url: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('DELETE', url, undefined, headers);
  }
}

export function createTunnel(options: ClientOptions): TunnelClient {
  return new TunnelClient(options);
}
