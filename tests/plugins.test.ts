import { describe, it, expect, vi } from 'vitest';
import {
  ReplayProtectionPlugin,
  RateLimitPlugin,
  AuthenticationPlugin,
  TracingPlugin,
  MetricsPlugin,
} from '../packages/plugins/src';
import { InMemoryCacheProvider } from '../packages/crypto/src';
import { TunnelEnvelope, TunnelRequest, TunnelPluginContext, GatewayError, ReplayAttackError } from '@secure-tunnel/core';

describe('Plugins Suite', () => {
  it('ReplayProtectionPlugin should reject expired timestamps and duplicate nonces', async () => {
    const cacheProvider = new InMemoryCacheProvider(100);
    const plugin = new ReplayProtectionPlugin({ cacheProvider, toleranceSeconds: 5 });

    const context: TunnelPluginContext = { state: {} };
    const validEnvelope: TunnelEnvelope = {
      payload: 'abc',
      timestamp: Date.now(),
      nonce: 'nonce-unique-1',
      requestId: 'req-1',
      encrypted: false,
      compressed: false,
    };

    // First request - should pass and store nonce
    await expect(plugin.beforeDecrypt(validEnvelope, context)).resolves.not.toThrow();

    // Second request with same nonce - should reject
    await expect(plugin.beforeDecrypt(validEnvelope, context)).rejects.toThrow(ReplayAttackError);

    // Expired timestamp request - should reject
    const expiredEnvelope: TunnelEnvelope = {
      payload: 'abc',
      timestamp: Date.now() - 10000, // 10s age (skew limit is 5s)
      nonce: 'nonce-unique-2',
      requestId: 'req-2',
      encrypted: false,
      compressed: false,
    };
    await expect(plugin.beforeDecrypt(expiredEnvelope, context)).rejects.toThrow(ReplayAttackError);

    cacheProvider.close();
  });

  it('RateLimitPlugin should reject requests exceeding limit', async () => {
    const cacheProvider = new InMemoryCacheProvider(100);
    const plugin = new RateLimitPlugin({
      cacheProvider,
      limit: 2,
      windowSeconds: 5,
      keyGenerator: () => 'client-x',
    });

    const envelope: TunnelEnvelope = {
      payload: 'abc',
      timestamp: Date.now(),
      nonce: 'nonce-1',
      requestId: 'req-1',
      encrypted: false,
      compressed: false,
    };
    const context: TunnelPluginContext = { state: {} };

    await expect(plugin.beforeDecrypt(envelope, context)).resolves.not.toThrow();
    await expect(plugin.beforeDecrypt(envelope, context)).resolves.not.toThrow();
    // 3rd request should fail
    await expect(plugin.beforeDecrypt(envelope, context)).rejects.toThrow(GatewayError);

    cacheProvider.close();
  });

  it('AuthenticationPlugin should invoke custom authenticator and reject unauthorized requests', async () => {
    const mockAuthSuccess = vi.fn().mockResolvedValue(true);
    const mockAuthFail = vi.fn().mockResolvedValue(false);

    const req: TunnelRequest = {
      method: 'GET',
      url: '/orders',
      headers: {},
      body: {},
      query: {},
      params: {},
      timestamp: Date.now(),
      nonce: 'n',
      requestId: 'r',
    };
    const context: TunnelPluginContext = { state: {} };

    const successPlugin = new AuthenticationPlugin({ authenticator: mockAuthSuccess });
    const failPlugin = new AuthenticationPlugin({ authenticator: mockAuthFail });

    await expect(successPlugin.beforeForward(req, context)).resolves.not.toThrow();
    expect(mockAuthSuccess).toHaveBeenCalledWith(req, context);

    await expect(failPlugin.beforeForward(req, context)).rejects.toThrow(GatewayError);
    expect(mockAuthFail).toHaveBeenCalledWith(req, context);
  });

  it('TracingPlugin should generate and propagate requestId', async () => {
    const plugin = new TracingPlugin();
    const context: TunnelPluginContext = { state: {} };
    const envelope: TunnelEnvelope = {
      payload: 'abc',
      timestamp: Date.now(),
      nonce: 'n',
      requestId: '', // Empty
      encrypted: false,
      compressed: false,
    };

    await plugin.beforeDecrypt(envelope, context);
    expect(envelope.requestId).not.toBe('');
    expect(context.state.requestId).toBe(envelope.requestId);

    const req: TunnelRequest = {
      method: 'GET',
      url: '/path',
      headers: {},
      body: {},
      query: {},
      params: {},
      timestamp: Date.now(),
      nonce: 'n',
      requestId: '',
    };
    await plugin.afterDecrypt(req, context);
    expect(req.requestId).toBe(envelope.requestId);
    expect(req.headers['x-request-id']).toBe(envelope.requestId);
  });

  it('MetricsPlugin should count success and calculate elapsed duration', async () => {
    const plugin = new MetricsPlugin();
    const context: TunnelPluginContext = { state: {} };
    const envelope: TunnelEnvelope = {
      payload: 'abc',
      timestamp: Date.now(),
      nonce: 'n',
      requestId: 'r',
      encrypted: false,
      compressed: false,
    };

    await plugin.beforeDecrypt(envelope, context);
    expect(plugin.getMetrics().requestCount).toBe(1);

    await plugin.afterForward({}, context);
    expect(plugin.getMetrics().successCount).toBe(1);
    expect(plugin.getMetrics().errorCount).toBe(0);

    await plugin.onError(new Error('fail'), context);
    expect(plugin.getMetrics().errorCount).toBe(1);
  });
});
