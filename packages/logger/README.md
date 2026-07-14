# @secure-tunnel/logger

> Structured JSON logger with configurable levels and standard Secure Tunnel pipeline hooks.

[![npm version](https://img.shields.io/npm/v/@secure-tunnel/logger.svg)](https://www.npmjs.com/package/@secure-tunnel/logger)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

---

## Overview

`@secure-tunnel/logger` provides a lightweight structured JSON logger used throughout the Secure Tunnel gateway and client pipeline. It outputs machine-parseable log lines suitable for ingestion by log aggregators like **Datadog**, **Loki**, **CloudWatch**, and **Elasticsearch**.

---

## Installation

```bash
npm install @secure-tunnel/logger
```

---

## What's Included

### Logger Class

| Method | Level | Description |
|--------|-------|-------------|
| `logger.info(message, meta?)` | INFO | General informational logs |
| `logger.warn(message, meta?)` | WARN | Non-critical warnings |
| `logger.error(message, meta?)` | ERROR | Error events with optional stack traces |
| `logger.debug(message, meta?)` | DEBUG | Verbose debugging output (disabled in production) |

---

## Usage

```typescript
import { createLogger } from '@secure-tunnel/logger';

const logger = createLogger({
  service: 'MyGateway',
  level: 'info', // 'debug' | 'info' | 'warn' | 'error'
});

logger.info('Gateway started', { port: 3000 });
logger.warn('High memory usage detected', { usedMb: 512 });
logger.error('Decryption failed', { requestId: 'req-abc-123', error: 'Invalid GCM tag' });
```

### Example Output

Each log line is a structured JSON object written to `stdout` (errors to `stderr`):

```json
{
  "timestamp": "2026-07-13T17:00:00.000Z",
  "service": "MyGateway",
  "level": "INFO",
  "message": "Gateway started",
  "port": 3000
}
```

---

## Integration with Secure Tunnel Pipeline

The `LoggerPlugin` in `@secure-tunnel/plugins` wraps this logger and attaches it to the plugin registry automatically. You don't need to configure the logger manually if you use the plugin — it handles request lifecycle logging out of the box:

```typescript
import { createTunnelGateway } from '@secure-tunnel/express';
import { LoggerPlugin } from '@secure-tunnel/plugins';

app.use(
  createTunnelGateway({
    // ...
    plugins: [new LoggerPlugin()],
  })
);
```

---

## Log Levels Reference

| Level | `stdout` / `stderr` | When |
|-------|---------------------|------|
| `debug` | stdout | Verbose detail for development |
| `info` | stdout | Normal request/response lifecycle |
| `warn` | stdout | Recoverable anomalies |
| `error` | stderr | Pipeline failures, exceptions |

---

## License

MIT © Secure Tunnel Contributors
