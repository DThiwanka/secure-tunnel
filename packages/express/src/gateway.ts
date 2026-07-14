import { Request, Response, RequestHandler, NextFunction } from 'express';
import crypto from 'crypto';
import {
  PluginRegistry,
  TunnelEnvelope,
  TunnelRequest,
  TunnelPluginContext,
  GatewayError,
  ValidationError,
  TunnelPlugin,
  CryptoProvider,
  SignatureProvider,
  CacheProvider,
  CompressionProvider,
} from '@secure-tunnel/core';
import {
  AesGcmCryptoProvider,
  HmacSignatureProvider,
  InMemoryCacheProvider,
} from '@secure-tunnel/crypto';
import { GzipCompressionProvider } from '@secure-tunnel/compression';
import { ConsoleLogger } from '@secure-tunnel/logger';
import {
  EncryptionPlugin,
  CompressionPlugin,
  SignaturePlugin,
  ReplayProtectionPlugin,
  TracingPlugin,
  LoggerPlugin,
} from '@secure-tunnel/plugins';

/* eslint-disable @typescript-eslint/no-namespace */
// Expose Request property extension
declare global {
  namespace Express {
    interface Request {
      tunnelProcessed?: boolean;
    }
  }
}

export interface GatewayOptions {
  endpoint: string;
  secretKey?: string;
  signatureKey?: string;
  encryption?: boolean;
  signing?: boolean;
  compression?: boolean;
  replayProtection?: boolean;
  algorithm?: 'aes-256-gcm' | 'chacha20-poly1305';
  compressionType?: 'gzip' | 'brotli';
  toleranceSeconds?: number;
  plugins?: TunnelPlugin[];
  cacheProvider?: CacheProvider;
  cryptoProvider?: CryptoProvider;
  signatureProvider?: SignatureProvider;
  compressionProvider?: CompressionProvider;
  logger?: unknown;
}

interface CustomLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

interface ExpressAppInternal {
  handle(req: Request, res: Response, callback: (err?: unknown) => void): void;
}

