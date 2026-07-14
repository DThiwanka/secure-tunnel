# @secure-tunnel/core

> Core types, error models, and plugin registry engine for the Secure Tunnel monorepo.

[![npm version](https://img.shields.io/npm/v/@secure-tunnel/core.svg)](https://www.npmjs.com/package/@secure-tunnel/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

---

## Overview

`@secure-tunnel/core` is the foundational package of the Secure Tunnel ecosystem. It defines all shared TypeScript contracts, error classes, and the plugin registry engine that powers the client and server pipelines.

All other `@secure-tunnel/*` packages depend on this package.

---

## Installation

```bash
npm install @secure-tunnel/core
```

---

## What's Included

### Types (`src/types.ts`)

| Type | Description |
|------|-------------|
| `TunnelEnvelope` | The encrypted packet sent over the wire via `POST /api/gateway` |
| `TunnelRequest` | The decrypted internal request forwarded to Express routes |
| `TunnelConfig` | Configuration object for both client and server |
| `TunnelPlugin` | Interface all plugins must implement |
| `TunnelPluginContext` | Mutable state object passed through the pipeline per-request |

### Error Classes (`src/errors.ts`)

| Class | HTTP Code | Description |
|-------|-----------|-------------|
| `GatewayError` | 500 | Base class for all tunnel errors |
| `ValidationError` | 400 | Malformed envelope or missing fields |
| `AuthenticationError` | 401 | Invalid signature or authentication failure |
| `ReplayError` | 429 | Replayed nonce/request detected |
| `RateLimitError` | 429 | Rate limit exceeded for a client |

### Plugin Registry (`src/plugin-registry.ts`)

The registry manages plugin lifecycle hooks and runs them in the correct order across the pipeline:

| Hook | Runs When |
|------|-----------|
| `beforeEncrypt` | Client — before encrypting outgoing payload |
| `afterEncrypt` | Client — after encrypting outgoing payload |
| `beforeDecrypt` | Server/Client — before decrypting incoming envelope |
| `afterDecrypt` | Server/Client — after decrypting incoming envelope |
| `beforeForward` | Server — before forwarding decrypted request to Express routes |
| `afterForward` | Server — after Express route has responded |
| `onError` | Both — when any error occurs in the pipeline |

---

## Usage

```typescript
import {
  TunnelEnvelope,
  TunnelRequest,
  TunnelPlugin,
  TunnelPluginContext,
  GatewayError,
  ValidationError,
  PluginRegistry,
} from '@secure-tunnel/core';

// Implementing a minimal plugin
class MyPlugin implements TunnelPlugin {
  public readonly name = 'my-plugin';

  async beforeForward(request: TunnelRequest, context: TunnelPluginContext): Promise<void> {
    console.log('Forwarding request to:', request.url);
  }

  async onError(error: Error, context: TunnelPluginContext): Promise<void> {
    console.error('Pipeline error:', error.message);
  }
}

// Using the registry
const registry = new PluginRegistry();
registry.register(new MyPlugin());
```

---

## License

MIT © Secure Tunnel Contributors
