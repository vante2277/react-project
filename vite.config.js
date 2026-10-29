import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import indicesHandler from './api/indices.js';
import comicsHandler, { COMIC_BATCH_TIME } from './api/comics.js';
import { runComicJob } from './batch/comicJob.js';
import { startDailySchedule } from './batch/scheduler.js';

// 개발 서버에서도 Vercel 과 같은 /api/indices 를 쓸 수 있게 연결
const devApi = {
  name: 'dev-api',
  configureServer(server) {
    server.middlewares.use('/api/indices', (req, res) => indicesHandler(req, res));
    server.middlewares.use('/api/comics', (req, res) => comicsHandler(req, res));
    // '피식' 배치도 개발 서버와 함께 돌고, 서버가 재시작되면 이전 타이머는 정리
    const stop = startDailySchedule('피식 배치', COMIC_BATCH_TIME, trigger => runComicJob({ trigger }));
    server.httpServer?.on('close', stop);
  },
};

export default defineConfig(({ mode }) => {
  // 서버 쪽 코드(배치)도 .env 의 SUPABASE_SERVICE_ROLE_KEY 등을 쓸 수 있게 process.env 에 넣기
  process.env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return {
    plugins: [react(), devApi],
    server: { port: 5173 },
  };
});
