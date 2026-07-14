# @secure-tunnel/crypto

> AES-256-GCM and ChaCha20-Poly1305 encryption, HMAC-SHA256 request signing, and replay-attack nonce caching for Secure Tunnel.

[![npm version](https://img.shields.io/npm/v/@secure-tunnel/crypto.svg)](https://www.npmjs.com/package/@secure-tunnel/crypto)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

---

## Overview

`@secure-tunnel/crypto` provides all cryptographic primitives used by the Secure Tunnel gateway and client SDK. It supports multiple encryption algorithms, HMAC-based request signing, and an in-memory nonce store for replay attack prevention.

---

## Installation

```bash
npm install @secure-tunnel/crypto
```

---

## What's Included

### Encryption (`src/aes.ts`, `src/chacha.ts`)

| Function | Algorithm | Description |
|----------|-----------|-------------|
| `encryptAES(payload, key)` | AES-256-GCM | Encrypts a string and returns `iv:tag:ciphertext` |
| `decryptAES(payload, key)` | AES-256-GCM | Decrypts and authenticates a `iv:tag:ciphertext` string |
| `encryptChaCha(payload, key)` | ChaCha20-Poly1305 | Encrypts using stream cipher |
| `decryptChaCha(payload, key)` | ChaCha20-Poly1305 | Decrypts using stream cipher |

### Signing (`src/signature.ts`)

| Function | Description |
|----------|-------------|
| `signEnvelope(payload, timestamp, nonce, requestId, key)` | Returns HMAC-SHA256 signature over canonical string |
| `verifyEnvelope(signature, payload, timestamp, nonce, requestId, key)` | Returns `boolean` — throws `AuthenticationError` on mismatch |

### Nonce Cache (`src/nonce-cache.ts`)

| Class | Description |
|-------|-------------|
| `NonceCache` | In-memory TTL-based nonce deduplication store |
| `NonceCache.has(nonce)` | Returns `true` if nonce was seen recently |
| `NonceCache.set(nonce)` | Stores a nonce with a configurable TTL (default: 5 minutes) |

---

## Usage

```typescript
import { encryptAES, decryptAES, signEnvelope, verifyEnvelope, NonceCache } from '@secure-tunnel/crypto';

const SECRET_KEY = 'my-super-secret-key-32-chars-long-12';

// Encrypt a payload
const encrypted = encryptAES('{"userId": 42}', SECRET_KEY);
console.log(encrypted); // e.g. "abc123:def456:xyz789==" (iv:tag:cipher in base64)

// Decrypt it back
const decrypted = decryptAES(encrypted, SECRET_KEY);
console.log(decrypted); // '{"userId": 42}'

// Sign a request envelope
const signature = signEnvelope(encrypted, Date.now(), 'nonce-abc', 'req-001', SECRET_KEY);

// Verify it on the server
const isValid = verifyEnvelope(signature, encrypted, Date.now(), 'nonce-abc', 'req-001', SECRET_KEY);

// Nonce cache for replay protection
const cache = new NonceCache({ ttlMs: 5 * 60 * 1000 }); // 5 minutes
if (cache.has('nonce-abc')) {
  throw new Error('Replay attack detected!');
}
cache.set('nonce-abc');
```

---

## Security Notes

- Keys should be **at minimum 32 characters** long.
- AES-256-GCM generates a random 12-byte IV per encryption call — no IV is ever reused.
- The GCM authentication tag is verified during decryption; tampered ciphertexts throw immediately.
- Use `NonceCache` with a TTL matching your `timestamp` validity window (`replayWindowMs`).
- **Never** commit your secret keys — use environment variables in production.

---

## License

MIT © Secure Tunnel Contributors