export function createTunnelGateway(options: GatewayOptions): RequestHandler {
  const endpoint = options.endpoint || '/api/gateway';
  const encryption = options.encryption !== false;
  const signing = options.signing !== false;
  const compression = options.compression !== false;
  const replayProtection = options.replayProtection !== false;
  const algorithm = options.algorithm || 'aes-256-gcm';
  const compressionType = options.compressionType || 'gzip';
  const toleranceSeconds = options.toleranceSeconds || 300;

  // Initialize providers
  const logger = (options.logger || new ConsoleLogger()) as CustomLogger;
  const cryptoProvider = options.cryptoProvider || new AesGcmCryptoProvider();
  const signatureProvider = options.signatureProvider || new HmacSignatureProvider();
  const cacheProvider = options.cacheProvider || new InMemoryCacheProvider();
  const compressionProvider = options.compressionProvider || new GzipCompressionProvider();

  // Create plugin registry
  const registry = new PluginRegistry();

  // 1. Tracing (always first)
  registry.register(new TracingPlugin());

  // 2. Logging
  registry.register(new LoggerPlugin({ logger }));

  // 3. Signature Validation (if enabled)
  if (signing && options.signatureKey) {
    registry.register(
      new SignaturePlugin({
        signatureProvider,
        signatureKey: options.signatureKey,
      }),
    );
  }

  // 4. Replay Protection (if enabled)
  if (replayProtection) {
    registry.register(
      new ReplayProtectionPlugin({
        cacheProvider,
        toleranceSeconds,
      }),
    );
  }

  // 5. Encryption (if enabled)
  if (encryption && options.secretKey) {
    registry.register(
      new EncryptionPlugin({
        cryptoProvider,
        secretKey: options.secretKey,
        algorithm,
      }),
    );
  }

  // 6. Compression (if enabled)
  if (compression) {
    registry.register(
      new CompressionPlugin({
        compressionProvider,
        compressionType,
      }),
    );
  }

  // Register custom user plugins
  if (options.plugins) {
    for (const plugin of options.plugins) {
      registry.register(plugin);
    }
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. Check if request has already been processed by the tunnel
    if (req.tunnelProcessed) {
      return next();
    }

    // 2. Check if request matches gateway endpoint
    if (req.path === endpoint && req.method === 'POST') {
      const context: TunnelPluginContext = {
        state: {},
        rawRequest: req,
        rawResponse: res,
      };

      try {
        // Parse request envelope
        const envelope = req.body as TunnelEnvelope;
        if (!envelope || typeof envelope !== 'object') {
          throw new ValidationError('Invalid request body. Expected a TunnelEnvelope JSON object.');
        }
        if (!envelope.payload) {
          throw new ValidationError('TunnelEnvelope is missing the payload field.');
        }

        // Run beforeDecrypt hooks (Signature, Replay, Decrypt, Decompress)
        await registry.runBeforeDecrypt(envelope, context);

        // Envelope payload should now be decrypted and decompressed JSON string
        let tunnelReq: TunnelRequest;
        try {
          tunnelReq = JSON.parse(envelope.payload) as TunnelRequest;
        } catch {
          throw new ValidationError('Payload is not valid JSON after decryption');
        }

        // Run afterDecrypt hooks
        await registry.runAfterDecrypt(tunnelReq, context);

        // Reconstruct Express Request
        req.url = tunnelReq.url;
        req.method = tunnelReq.method;
        req.body = tunnelReq.body;
        req.query = (tunnelReq.query as unknown as typeof req.query) || {};
        req.headers = { ...req.headers, ...tunnelReq.headers };
        req.tunnelProcessed = true;

        // Run beforeForward hooks (e.g. Authentication check)
        await registry.runBeforeForward(tunnelReq, context);

        // Intercept response stream
        const originalWrite = res.write;
        const originalEnd = res.end;
        const responseChunks: Buffer[] = [];
        let isInterceptedFinished = false;

        res.write = function (chunk: unknown, ..._args: unknown[]): boolean {
          if (chunk) {
            const buf = Buffer.isBuffer(chunk)
              ? chunk
              : typeof chunk === 'string'
              ? Buffer.from(chunk, 'utf8')
              : Buffer.from(String(chunk), 'utf8');
            responseChunks.push(buf);
          }
          return true;
        };

        // Standard send override as a fallback / helper
        res.send = function (body: unknown): Response {
          const content = typeof body === 'object' ? JSON.stringify(body) : String(body);
          res.write(content);
          res.end();
          return res;
        };

        res.json = function (obj: unknown): Response {
          res.setHeader('content-type', 'application/json');
          return res.send(obj);
        };

        res.end = (async function (chunk: unknown, ..._args: unknown[]): Promise<void> {
          if (isInterceptedFinished) {
            return;
          }
          isInterceptedFinished = true;

          if (chunk) {
            const buf = Buffer.isBuffer(chunk)
              ? chunk
              : typeof chunk === 'string'
              ? Buffer.from(chunk, 'utf8')
              : Buffer.from(String(chunk), 'utf8');
            responseChunks.push(buf);
          }

          try {
            const finalBuffer = Buffer.concat(responseChunks);
            const responseDataStr = finalBuffer.toString('utf8');

            let parsedResponseData: unknown = responseDataStr;
            try {
              parsedResponseData = JSON.parse(responseDataStr);
            } catch {
              // Leave as string if not JSON
            }

            // Run afterForward hooks
            await registry.runAfterForward(parsedResponseData, context);

            // Construct response envelope
            const responseEnvelope: TunnelEnvelope = {
              payload:
                typeof parsedResponseData === 'object' && parsedResponseData !== null
                  ? JSON.stringify(parsedResponseData)
                  : responseDataStr,
              timestamp: Date.now(),
              nonce: crypto.randomBytes(16).toString('hex'),
              requestId: (context.state.requestId as string) || envelope.requestId,
              encrypted: false,
              compressed: false,
            };

            // Run beforeEncrypt hooks (Compression)
            await registry.runBeforeEncrypt(responseEnvelope, context);

            // Run afterEncrypt hooks (Encryption, Signing)
            await registry.runAfterEncrypt(responseEnvelope, context);

            // Set final headers and send response envelope
            res.setHeader('content-type', 'application/json');
            const serializedEnvelope = JSON.stringify(responseEnvelope);
            const responseBuffer = Buffer.from(serializedEnvelope, 'utf8');

            res.write = originalWrite;
            res.end = originalEnd;

            // In Express, setting Content-Length is good practice when overriding bodies
            res.setHeader('content-length', responseBuffer.length);
            ((originalEnd as unknown) as (data: Buffer) => void).call(res, responseBuffer);
          } catch (err) {
            const errorInstance = err instanceof Error ? err : new Error(String(err));
            await handleGatewayError(
              errorInstance,
              res,
              registry,
              context,
              originalWrite,
              originalEnd,
            );
          }
        }) as unknown as Response['end'];

        // Forward internally to the Express application router
        ((req.app as unknown) as ExpressAppInternal).handle(req, res, async (err: unknown) => {
          // If the router finishes and calls the final callback, it means either:
          // 1. Route was not found (404)
          // 2. An error propagated past all router middleware
          if (err) {
            const errorInstance = err instanceof Error ? err : new Error(String(err));
            await handleGatewayError(
              errorInstance,
              res,
              registry,
              context,
              originalWrite,
              originalEnd,
            );
          } else {
            // 404 Route Not Found
            const notFoundErr = new GatewayError(`Route ${req.method} ${req.url} not found`, 404);
            await handleGatewayError(
              notFoundErr,
              res,
              registry,
              context,
              originalWrite,
              originalEnd,
            );
          }
        });
      } catch (error) {
        const errorInstance = error instanceof Error ? error : new Error(String(error));
        await handleGatewayError(errorInstance, res, registry, context, res.write, res.end);
      }
    } else {
      next();
    }
  };
}

