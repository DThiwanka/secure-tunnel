# Plugins Guide

Secure Tunnel features a pluggable architecture. Both the Client SDK and the Express Gateway utilize a unified plugin registry. This allows plugins to run symmetrically on both client and server sides.

## Plugin Interface

A plugin is an object or class implementing the `TunnelPlugin` interface:

```typescript
export interface TunnelPlugin {
  name: string;
  beforeDecrypt?(envelope: TunnelEnvelope, context: TunnelPluginContext): Promise<void>;
  afterDecrypt?(request: TunnelRequest, context: TunnelPluginContext): Promise<void>;
  beforeForward?(request: TunnelRequest, context: TunnelPluginContext): Promise<void>;
  afterForward?(response: any, context: TunnelPluginContext): Promise<void>;
  beforeEncrypt?(envelope: TunnelEnvelope, context: TunnelPluginContext): Promise<void>;
  afterEncrypt?(envelope: TunnelEnvelope, context: TunnelPluginContext): Promise<void>;
  onError?(error: Error, context: TunnelPluginContext): Promise<void>;
}
```

### Context Object

Every hook receives a mutable `TunnelPluginContext` containing:
- `state`: A local key-value store persistent across a single request-response cycle.
- `rawRequest` (Server only): The native incoming Express `Request` object.
- `rawResponse` (Server only): The native outgoing Express `Response` object.

---

## Example: Writing a RateLimiter Plugin

A simple gateway plugin that counts requests per IP:

```typescript
import { TunnelPlugin, TunnelEnvelope, TunnelPluginContext, GatewayError, CacheProvider } from '@secure-tunnel/core';

export class CustomRateLimitPlugin implements TunnelPlugin {
  public readonly name = 'custom-rate-limiter';
  private cache: CacheProvider;
  private limit = 100; // max requests
  private windowSeconds = 3600; // 1 hour

  constructor(cache: CacheProvider) {
    this.cache = cache;
  }

  public async beforeDecrypt(envelope: TunnelEnvelope, context: TunnelPluginContext): Promise<void> {
    const rawReq = context.rawRequest;
    const clientIp = rawReq?.ip || 'unknown-client';
    const cacheKey = `rate-limit:${clientIp}`;

    const currentVal = await this.cache.get(cacheKey);
    const count = currentVal ? parseInt(currentVal, 10) : 0;

    if (count >= this.limit) {
      throw new GatewayError('Too Many Requests', 429);
    }

    await this.cache.set(cacheKey, (count + 1).toString(), this.windowSeconds);
  }
}
```

---

## Example: Writing a Response Audit Plugin

A plugin that logs response sizes:

```typescript
import { TunnelPlugin, TunnelEnvelope, TunnelPluginContext } from '@secure-tunnel/core';

export class AuditLogPlugin implements TunnelPlugin {
  public readonly name = 'audit-log';

  public async afterEncrypt(envelope: TunnelEnvelope, context: TunnelPluginContext): Promise<void> {
    const sizeBytes = Buffer.byteLength(envelope.payload, 'utf8');
    console.log(`[Audit] Request ID ${envelope.requestId} encrypted. Payload size: ${sizeBytes} bytes.`);
  }
}
```

---

## Registering Plugins

### On Express Gateway
```typescript
import { createTunnelGateway } from '@secure-tunnel/express';

app.use(
  createTunnelGateway({
    endpoint: '/api/gateway',
    plugins: [
      new CustomRateLimitPlugin(myCache),
      new AuditLogPlugin()
    ]
  })
);
```

### On Client SDK
```typescript
import { createTunnel } from '@secure-tunnel/client';

const client = createTunnel({
  endpoint: 'http://localhost:3000/api/gateway',
  plugins: [
    new AuditLogPlugin()
  ]
});
```
