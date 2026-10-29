// '피식' 배치 작업: 외부 Open API(xkcd)에서 만화 1편을 수집해 블로그 포스트로 저장합니다.
// 하루에 1건만 만들어지도록(멱등성) 오늘 날짜 포스트가 있으면 건너뜁니다.
//   - 포스트:    Supabase comics 테이블 (date 가 unique 라 DB 에서도 하루 1건이 보장됨)
//   - 실행 기록: Supabase comic_batch_runs 테이블
// 서버에서만 쓰는 service_role 키로 저장합니다. (테이블은 supabase/schema.sql 참고)
import { createClient } from '@supabase/supabase-js';

const MAX_RUNS = 30;

const API = num => `https://xkcd.com/${num ? num + '/' : ''}info.0.json`;
const IMAGE = /\.(png|jpe?g|gif)$/i; // 인터랙티브 만화처럼 이미지가 없는 회차는 제외

// 한국 시간 기준 'YYYY-MM-DD'
export const todayKST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

// 환경변수는 처음 쓸 때 읽습니다. (vite.config.js 가 .env 를 늦게 불러오기 때문)
let client;
function db() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다. (.env.local 에 넣으세요. .env.example 참고)');
  client ??= createClient(url, key, { auth: { persistSession: false } });
  return client;
}

// Supabase 응답에서 에러를 꺼내 던지고 데이터만 돌려줍니다.
function check({ data, error }) {
  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') {
      throw new Error('테이블이 없습니다. Supabase SQL Editor 에서 supabase/schema.sql 을 실행해주세요.');
    }
    throw Object.assign(new Error(error.message), { code: error.code });
  }
  return data;
}

// 타임아웃 + 재시도(1초, 2초, 4초 대기) — 외부 API 를 부르는 배치의 기본기
async function fetchJson(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
      return await res.json();
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise(r => setTimeout(r, 1000 * 2 ** (i - 1)));
    }
  }
}

// 최신 회차를 아직 안 실었으면 최신 회차, 이미 실었으면 지난 회차 중 안 실은 것을 무작위로 고릅니다.
async function pickComic(seen) {
  const latest = await fetchJson(API());
  if (!seen.has(latest.num) && IMAGE.test(latest.img)) return { comic: latest, isLatest: true };

  for (let i = 0; i < 10; i++) {
    const num = 1 + Math.floor(Math.random() * latest.num);
    if (num === 404 || seen.has(num)) continue; // xkcd 404번은 존재하지 않는 회차
    const comic = await fetchJson(API(num));
    if (IMAGE.test(comic.img)) return { comic, isLatest: false };
  }
  throw new Error('실을 만화를 고르지 못했습니다');
}

// DB 컬럼은 snake_case, 화면(API 응답)은 camelCase
const toRow = (comic, date, isLatest) => ({
  id: `${date}-${comic.num}`,
  date,
  num: comic.num,
  title: comic.safe_title || comic.title,
  alt: comic.alt,
  img: comic.img,
  link: `https://xkcd.com/${comic.num}/`,
  published: `${comic.year}-${comic.month.padStart(2, '0')}-${comic.day.padStart(2, '0')}`,
  is_latest: isLatest,
  source: 'xkcd',
});

const toPost = ({ is_latest, collected_at, ...rest }) => ({ ...rest, isLatest: is_latest, collectedAt: collected_at });
const toRun = ({ started_at, post_id, duration_ms, ...rest }) => ({
  ...rest, startedAt: started_at, postId: post_id, durationMs: duration_ms,
});

export async function readPosts() {
  return check(await db().from('comics').select('*').order('date', { ascending: false })).map(toPost);
}

export async function readRuns() {
  const query = db().from('comic_batch_runs').select('*').order('started_at', { ascending: false }).limit(MAX_RUNS);
  return check(await query).map(toRun);
}

let running = null; // 같은 프로세스에서 동시에 두 번 돌지 않도록 막는 잠금

// trigger: 'schedule' | 'startup' | 'manual' | 'cli'
export function runComicJob({ trigger = 'manual', force = false } = {}) {
  running ??= execute(trigger, force).finally(() => { running = null; });
  return running;
}

async function execute(trigger, force) {
  const started = Date.now();
  const date = todayKST();
  const run = { id: started.toString(36), trigger, startedAt: new Date(started).toISOString() };

  try {
    const comics = () => db().from('comics'); // 쿼리마다 새 builder
    if (force) check(await comics().delete().eq('date', date));
    const posts = check(await comics().select('date, num'));
    if (posts.some(p => p.date === date)) {
      Object.assign(run, { status: 'skipped', message: `${date} 포스트가 이미 있어 건너뜀` });
    } else {
      const { comic, isLatest } = await pickComic(new Set(posts.map(p => p.num)));
      const row = toRow(comic, date, isLatest);
      try {
        check(await comics().insert(row));
        Object.assign(run, { status: 'success', message: `#${row.num} "${row.title}" 수집`, postId: row.id });
      } catch (err) {
        // 다른 서버(로컬과 Vercel 등)가 같은 순간에 먼저 저장한 경우: date unique 제약이 막아 줍니다.
        if (err.code !== '23505') throw err;
        Object.assign(run, { status: 'skipped', message: `${date} 포스트를 다른 실행이 먼저 저장함` });
      }
    }
  } catch (err) {
    Object.assign(run, { status: 'failed', message: err.message });
  }

  run.durationMs = Date.now() - started;
  try {
    check(await db().from('comic_batch_runs').insert({
      id: run.id, trigger, started_at: run.startedAt, status: run.status,
      message: run.message, post_id: run.postId ?? null, duration_ms: run.durationMs,
    }));
  } catch (err) {
    console.error('[피식 배치] 실행 기록 저장 실패:', err.message);
  }
  console.log(`[피식 배치] ${run.status} · ${run.message} (${run.durationMs}ms, ${trigger})`);
  return run;
}
