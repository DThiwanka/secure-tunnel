import crypto from 'crypto';
import {
  TunnelPlugin,
  TunnelEnvelope,
  TunnelRequest,
  TunnelPluginContext,
} from '@secure-tunnel/core';

export class TracingPlugin implements TunnelPlugin {
  public readonly name = 'tracing';

  public async beforeDecrypt(
    envelope: TunnelEnvelope,
    context: TunnelPluginContext,
  ): Promise<void> {
    const requestId = envelope.requestId || crypto.randomUUID();
    envelope.requestId = requestId;
    context.state.requestId = requestId;

    const rawRes = context.rawResponse as { setHeader?: (name: string, value: string) => void } | undefined;
    if (rawRes && typeof rawRes.setHeader === 'function') {
      rawRes.setHeader('x-request-id', requestId);
    }
  }

  public async afterDecrypt(request: TunnelRequest, context: TunnelPluginContext): Promise<void> {
    const requestId = (context.state.requestId as string) || crypto.randomUUID();
    request.requestId = requestId;
    if (request && request.headers) {
      request.headers['x-request-id'] = requestId;
    }
  }
}
