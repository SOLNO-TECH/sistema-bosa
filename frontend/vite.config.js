import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

/** TUNNEL=1 → HTTP local (el túnel público sigue siendo HTTPS). Sin micrófono en LAN sin SSL. */
const tunnelMode = process.env.TUNNEL === '1';

export default defineConfig({
  plugins: [react(), ...(tunnelMode ? [] : [basicSsl()])],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
});
