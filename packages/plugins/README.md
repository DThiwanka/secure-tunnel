# @secure-tunnel/plugins

> Official built-in plugin collection for the Secure Tunnel pipeline — encryption, compression, logging, authentication, rate limiting, tracing, replay protection, and HMAC signing.

[![npm version](https://img.shields.io/npm/v/@secure-tunnel/plugins.svg)](https://www.npmjs.com/package/@secure-tunnel/plugins)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

---

## Overview

`@secure-tunnel/plugins` ships all standard plugins that plug into the Secure Tunnel client/server pipeline via the `PluginRegistry`. Each plugin implements the `TunnelPlugin` interface from `@secure-tunnel/core` and hooks into specific lifecycle stages.

---

## Installation

```bash
npm install @secure-tunnel/plugins @secure-tunnel/core
```

---

## Available Plugins

| Plugin Class | Description |
|---|---|
| `EncryptionPlugin` | AES-256-GCM / ChaCha20 encrypt & decrypt of payloads |
| `CompressionPlugin` | Gzip / Brotli compress & decompress of payloads |
| `LoggerPlugin` | Structured JSON request/response logging |
| `ReplayProtectionPlugin` | Nonce-based replay attack prevention (TTL cache) |
| `SignaturePlugin` | HMAC-SHA256 envelope signing & verification |
| `AuthenticationPlugin` | Custom auth header / bearer token validation |
| `RateLimitPlugin` | Per-client IP request rate limiting |
| `MetricsPlugin` | Request duration and throughput metrics collection |
| `TracingPlugin` | Request tracing via `x-request-id` / `x-trace-id` headers |

---

## Usage

### With Express Gateway

```typescript
import { createTunnelGateway } from '@secure-tunnel/express';
import {
  EncryptionPlugin,
  CompressionPlugin,
  LoggerPlugin,
  ReplayProtectionPlugin,
  SignaturePlugin,
  RateLimitPlugin,
} from '@secure-tunnel/plugins';

app.use(
  createTunnelGateway({
    endpoint: '/api/gateway',
    secretKey: process.env.TUNNEL_SECRET_KEY!,
    signatureKey: process.env.TUNNEL_SIGN_KEY!,
    plugins: [
      new LoggerPlugin(),
      new SignaturePlugin(),
      new ReplayProtectionPlugin({ ttlMs: 5 * 60 * 1000 }),
      new RateLimitPlugin({ maxRequests: 100, windowMs: 60_000 }),
      new EncryptionPlugin(),
      new CompressionPlugin({ algorithm: 'gzip' }),
    ],
  })
);
```

### With the Client SDK

```typescript
import { createTunnel } from '@secure-tunnel/client';
import { EncryptionPlugin, CompressionPlugin, SignaturePlugin } from '@secure-tunnel/plugins';

const client = createTunnel({
  endpoint: 'http://localhost:3000/api/gateway',
  secretKey: process.env.TUNNEL_SECRET_KEY!,
  signatureKey: process.env.TUNNEL_SIGN_KEY!,
  plugins: [
    new SignaturePlugin(),
    new EncryptionPlugin(),
    new CompressionPlugin({ algorithm: 'gzip' }),
  ],
});
```

---

## Plugin Pipeline Order

Plugins are executed in registration order on outgoing paths and **reverse order** on incoming paths, ensuring a symmetric wrap/unwrap cycle:

```
CLIENT SEND:
  [LoggerPlugin] → [SignaturePlugin] → [EncryptionPlugin] → [CompressionPlugin]

SERVER RECEIVE:
  [CompressionPlugin] → [EncryptionPlugin] → [SignaturePlugin] → [LoggerPlugin]
```

---

## Writing Custom Plugins

Any class implementing `TunnelPlugin` can be registered:

```typescript
import { TunnelPlugin, TunnelRequest, TunnelPluginContext } from '@secure-tunnel/core';

export class DeviceFingerprintPlugin implements TunnelPlugin {
  public readonly name = 'device-fingerprint';

  async beforeForward(request: TunnelRequest, context: TunnelPluginContext): Promise<void> {
    const deviceId = request.headers['x-device-id'];
    if (!deviceId) throw new Error('Missing device fingerprint');
    context.state.deviceId = deviceId;
  }
}
```

---

## License

MIT © Secure Tunnel Contributors
