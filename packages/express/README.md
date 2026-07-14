# @secure-tunnel/express

> Express.js middleware gateway for Secure Tunnel — transparently decrypts, verifies, and routes tunnel envelopes to your existing Express routes.

[![npm version](https://img.shields.io/npm/v/@secure-tunnel/express.svg)](https://www.npmjs.com/package/@secure-tunnel/express)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

---

## Overview

`@secure-tunnel/express` integrates the Secure Tunnel gateway as a single Express middleware. It intercepts all `POST /api/gateway` requests, decrypts and verifies the `TunnelEnvelope`, reconstructs the original HTTP request, forwards it internally through your existing Express router, and encrypts the response before sending it back to the client.

**Your existing routes don't change at all.** The gateway is fully transparent.

---

## Installation

```bash
npm install @secure-tunnel/express @secure-tunnel/core @secure-tunnel/plugins
```

---

## Quick Start

```typescript
import express from 'express';
import { createTunnelGateway } from '@secure-tunnel/express';

const app = express();
app.use(express.json());

// Mount the Gateway — must be before your route definitions
app.use(
  createTunnelGateway({
    endpoint: '/api/gateway',         // Single gateway endpoint clients call
    secretKey: process.env.TUNNEL_SECRET!,
    signatureKey: process.env.TUNNEL_SIGN_KEY!,
    encryption: true,
    signing: true,
    compression: true,
    replayProtection: true,
  })
);

// Your routes stay exactly the same!
app.get('/api/products', (req, res) => {
  res.json({ products: [{ id: 1, name: 'Widget' }] });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  res.json({ token: 'jwt-token-here' });
});

app.listen(3000, () => console.log('Listening on port 3000'));
```

---

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoint` | `string` | `'/api/gateway'` | The single gateway endpoint path |
| `secretKey` | `string` | **Required** | AES encryption key (32+ chars) |
| `signatureKey` | `string` | **Required** | HMAC signing key (32+ chars) |
| `encryption` | `boolean` | `true` | Enable AES-256-GCM payload encryption |
| `signing` | `boolean` | `true` | Enable HMAC-SHA256 request signing |
| `compression` | `boolean` | `false` | Enable Gzip compression |
| `compressionType` | `'gzip' \| 'brotli'` | `'gzip'` | Compression algorithm |
| `replayProtection` | `boolean` | `true` | Reject replayed nonces |
| `replayWindowMs` | `number` | `300000` | Replay protection TTL in milliseconds |
| `plugins` | `TunnelPlugin[]` | `[]` | Additional custom plugins |

---

## How It Works

```
Client → POST /api/gateway (TunnelEnvelope)
           │
           ▼
    [Gateway Middleware]
    1. Verify HMAC Signature
    2. Check Replay Nonce Cache
    3. Decompress payload (if compressed)
    4. Decrypt payload (AES-256-GCM)
    5. Reconstruct Express Request object
    6. Forward internally to Express router
           │
           ▼
    [Your Route Handler]
    app.get('/api/products', handler)
           │
           ▼
    [Gateway Response Interceptor]
    1. Capture route response
    2. Encrypt response body
    3. Compress (if enabled)
    4. Return as TunnelEnvelope
           │
           ▼
Client ← POST /api/gateway (Encrypted TunnelEnvelope)
```

---

## Error Handling

All gateway errors are wrapped in an encrypted error `TunnelEnvelope` so the client receives them securely. The HTTP status code from the internal route is preserved.

```json
{
  "payload": "<encrypted>",
  "encrypted": true,
  "timestamp": 1720883200000,
  "nonce": "abc123",
  "requestId": "req-xyz"
}
```

After decryption on the client, the error body will be:

```json
{
  "error": {
    "message": "User not found",
    "code": "NOT_FOUND",
    "statusCode": 404
  }
}
```

---

## Environment Variables (Recommended)

```bash
TUNNEL_SECRET_KEY=my-super-secret-key-32-chars-long-123
TUNNEL_SIGN_KEY=my-signing-hmac-key-32-chars-long-123
```

---

## License

MIT © Secure Tunnel Contributors
