# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-07-13

### Added
- Initial release of Secure Tunnel (`TunnelJS`) monorepo workspace.
- Symmetric cryptographic encryption and decryption providers (`AES-256-GCM`, `ChaCha20-Poly1305`).
- HMAC-SHA256 request signing and verification mechanism.
- Nonce and timestamp validation for Replay Attack Protection.
- Memory and generic Redis-compatible Cache providers.
- Gzip and Brotli compression and decompression engines.
- Unified JSON logging engine.
- Complete Gateway lifecycle hook engine supporting customizable plugin execution.
- Standard plugin package implementations (`Tracing`, `Metrics`, `Logger`, `Encryption`, `Compression`, `ReplayProtection`, `RateLimiter`, `Authentication`).
- Fetch-based Client SDK, custom Axios adapter interceptors, and React provider integrations.
- Complete example projects demonstrating usage patterns in Express, React, Next.js, and Electron.
- Full Vitest testing coverage and linting configurations.
