import { describe, it, expect, beforeAll } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createTunnelGateway } from '../packages/express/src';
import { createTunnel } from '../packages/client/src';
import { TunnelEnvelope } from '@secure-tunnel/core';

describe('Gateway and Client Integration', () => {
  let app: Express;
  const secretKey = 'my-super-secret-key-32-chars-long-123456';
  const signatureKey = 'sig-key-12345';
  
  // Set up express app with gateway
  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Register Secure Tunnel Gateway Middleware
    app.use(
      createTunnelGateway({
        endpoint: '/api/gateway',
        secretKey,
        signatureKey,
        encryption: true,
        signing: true,
        compression: true,
      }),
    );

    // Mock API Routes (Internal routes)
    app.get('/api/products', (req, res) => {
      res.json([{ id: 1, name: 'Laptop' }]);
    });

    app.post('/api/login', (req, res) => {
      const { username, password } = req.body;
      if (username === 'admin' && password === 'admin') {
        res.status(200).json({ token: 'jwt-token-xyz' });
      } else {
        res.status(401).json({ message: 'Invalid credentials' });
      }
    });

    app.get('/api/error', (req, res) => {
      throw new Error('Something went wrong!');
    });
  });

  it('should route normal non-tunnel requests correctly', async () => {
    const response = await request(app)
      .get('/api/products')
      .expect(200);

    expect(response.body).toEqual([{ id: 1, name: 'Laptop' }]);
  });

  it('should intercept gateway requests, decrypt, reconstruct, route, and encrypt response back', async () => {
    const client = createTunnel({
      endpoint: '/api/gateway',
      secretKey,
      signatureKey,
      encryption: true,
      signing: true,
      compression: true,
    });

    // We can test request prep & unwrap directly
    const { envelope, context } = await client.prepareEnvelope(
      'POST',
      '/api/login',
      { username: 'admin', password: 'admin' },
      { 'x-custom-client-header': 'client-val' },
    );

    // Hit the gateway via Supertest
    const response = await request(app)
      .post('/api/gateway')
      .send(envelope)
      .expect(200);

    const resEnvelope: TunnelEnvelope = response.body;
    expect(resEnvelope.payload).toBeDefined();
    expect(resEnvelope.encrypted).toBe(true);

    const decrypted = await client.unwrapEnvelope(resEnvelope, context);
    expect(decrypted.token).toBe('jwt-token-xyz');
  });

  it('should forward status codes (401 Unauthorized) correctly', async () => {
    const client = createTunnel({
      endpoint: '/api/gateway',
      secretKey,
      signatureKey,
      encryption: true,
      signing: true,
      compression: true,
    });

    const { envelope, context } = await client.prepareEnvelope(
      'POST',
      '/api/login',
      { username: 'admin', password: 'wrong' },
    );

    const response = await request(app)
      .post('/api/gateway')
      .send(envelope)
      .expect(401);

    const resEnvelope: TunnelEnvelope = response.body;
    const decrypted = await client.unwrapEnvelope(resEnvelope, context);
    expect(decrypted.message).toBe('Invalid credentials');
  });

  it('should handle unhandled internal server errors and return encrypted 500 error envelope', async () => {
    const client = createTunnel({
      endpoint: '/api/gateway',
      secretKey,
      signatureKey,
      encryption: true,
      signing: true,
      compression: true,
    });

    const { envelope, context } = await client.prepareEnvelope('GET', '/api/error');

    const response = await request(app)
      .post('/api/gateway')
      .send(envelope)
      .expect(500);

    const resEnvelope: TunnelEnvelope = response.body;
    
    // Unwrap must throw an error containing the decrypted error message
    await expect(client.unwrapEnvelope(resEnvelope, context)).rejects.toThrow('Something went wrong!');
  });

  it('should handle unhandled routes and return encrypted 404 error envelope', async () => {
    const client = createTunnel({
      endpoint: '/api/gateway',
      secretKey,
      signatureKey,
      encryption: true,
      signing: true,
      compression: true,
    });

    const { envelope, context } = await client.prepareEnvelope('GET', '/api/non-existent');

    const response = await request(app)
      .post('/api/gateway')
      .send(envelope)
      .expect(404);

    const resEnvelope: TunnelEnvelope = response.body;
    await expect(client.unwrapEnvelope(resEnvelope, context)).rejects.toThrow('Route GET /api/non-existent not found');
  });
});
