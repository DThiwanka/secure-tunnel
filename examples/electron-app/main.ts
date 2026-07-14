/* eslint-disable @typescript-eslint/no-explicit-any */
import { app, BrowserWindow, ipcMain } from 'electron';
import { createTunnel } from '@secure-tunnel/client';

let mainWindow: BrowserWindow | null = null;

// Keys and Client setup are isolated inside the secure Node.js Main Process
const tunnel = createTunnel({
  endpoint: 'https://api.my-enterprise-app.com/api/gateway',
  secretKey: 'my-super-secret-key-32-chars-long-123456',
  signatureKey: 'sig-key-12345',
  encryption: true,
  signing: true,
  compression: true,
});

// Storing session token securely in Main Process Memory
let sessionToken: string | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Load standard preload file mapping IPC functions
    },
  });

  // Load index.html or local development server
  mainWindow.loadURL('about:blank'); // Mock
}

app.whenReady().then(() => {
  createWindow();

  // IPC channel: Renderer invokes Main to execute API calls
  ipcMain.handle('api-request', async (event, { method, url, body, query }) => {
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['authorization'] = `Bearer ${sessionToken}`;
      }

      const res = await tunnel.request(method, url, body, headers, query);

      // Save token if login request succeeded
      if (url === '/api/login' && res.accessToken) {
        sessionToken = res.accessToken;
      }

      return { success: true, data: res };
    } catch (err: any) {
      console.error(`[Electron Main API Error]`, err);
      return { success: false, error: err.message };
    }
  });
});
