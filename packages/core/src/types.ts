export interface TunnelRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  query: Record<string, unknown>;
  params: Record<string, string>;
  timestamp: number;
  nonce: string;
  requestId: string;
  metadata?: Record<string, unknown>;
}

export interface TunnelEnvelope {
  payload: string; // Base64 ciphertext or plaintext
  signature?: string;
  timestamp: number;
  nonce: string;
  requestId: string;
  encrypted: boolean;
  compressed: boolean;
  compressionType?: 'gzip' | 'brotli';
  algorithm?: string;
}

export interface TunnelPluginContext {
  state: Record<string, unknown>;
  rawRequest?: unknown; // Native Express Request (server side)
  rawResponse?: unknown; // Native Express Response (server side)
  [key: string]: unknown;
}

export interface TunnelPlugin {
  name: string;
  beforeDecrypt?(envelope: TunnelEnvelope, context: TunnelPluginContext): Promise<void>;
  afterDecrypt?(request: TunnelRequest, context: TunnelPluginContext): Promise<void>;
  beforeForward?(request: TunnelRequest, context: TunnelPluginContext): Promise<void>;
  afterForward?(response: unknown, context: TunnelPluginContext): Promise<void>;
  beforeEncrypt?(envelope: TunnelEnvelope, context: TunnelPluginContext): Promise<void>;
  afterEncrypt?(envelope: TunnelEnvelope, context: TunnelPluginContext): Promise<void>;
  onError?(error: Error, context: TunnelPluginContext): Promise<void>;
}

export interface CryptoProvider {
  encrypt(data: string, secret: string): Promise<{ ciphertext: string; iv: string; tag?: string }>;
  decrypt(ciphertext: string, secret: string, iv: string, tag?: string): Promise<string>;
}

export interface SignatureProvider {
  sign(data: string, key: string): Promise<string>;
  verify(data: string, signature: string, key: string): Promise<boolean>;
}

export interface CacheProvider {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  has(key: string): Promise<boolean>;
  del(key: string): Promise<void>;
}

export interface CompressionProvider {
  compress(data: string | Buffer): Promise<Buffer>;
  decompress(data: Buffer): Promise<string>;
}
