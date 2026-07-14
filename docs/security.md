# Security Guide & Threat Model

Secure Tunnel is designed to provide application-layer request encapsulation, signing, encryption, and replay protection. However, it must be integrated with careful consideration of standard security principles.

---

## 1. HTTPS is Mandatory

Secure Tunnel **does not replace HTTPS**. It is built under the assumption that all traffic travels over an encrypted TLS connection.

### Risks of running over HTTP:
- **Traffic Analysis**: Attackers can analyze the frequency, timing, and size of packages to infer API methods (e.g. login payloads vs. page loads).
- **IP / Destination Disclosing**: While the URL path is rewritten to `/api/gateway`, the IP address and hostname are still fully visible in plaintext.
- **MITM Routing Tampering**: Without TLS, routing packets can be intercepted, redirected, or dropped.

---

## 2. Key Management in Frontend Clients

Symmetric encryption (`AES-256-GCM` or `ChaCha20-Poly1305`) requires both the server and client to share a key.

### Browser Environments (React, Next.js client-side)
Storing a static symmetric key in Javascript variables, LocalStorage, or cookies exposes the key to **Cross-Site Scripting (XSS)** attacks. If an attacker injects malicious code, they can extract the key and decrypt all tunnel traffic.

#### Best Practices:
1. **Dynamic Session Keys**: Upon login, derive a session key unique to that user session. Store it in transient memory (non-persistent JS variables) rather than LocalStorage.
2. **Key Encapsulation**: Use public-key cryptography (e.g. Diffie-Hellman or RSA wrapping) to establish unique symmetric session keys during a handshake phase.
3. **No Key Storage**: If client-side encryption is not strictly required for your threat model, you can configure the client and gateway with `encryption: false` and rely on HTTPS for transport security, keeping `signing: true` to prevent API tampering.

---

## 3. Replay Attacks Protection

Replay protection works by validating timestamps and nonces:

1. **Timestamp Age Check**: The gateway checks if the request was sent within a tolerability window (e.g. 5 minutes). If the request is too old, it is rejected. This prevents an attacker from capturing a signed request and running it hours later.
2. **Nonce Cache Check**: Nonces are stored in a database/cache with a TTL matching the tolerability window. If a nonce matches an existing record, the request is flagged as a replay attack.

#### Best Practices:
- In production cluster environments (multiple server instances), always use **`RedisCacheProvider`** so that nonces are shared and checked across all instances. Using memory cache in a cluster allows nonces to be successfully replayed against different instances!

---

## 4. Authorization & CSRF Protection

Secure Tunnel works transparently on top of Express. All standard server authorization (JWT vetting, roles checks) runs exactly the same.

- **JWT Validation**: Run standard JWT checks. We recommend passing JWTs inside the tunneled headers (`Authorization: Bearer <token>`).
- **CSRF Tokens**: To prevent CSRF attacks, frontend clients should include CSRF validation headers in every request. Because requests are packaged as JSON POSTs to `/api/gateway`, standard browser forms cannot submit them automatically. This naturally mitigates simple CSRF forms, but explicit token validation is still recommended.
