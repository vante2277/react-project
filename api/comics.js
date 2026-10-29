// '피식' 포스트 API
//   GET  /api/comics → { posts, runs, schedule }
//   POST /api/comics → 배치를 지금 한 번 실행 (오늘 포스트가 있으면 건너뜀)
// 배치가 파일에 저장하므로 로컬 서버(npm run dev / npm start)에서만 동작합니다.
import { runComicJob, readPosts, readRuns } from '../batch/comicJob.js';

export const COMIC_BATCH_TIME = process.env.COMIC_BATCH_TIME || '09:00';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') return send(res, 200, { run: await runComicJob({ trigger: 'manual' }) });
    const [posts, runs] = await Promise.all([readPosts(), readRuns()]);
    send(res, 200, { posts, runs, schedule: COMIC_BATCH_TIME });
  } catch {
    send(res, 500, { error: 'comics failed' });
  }
}
