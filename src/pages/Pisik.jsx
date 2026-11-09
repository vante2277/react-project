import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '../styles/pisik.css';

const STATUS = { success: '성공', skipped: '건너뜀', failed: '실패' };
const TRIGGER = { schedule: '예약', startup: '서버 시작', manual: '수동', cli: 'CLI' };

const longDate = date => new Date(date + 'T00:00:00+09:00').toLocaleDateString('ko-KR', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
});
const time = iso => new Date(iso).toLocaleString('ko-KR', {
  timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function Post({ post }) {
  return (
    <article className="post">
      <p className="post-meta">
        <span className="badge">오늘의 피식</span>
        <time dateTime={post.date}>{longDate(post.date)}</time>
      </p>
      <h2>{post.title}</h2>
      <figure>
        <img src={post.img} alt={post.title} loading="lazy" />
      </figure>
      <blockquote className="alt">
        <span>작가의 한마디</span>
        {post.alt}
      </blockquote>
      {post.titleKo && (
        <section className="ko">
          <span>한국어 번역 · 기계 번역</span>
          <dl>
            <dt>제목</dt>
            <dd>{post.titleKo}</dd>
            {post.altKo && <>
              <dt>작가의 한마디</dt>
              <dd>{post.altKo}</dd>
            </>}
          </dl>
          <p className="ko-note">만화 속 대사는 번역되지 않아요. 원문 이미지를 함께 봐 주세요.</p>
        </section>
      )}
      <footer className="post-foot">
        <span className="tags">#xkcd #{post.num} {post.isLatest && '#최신화'}</span>
        <a href={post.link} target="_blank" rel="noreferrer">원문 보기 ↗</a>
      </footer>
      <p className="credit">
        출처: xkcd #{post.num} ({post.published}) · Randall Munroe · CC BY-NC 2.5
      </p>
    </article>
  );
}

function BatchPanel({ runs, schedule, onRun, busy }) {
  return (
    <details className="batch">
      <summary>
        배치 실행 기록 <span>매일 {schedule} (한국 시간) 자동 수집</span>
      </summary>
      <div className="batch-head">
        <p>오늘 포스트가 이미 있으면 다시 실행해도 건너뜁니다.</p>
        <button className="btn-primary" onClick={onRun} disabled={busy}>{busy ? '수집 중…' : '지금 실행'}</button>
      </div>
      {!runs.length ? <p className="empty">아직 실행 기록이 없습니다</p> : (
        <ul className="runs">
          {runs.map(r => (
            <li key={r.id} className={r.status}>
              <span className="status">{STATUS[r.status]}</span>
              <span className="msg">{r.message}</span>
              <span className="when">{time(r.startedAt)} · {TRIGGER[r.trigger] || r.trigger} · {r.durationMs}ms</span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

export default function Pisik() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [params, setParams] = useSearchParams();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/comics');
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error);
      setData(body);
      setError('');
    } catch (err) {
      setError(`포스트를 불러오지 못했습니다. ${err.message || '서버에 연결할 수 없습니다.'}`);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runNow = async () => {
    setBusy(true);
    try { await fetch('/api/comics', { method: 'POST' }); } catch {}
    await load();
    setBusy(false);
  };

  const posts = data?.posts || [];
  const current = posts.find(p => p.id === params.get('p')) || posts[0];

  const open = id => {
    setParams(id === posts[0]?.id ? {} : { p: id });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="app pisik">
      <header>
        <Link className="back" to="/">← 홈</Link>
        <h1>피식</h1>
        <p className="storage">하루 한 편, 짧고 웃긴 만화 · 지금까지 {posts.length}편</p>
      </header>

      {error && <p className="notice error" role="alert">{error}</p>}
      {!data && !error && <p className="empty">불러오는 중…</p>}
      {data && !current && <p className="empty">아직 수집된 만화가 없습니다. 아래 ‘지금 실행’을 눌러 보세요.</p>}

      {current && <Post post={current} />}

      {posts.length > 1 && (
        <section className="archive" aria-label="지난 포스트">
          <h3>지난 피식</h3>
          <ul>
            {posts.map(p => (
              <li key={p.id}>
                <button className={p.id === current.id ? 'active' : ''} onClick={() => open(p.id)}>
                  <time dateTime={p.date}>{p.date.slice(5).replace('-', '.')}</time>
                  <span>{p.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && <BatchPanel runs={data.runs} schedule={data.schedule} onRun={runNow} busy={busy} />}
    </main>
  );
}
