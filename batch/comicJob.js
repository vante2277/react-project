// '피식' 배치 작업: 외부 Open API(xkcd)에서 만화 1편을 수집해 블로그 포스트로 저장합니다.
// 하루에 1건만 만들어지도록(멱등성) 오늘 날짜 포스트가 있으면 건너뜁니다.
//   - 실행 기록: server/data/batch-runs.json (최근 30건)
//   - 포스트:    server/data/comics.json
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'data');
const POSTS_FILE = path.join(DATA, 'comics.json');
const RUNS_FILE = path.join(DATA, 'batch-runs.json');
const MAX_RUNS = 30;

const API = num => `https://xkcd.com/${num ? num + '/' : ''}info.0.json`;
const IMAGE = /\.(png|jpe?g|gif)$/i; // 인터랙티브 만화처럼 이미지가 없는 회차는 제외

// 한국 시간 기준 'YYYY-MM-DD'
export const todayKST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

// 임시 파일에 쓴 뒤 이름을 바꿔서, 쓰는 도중 실패해도 기존 파일이 깨지지 않게 합니다.
async function writeJson(file, data) {
  await fs.mkdir(DATA, { recursive: true });
  const tmp = file + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
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

const toPost = (comic, date, isLatest) => ({
  id: `${date}-${comic.num}`,
  date,
  num: comic.num,
  title: comic.safe_title || comic.title,
  alt: comic.alt,
  img: comic.img,
  link: `https://xkcd.com/${comic.num}/`,
  published: `${comic.year}-${comic.month.padStart(2, '0')}-${comic.day.padStart(2, '0')}`,
  isLatest,
  source: 'xkcd',
  collectedAt: new Date().toISOString(),
});

export const readPosts = () => readJson(POSTS_FILE, []);
export const readRuns = () => readJson(RUNS_FILE, []);

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
    const posts = await readPosts();
    if (!force && posts.some(p => p.date === date)) {
      Object.assign(run, { status: 'skipped', message: `${date} 포스트가 이미 있어 건너뜀` });
    } else {
      const { comic, isLatest } = await pickComic(new Set(posts.map(p => p.num)));
      const post = toPost(comic, date, isLatest);
      await writeJson(POSTS_FILE, [post, ...posts]);
      Object.assign(run, { status: 'success', message: `#${post.num} "${post.title}" 수집`, postId: post.id });
    }
  } catch (err) {
    Object.assign(run, { status: 'failed', message: err.message });
  }

  run.durationMs = Date.now() - started;
  const runs = await readRuns();
  await writeJson(RUNS_FILE, [run, ...runs].slice(0, MAX_RUNS));
  console.log(`[피식 배치] ${run.status} · ${run.message} (${run.durationMs}ms, ${trigger})`);
  return run;
}
