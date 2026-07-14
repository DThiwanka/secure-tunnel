/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { createTunnel } from '@secure-tunnel/client';

// Symmetric keys matching gateway config
const secretKey = 'my-super-secret-key-32-chars-long-123456';
const signatureKey = 'sig-key-12345';

// 1. Next.js Server-Side Setup (runs on server during SSR)
export async function getServerSideProps() {
  const serverTunnel = createTunnel({
    // Direct internal URL of Express backend server
    endpoint: 'http://localhost:3000/api/gateway', 
    secretKey,
    signatureKey,
    encryption: true,
    signing: true,
    compression: true,
    // Add default authentication header
    defaultHeaders: {
      'authorization': 'Bearer mock-jwt-admin',
    },
  });

  try {
    // Fetch products on server side securely
    const products = await serverTunnel.get('/api/products');
    return {
      props: {
        initialProducts: products,
      },
    };
  } catch (err: any) {
    return {
      props: {
        initialProducts: [],
        error: `Server-side fetch failed: ${err.message}`,
      },
    };
  }
}

// 2. Frontend client setup (runs in browser)
const clientTunnel = createTunnel({
  endpoint: '/api/gateway', // Relies on proxy or direct relative routing
  secretKey,
  signatureKey,
});

interface NextDemoProps {
  initialProducts: any[];
  error?: string;
}

export default function NextDemo({ initialProducts, error }: NextDemoProps) {
  const [products, setProducts] = useState(initialProducts);
  const [clientFetchStatus, setClientFetchStatus] = useState('');

  const handleClientRefresh = async () => {
    try {
      setClientFetchStatus('Refreshing from browser...');
      // Set token header
      clientTunnel['defaultHeaders'] = {
        'authorization': 'Bearer mock-jwt-admin',
      };
      const updatedList = await clientTunnel.get('/api/products');
      setProducts(updatedList);
      setClientFetchStatus('Refreshed successfully!');
    } catch (err: any) {
      setClientFetchStatus(`Client-side refresh failed: ${err.message}`);
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '30px' }}>
      <h1>Next.js Secure Tunnel Integration Page</h1>
      <p>This page demonstrates fetching data on the Server (SSR) and Client side securely using Secure Tunnel.</p>

      {error && <div style={{ color: 'red', margin: '10px 0' }}>{error}</div>}

      <h2>Products List (SSR Rendered initially)</h2>
      <ul>
        {products.map((p: any) => (
          <li key={p.id}>
            {p.name} - ${p.price}
          </li>
        ))}
      </ul>

      <button onClick={handleClientRefresh}>Refresh Client-Side via Gateway</button>
      {clientFetchStatus && <p>{clientFetchStatus}</p>}
    </div>
  );
}
