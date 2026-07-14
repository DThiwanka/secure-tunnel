/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { createTunnel, TunnelProvider, useTunnel } from '@secure-tunnel/client';

// Configure the Secure Tunnel client with shared keys
const tunnelClient = createTunnel({
  endpoint: 'http://localhost:3000/api/gateway',
  secretKey: 'my-super-secret-key-32-chars-long-123456',
  signatureKey: 'sig-key-12345',
  encryption: true,
  signing: true,
  compression: true,
});

export function Main() {
  return (
    <TunnelProvider client={tunnelClient}>
      <SecureApp />
    </TunnelProvider>
  );
}

function SecureApp() {
  const tunnel = useTunnel();
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [downloadedContent, setDownloadedContent] = useState('');

  // 1. Handle Login
  const handleLogin = async () => {
    try {
      const data = await tunnel.post('/api/login', {
        username: 'admin',
        password: 'admin123',
      });
      setToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      // Set token header on the client dynamically
      tunnelClient['defaultHeaders'] = {
        'authorization': `Bearer ${data.accessToken}`,
      };
      alert('Login successful! Secure Tunnel established.');
    } catch (err: any) {
      alert(`Login failed: ${err.message}`);
    }
  };

  // 2. Refresh Token
  const handleTokenRefresh = async () => {
    if (!refreshToken) return;
    try {
      const data = await tunnel.post('/api/token/refresh', { refreshToken });
      setToken(data.accessToken);
      tunnelClient['defaultHeaders'] = {
        'authorization': `Bearer ${data.accessToken}`,
      };
      alert('Access token refreshed through the tunnel!');
    } catch (err: any) {
      alert(`Token refresh failed: ${err.message}`);
    }
  };

  // 3. Load Products (CRUD Read)
  const loadProducts = async () => {
    try {
      const list = await tunnel.get('/api/products');
      setProducts(list);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (token) {
      loadProducts();
    }
  }, [token]);

  // 4. Create Product (CRUD Create)
  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName || !newProductPrice) return;
    try {
      await tunnel.post('/api/products', {
        name: newProductName,
        price: parseFloat(newProductPrice),
      });
      setNewProductName('');
      setNewProductPrice('');
      loadProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 5. Delete Product (CRUD Delete)
  const deleteProduct = async (id: number) => {
    try {
      await tunnel.delete(`/api/products/${id}`);
      loadProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 6. Secure Base64 File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Str = (reader.result as string).split(',')[1];
      try {
        const res = await tunnel.post('/api/upload', {
          fileName: file.name,
          fileContentBase64: base64Str,
        });
        setUploadMessage(res.message + ` (${res.sizeBytes} bytes)`);
      } catch (err: any) {
        setUploadMessage(`Upload failed: ${err.message}`);
      }
    };
    reader.readAsDataURL(file);
  };

  // 7. Secure File Download & Decryption
  const handleFileDownload = async () => {
    try {
      const res = await tunnel.get('/api/download');
      // Decode content from base64
      const decodedText = atob(res.fileContentBase64);
      setDownloadedContent(`Downloaded file: ${res.fileName}\nContent: "${decodedText}"`);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
      <h1>Secure Tunnel Demo React Application</h1>

      {!token ? (
        <div>
          <h3>Status: Not Authenticated</h3>
          <button onClick={handleLogin}>Authenticate & Establish Tunnel</button>
        </div>
      ) : (
        <div>
          <h3>Status: Secure Tunnel Authenticated</h3>
          <button onClick={handleTokenRefresh}>Refresh Access Token</button>

          <hr />

          {/* CRUD Demo */}
          <h2>CRUD Products Listing (Fetched via Tunnel)</h2>
          <form onSubmit={addProduct} style={{ marginBottom: '15px' }}>
            <input
              type="text"
              placeholder="Product Name"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              required
            />
            <input
              type="number"
              placeholder="Price"
              value={newProductPrice}
              onChange={(e) => setNewProductPrice(e.target.value)}
              required
            />
            <button type="submit">Create Product</button>
          </form>

          <ul>
            {products.map((p) => (
              <li key={p.id}>
                {p.name} - ${p.price}{' '}
                <button onClick={() => deleteProduct(p.id)}>Delete</button>
              </li>
            ))}
          </ul>

          <hr />

          {/* Upload Demo */}
          <h2>File Upload (Encrypted in transit via JSON Tunnel)</h2>
          <input type="file" onChange={handleFileUpload} />
          {uploadMessage && <p style={{ color: 'green' }}>{uploadMessage}</p>}

          <hr />

          {/* Download Demo */}
          <h2>File Download</h2>
          <button onClick={handleFileDownload}>Download Secret intelligence.txt</button>
          {downloadedContent && (
            <pre style={{ background: '#f0f0f0', padding: '10px', marginTop: '10px' }}>
              {downloadedContent}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
