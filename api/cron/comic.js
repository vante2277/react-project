// Vercel Cron 이 매일 부르는 '피식' 배치 (vercel.json 의 crons 참고)
// Vercel 에서는 서버가 계속 떠 있지 않아 setTimeout 스케줄러 대신 플랫폼의 cron 을 씁니다.
// CRON_SECRET 환경변수를 설정하면 Vercel 이 Authorization 헤더에 담아 보내므로, 다른 사람의 호출을 막을 수 있습니다.
import { runComicJob } from '../../batch/comicJob.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'unauthorized' }));
  }
  const run = await runComicJob({ trigger: 'schedule' });
  res.statusCode = run.status === 'failed' ? 500 : 200;
  res.end(JSON.stringify({ run }));
}
