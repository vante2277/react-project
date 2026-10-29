// 배치를 한 번만 수동 실행: npm run batch:comic  (오늘 것을 다시 수집하려면 -- --force)
// OS 스케줄러(Windows 작업 스케줄러, cron)에 이 명령을 등록해서 쓰는 방법도 있습니다.
import { runComicJob } from './comicJob.js';

const run = await runComicJob({ trigger: 'cli', force: process.argv.includes('--force') });
process.exitCode = run.status === 'failed' ? 1 : 0;
