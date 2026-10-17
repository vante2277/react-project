import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/stocks.css';

const COUNTRIES = [
  { code: 'KR', label: '한국' },
  { code: 'US', label: '미국' },
  { code: 'CN', label: '중국' },
  { code: 'TW', label: '대만' },
  { code: 'JP', label: '일본' },
];

const REFRESH_MS = 30 * 1000;
const CACHE_KEY = 'stock_indices';

const readCache = () => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
};

const num = (v, digits = 2) =>
  v.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const timeText = ms => new Date(ms).toLocaleString('ko-KR', {
  month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
});

function Spark({ points, base, dir }) {
  if (points.length < 2) return <div className="spark" />;
  const values = [...points, base];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const x = i => (i / (points.length - 1)) * 100;
  const y = v => 36 - ((v - min) / range) * 32 - 2;

  return (
    <svg className={'spark ' + dir} viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2="100" y1={y(base)} y2={y(base)} className="base" />
      <polyline points={points.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
    </svg>
  );
}

function IndexCard({ item }) {
  if (item.error) {
    return (
      <li className="card">
        <div className="name">{item.name}</div>
        <div className="fail">불러오지 못했습니다</div>
      </li>
    );
  }
  const dir = item.change > 0 ? 'up' : item.change < 0 ? 'down' : 'flat';
  const sign = item.change > 0 ? '▲' : item.change < 0 ? '▼' : '';

  return (
    <li className={'card ' + dir}>
      <div className="top">
        <span className="name">{item.name}</span>
        <span className={'state' + (item.open ? ' open' : '')}>{item.open ? '장중' : '마감'}</span>
      </div>
      <div className="price">{num(item.price)}</div>
      <div className="change">
        {sign} {num(Math.abs(item.change))} ({item.changePct > 0 ? '+' : ''}{num(item.changePct)}%)
      </div>
      <Spark points={item.spark} base={item.prevClose} dir={dir} />
      <div className="meta">
        <span>고 {num(item.high)} · 저 {num(item.low)}</span>
        <span>{timeText(item.time)}</span>
      </div>
    </li>
  );
}

export default function Stocks() {
  // 마지막으로 본 시세를 먼저 보여주고, 바로 최신 값으로 갱신합니다.
  const [snapshot, setSnapshot] = useState(readCache);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/indices');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setSnapshot(json);
      setError('');
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(json)); } catch {}
    } catch {
      setError('시세를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const data = snapshot?.data || [];

  return (
    <main className="app stocks">
      <header>
        <Link className="back" to="/">← 홈</Link>
        <div className="title-row">
          <h1>주식지수</h1>
          <button className="refresh" onClick={load} disabled={loading}>
            {loading ? '갱신 중…' : '새로고침'}
          </button>
        </div>
        <p className="storage">
          {snapshot ? `마지막 갱신 ${new Date(snapshot.updatedAt).toLocaleTimeString('ko-KR')}` : '불러오는 중…'}
          {' · 30초마다 자동 갱신 · 출처 Yahoo Finance (지연 시세일 수 있음)'}
        </p>
      </header>

      {error && <p className="notice error" role="alert">{error}</p>}

      {COUNTRIES.map(c => {
        const items = data.filter(d => d.country === c.code);
        return (
          <section key={c.code} className="country">
            <h2>{c.label}</h2>
            <ul className="cards">
              {items.length
                ? items.map(item => <IndexCard key={item.symbol} item={item} />)
                : <li className="card skeleton" />}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
