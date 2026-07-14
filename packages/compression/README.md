# @secure-tunnel/compression

> Gzip and Brotli compression/decompression wrappers for Secure Tunnel payload optimization.

[![npm version](https://img.shields.io/npm/v/@secure-tunnel/compression.svg)](https://www.npmjs.com/package/@secure-tunnel/compression)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

---

## Overview

`@secure-tunnel/compression` provides lightweight async wrappers around Node.js's built-in `zlib` module for Gzip and Brotli compression. It is used by the Secure Tunnel pipeline to reduce payload size before encryption, improving bandwidth efficiency.

---

## Installation

```bash
npm install @secure-tunnel/compression
```

> **Note:** This package relies on Node.js built-in `zlib` — no additional native dependencies are required.

---

## What's Included

### Gzip (`src/gzip.ts`)

| Function | Description |
|----------|-------------|
| `gzipCompress(data: string): Promise<Buffer>` | Compresses a UTF-8 string into a Gzip `Buffer` |
| `gzipDecompress(data: Buffer): Promise<string>` | Decompresses a Gzip `Buffer` back to a UTF-8 string |

### Brotli (`src/brotli.ts`)

| Function | Description |
|----------|-------------|
| `brotliCompress(data: string): Promise<Buffer>` | Compresses a UTF-8 string using Brotli algorithm |
| `brotliDecompress(data: Buffer): Promise<string>` | Decompresses a Brotli `Buffer` back to a UTF-8 string |

---

## Usage

```typescript
import { gzipCompress, gzipDecompress, brotliCompress, brotliDecompress } from '@secure-tunnel/compression';

const payload = JSON.stringify({ users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] });

// --- Gzip ---
const compressed = await gzipCompress(payload);
console.log('Compressed size:', compressed.byteLength, 'bytes');

const decompressed = await gzipDecompress(compressed);
console.log('Restored:', decompressed); // Original JSON string

// --- Brotli (better ratio, slightly slower) ---
const brotliCompressed = await brotliCompress(payload);
const brotliRestored = await brotliDecompress(brotliCompressed);
console.log('Brotli round-trip OK:', brotliRestored === payload);
```

---

## When to Use Each Algorithm

| Algorithm | Best For | Notes |
|-----------|----------|-------|
| **Gzip** | General API payloads, JSON bodies | Excellent support everywhere, fast |
| **Brotli** | Large structured payloads, static data | Better compression ratio, requires Node.js ≥ 10.16 |

The `CompressionPlugin` in `@secure-tunnel/plugins` selects the algorithm automatically based on your `TunnelConfig.compressionType` setting.

---

## License

MIT © Secure Tunnel Contributors