async function handleGatewayError(
  error: Error & { statusCode?: number; code?: string },
  res: Response,
  registry: PluginRegistry,
  context: TunnelPluginContext,
  originalWrite: unknown,
  originalEnd: unknown,
): Promise<void> {
  const statusCode = error.statusCode || 500;
  res.statusCode = statusCode;

  try {
    await registry.runOnError(error, context);

    const errorPayload = {
      error: {
        message: error.message || 'Internal server error',
        code: error.code || 'GATEWAY_ERROR',
        statusCode,
      },
    };

    const responseEnvelope: TunnelEnvelope = {
      payload: JSON.stringify(errorPayload),
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex'),
      requestId: (context.state.requestId as string) || 'unknown',
      encrypted: false,
      compressed: false,
    };

    // Attempt to encrypt the error envelope using hooks if Encryption was set up
    await registry.runBeforeEncrypt(responseEnvelope, context);
    await registry.runAfterEncrypt(responseEnvelope, context);

    res.setHeader('content-type', 'application/json');
    const serializedEnvelope = JSON.stringify(responseEnvelope);
    const responseBuffer = Buffer.from(serializedEnvelope, 'utf8');

    res.setHeader('content-length', responseBuffer.length);

    ((originalEnd as unknown) as (data: Buffer) => void).call(res, responseBuffer);
  } catch (err) {
    const errorHandlingErr = err instanceof Error ? err : new Error(String(err));
    // If the error handling hooks fail, return fallback unencrypted error JSON
    res.statusCode = 500;
    const fallbackEnvelope = {
      payload: JSON.stringify({
        error: {
          message: `Gateway error handling failed: ${errorHandlingErr.message}. Original error: ${error.message}`,
          code: 'CRITICAL_GATEWAY_ERROR',
          statusCode: 500,
        },
      }),
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex'),
      requestId: 'unknown',
      encrypted: false,
      compressed: false,
    };
    res.setHeader('content-type', 'application/json');
    ((originalEnd as unknown) as (data: string) => void).call(res, JSON.stringify(fallbackEnvelope));
  }
}
