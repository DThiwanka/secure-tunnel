import express, { Request, Response, NextFunction } from 'express';
import { createTunnelGateway } from '@secure-tunnel/express';

const app = express();
const PORT = 3000;

// Shared keys (symmetric)
const secretKey = 'my-super-secret-key-32-chars-long-123456';
const signatureKey = 'sig-key-12345';

// Gateway configuration
app.use(express.json({ limit: '10mb' })); // Support larger base64 file payloads
app.use(
  createTunnelGateway({
    endpoint: '/api/gateway',
    secretKey,
    signatureKey,
    encryption: true,
    signing: true,
    compression: true,
    replayProtection: true,
  }),
);

// In-memory Database Mock
interface Product {
  id: number;
  name: string;
  price: number;
}
const productsDb: Product[] = [
  { id: 1, name: 'Secure Tunnel Adapter', price: 99 },
  { id: 2, name: 'Cryptography Accelerator', price: 199 },
];

const usersDb = {
  admin: 'admin123',
};

// Mock Refresh Token database
const refreshTokens: string[] = [];

// JWT Mock Verification Middleware
interface AuthenticatedRequest extends Request {
  user?: { username: string };
}

function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token is required' });
  }

  // Basic mock check: token should start with "mock-jwt-"
  if (!token.startsWith('mock-jwt-')) {
    return res.status(403).json({ error: 'Invalid access token' });
  }

  const username = token.replace('mock-jwt-', '');
  req.user = { username };
  next();
}

// 1. Authentication (Login) Route
app.post('/api/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (usersDb[username as keyof typeof usersDb] === password) {
    const accessToken = `mock-jwt-${username}`;
    const refreshToken = `mock-refresh-${username}-${Math.random().toString(36).substring(2)}`;
    refreshTokens.push(refreshToken);

    res.json({
      accessToken,
      refreshToken,
      expiresIn: 3600,
    });
  } else {
    res.status(400).json({ error: 'Invalid username or password' });
  }
});

// Refresh Token Route
app.post('/api/token/refresh', (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken || !refreshTokens.includes(refreshToken)) {
    return res.status(403).json({ error: 'Invalid refresh token' });
  }

  // Generate new access token
  const username = refreshToken.split('-')[2];
  const newAccessToken = `mock-jwt-${username}`;

  res.json({
    accessToken: newAccessToken,
  });
});

// 2. CRUD Routes (Protected)
app.get('/api/products', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  res.json(productsDb);
});

app.get('/api/products/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const product = productsDb.find((p) => p.id === id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

app.post('/api/products', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { name, price } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'Name and price are required' });
  }
  const newProduct: Product = {
    id: productsDb.length + 1,
    name,
    price,
  };
  productsDb.push(newProduct);
  res.status(201).json(newProduct);
});

app.delete('/api/products/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const index = productsDb.findIndex((p) => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }
  productsDb.splice(index, 1);
  res.status(200).json({ message: 'Product deleted successfully' });
});

// 3. File Upload Route (Protected)
app.post('/api/upload', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { fileName, fileContentBase64 } = req.body;

  if (!fileName || !fileContentBase64) {
    return res.status(400).json({ error: 'fileName and fileContentBase64 are required' });
  }

  const buffer = Buffer.from(fileContentBase64, 'base64');
  console.log(`[Upload] File received: ${fileName} (${buffer.length} bytes)`);

  res.json({
    message: 'File uploaded and processed successfully',
    fileName,
    sizeBytes: buffer.length,
  });
});

// 4. File Download Route (Protected)
app.get('/api/download', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const fileContent = 'This is a secure text file containing top-secret intelligence.';
  const buffer = Buffer.from(fileContent, 'utf8');

  // Instead of standard streaming which Secure Tunnel buffers,
  // we return the file details and content as Base64 JSON
  res.json({
    fileName: 'secret-intel.txt',
    fileContentBase64: buffer.toString('base64'),
    mimeType: 'text/plain',
  });
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Express API running on port ${PORT}`);
    console.log(`Secure Tunnel gateway active at http://localhost:${PORT}/api/gateway`);
  });
}

export default app;
