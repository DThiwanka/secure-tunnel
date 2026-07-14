# @secure-tunnel/client

> Frontend client SDK for Secure Tunnel — fetch wrapper, Axios interceptor, and React context hook for transparent encrypted API communication.

[![npm version](https://img.shields.io/npm/v/@secure-tunnel/client.svg)](https://www.npmjs.com/package/@secure-tunnel/client)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

---

## Overview

`@secure-tunnel/client` is the browser/Node.js client SDK for Secure Tunnel. It transparently packs outgoing API requests into encrypted `TunnelEnvelope` payloads, sends them to the single gateway endpoint, and decrypts responses — all without changing how you write your API calls.

It ships three integration layers:

| Module | Description |
|--------|-------------|
| **Fetch Client** (`client.ts`) | Built-in client with `.get()`, `.post()`, `.put()`, `.delete()` etc. |
| **Axios Adapter** (`axios-adapter.ts`) | Plug into an existing `axios` instance via interceptors |
| **React Context** (`react-context.tsx`) | `<TunnelProvider>` and `useTunnel()` hook for React apps |

---

## Installation

```bash
npm install @secure-tunnel/client @secure-tunnel/core @secure-tunnel/crypto @secure-tunnel/compression
```

---

## Usage

### 1. Fetch Client (Vanilla JS / Node.js)

```typescript
import { createTunnel } from '@secure-tunnel/client';

const client = createTunnel({
  endpoint: 'http://localhost:3000/api/gateway',
  secretKey: process.env.TUNNEL_SECRET!,
  signatureKey: process.env.TUNNEL_SIGN_KEY!,
  encryption: true,
  signing: true,
  compression: true,
});

// GET request
const products = await client.get<{ products: Product[] }>('/api/products');

// POST request
const { token } = await client.post<{ token: string }>('/api/login', {
  username: 'alice',
  password: 'secret',
});

// PUT request
await client.put('/api/orders/5', { status: 'shipped' });

// DELETE request
await client.delete('/api/users/2');
```

---

### 2. Axios Interceptor

Drop into an existing Axios instance without changing any call sites:

```typescript
import axios from 'axios';
import { createTunnel, applyAxiosInterceptor } from '@secure-tunnel/client';

const axiosInstance = axios.create({ baseURL: 'http://localhost:3000' });

const tunnelClient = createTunnel({
  endpoint: 'http://localhost:3000/api/gateway',
  secretKey: process.env.TUNNEL_SECRET!,
  signatureKey: process.env.TUNNEL_SIGN_KEY!,
  encryption: true,
  signing: true,
});

// Attach the interceptors — all calls through axiosInstance are now tunneled
applyAxiosInterceptor(axiosInstance, tunnelClient);

// This looks like a normal Axios call, but goes through /api/gateway encrypted!
const res = await axiosInstance.get('/api/products');
console.log(res.data);
```

---

### 3. React Context / Hook

Wrap your app in `<TunnelProvider>` and consume via `useTunnel()`:

```tsx
import React from 'react';
import { createTunnel, TunnelProvider, useTunnel } from '@secure-tunnel/client';

const tunnelClient = createTunnel({
  endpoint: 'http://localhost:3000/api/gateway',
  secretKey: import.meta.env.VITE_TUNNEL_SECRET,
  signatureKey: import.meta.env.VITE_TUNNEL_SIGN_KEY,
  encryption: true,
  signing: true,
});

// Wrap your app
export default function App() {
  return (
    <TunnelProvider client={tunnelClient}>
      <Dashboard />
    </TunnelProvider>
  );
}

// Use in any child component
function Dashboard() {
  const api = useTunnel();
  const [products, setProducts] = React.useState([]);

  React.useEffect(() => {
    api.get('/api/products').then(setProducts);
  }, []);

  return <ul>{products.map(p => <li key={p.id}>{p.name}</li>)}</ul>;
}
```

---

## Client Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoint` | `string` | **Required** | Full URL to `POST /api/gateway` on your server |
| `secretKey` | `string` | **Required** | Must match the server's `secretKey` exactly |
| `signatureKey` | `string` | **Required** | Must match the server's `signatureKey` exactly |
| `encryption` | `boolean` | `true` | Enable AES-256-GCM payload encryption |
| `signing` | `boolean` | `true` | Enable HMAC-SHA256 request signing |
| `compression` | `boolean` | `false` | Enable Gzip request body compression |
| `compressionType` | `'gzip' \| 'brotli'` | `'gzip'` | Compression algorithm |
| `timeout` | `number` | `30000` | Request timeout in milliseconds |
| `plugins` | `TunnelPlugin[]` | `[]` | Additional client-side plugins |

---

## TypeScript Support

All methods are fully generic:

```typescript
interface LoginResponse {
  token: string;
  expiresIn: number;
}

const result = await client.post<LoginResponse>('/api/login', { username: 'alice', password: 'x' });
// result.token and result.expiresIn are properly typed ✅
```

---

## License

MIT © Secure Tunnel Contributors
