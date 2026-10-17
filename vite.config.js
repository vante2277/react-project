import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import indicesHandler from './api/indices.js';

// 개발 서버에서도 Vercel 과 같은 /api/indices 를 쓸 수 있게 연결
const devApi = {
  name: 'dev-api',
  configureServer(server) {
    server.middlewares.use('/api/indices', (req, res) => indicesHandler(req, res));
  },
};

export default defineConfig({
  plugins: [react(), devApi],
  server: { port: 5173 },
});
