import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The browser talks to the API on the same origin (/api). In development Vite proxies
// it to the FastAPI server, so session cookies stay first-party and no CORS is needed.
const apiTarget = process.env.VITE_DEV_API_PROXY || 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: { '/api': { target: apiTarget, changeOrigin: false } },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    proxy: { '/api': { target: apiTarget, changeOrigin: false } },
  },
});
