import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MAP_WIDTH, MAP_HEIGHT, PROVINCES, project } from '../koreaMap.js';
import '../styles/weather.css';

// label: 다른 도시와 겹치지 않도록 이름표를 옮길 위치 (지도 좌표). 없으면 도시 위치에 표시
const CITIES = [
  { name: '서울', lat: 37.5665, lon: 126.978, label: [190, 60] },
  { name: '인천', lat: 37.4563, lon: 126.7052, label: [110, 120] },
  { name: '수원', lat: 37.2636, lon: 127.0286, label: [115, 172] },
  { name: '춘천', lat: 37.8813, lon: 127.7298, label: [275, 50] },
  { name: '강릉', lat: 37.7519, lon: 128.8761, label: [385, 80] },
  { name: '청주', lat: 36.6424, lon: 127.489, label: [290, 168] },
  { name: '대전', lat: 36.3504, lon: 127.3845, label: [160, 238] },
  { name: '안동', lat: 36.5684, lon: 128.7294, label: [405, 205] },
  { name: '전주', lat: 35.8242, lon: 127.148, label: [148, 296] },
  { name: '대구', lat: 35.8714, lon: 128.6014 },
  { name: '울산', lat: 35.5384, lon: 129.3114, label: [435, 300] },
  { name: '광주', lat: 35.1595, lon: 126.8526 },
  { name: '부산', lat: 35.1796, lon: 129.0756, label: [395, 382] },
  { name: '목포', lat: 34.8118, lon: 126.3922, label: [105, 412] },
  { name: '여수', lat: 34.7604, lon: 127.6622 },
  { name: '제주', lat: 33.4996, lon: 126.5312, label: [255, 515] },
  { name: '울릉도', lat: 37.4845, lon: 130.9057, label: [488, 165] },
];

// WMO 날씨 코드 → [아이콘, 설명]
const WEATHER = {
  0: ['☀️', '맑음'], 1: ['🌤️', '대체로 맑음'], 2: ['⛅', '구름 조금'], 3: ['☁️', '흐림'],
  45: ['🌫️', '안개'], 48: ['🌫️', '안개'],
  51: ['🌦️', '이슬비'], 53: ['🌦️', '이슬비'], 55: ['🌦️', '이슬비'], 56: ['🌧️', '어는 비'], 57: ['🌧️', '어는 비'],
  61: ['🌧️', '비'], 63: ['🌧️', '비'], 65: ['🌧️', '강한 비'], 66: ['🌧️', '어는 비'], 67: ['🌧️', '어는 비'],
  71: ['🌨️', '눈'], 73: ['🌨️', '눈'], 75: ['❄️', '많은 눈'], 77: ['🌨️', '싸락눈'],
  80: ['🌦️', '소나기'], 81: ['🌦️', '소나기'], 82: ['🌧️', '강한 소나기'], 85: ['🌨️', '소낙눈'], 86: ['🌨️', '소낙눈'],
  95: ['⛈️', '뇌우'], 96: ['⛈️', '뇌우·우박'], 99: ['⛈️', '뇌우·우박'],
};
const weatherOf = code => WEATHER[code] || ['❔', '알 수 없음'];

const CACHE_KEY = 'weather_forecast';
const STALE_MS = 30 * 60 * 1000;

const API_URL = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
  latitude: CITIES.map(c => c.lat).join(','),
  longitude: CITIES.map(c => c.lon).join(','),
  daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  timezone: 'Asia/Seoul',
  forecast_days: '7',
});

const readCache = () => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
};

const dayLabel = (iso, i) => {
  if (i === 0) return '오늘';
  if (i === 1) return '내일';
  const d = new Date(iso + 'T00:00:00+09:00');
  return `${d.getMonth() + 1}/${d.getDate()} (${'일월화수목금토'[d.getDay()]})`;
};

const t = v => `${Math.round(v)}°`;

function CityMarker({ city, daily, day, selected, onSelect }) {
  const [x, y] = project(city.lat, city.lon);
  const [lx, ly] = city.label || [x, y];
  const [icon, desc] = weatherOf(daily.weather_code[day]);

  return (
    <g className={'city' + (selected ? ' selected' : '')} role="button" tabIndex={0}
      aria-label={`${city.name} ${desc} 최저 ${t(daily.temperature_2m_min[day])} 최고 ${t(daily.temperature_2m_max[day])}`}
      onClick={onSelect}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}>
      {city.label && <line x1={x} y1={y} x2={lx} y2={ly} className="leader" />}
      <circle cx={x} cy={y} r="3" className="dot" />
      <rect x={lx - 34} y={ly - 20} width="68" height="40" rx="10" className="box" />
      <text x={lx - 26} y={ly - 4} className="label-name">{city.name}</text>
      <text x={lx + 27} y={ly - 3} className="label-icon" textAnchor="end">{icon}</text>
      <text x={lx} y={ly + 13} textAnchor="middle" className="label-temp">
        <tspan className="min">{t(daily.temperature_2m_min[day])}</tspan>
        <tspan className="sep"> / </tspan>
        <tspan className="max">{t(daily.temperature_2m_max[day])}</tspan>
      </text>
    </g>
  );
}

export default function Weather() {
  // 마지막으로 받은 예보를 먼저 보여주고, 30분이 지났으면 새로 받아옵니다.
  const [snapshot, setSnapshot] = useState(readCache);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [day, setDay] = useState(0);
  const [cityIndex, setCityIndex] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error();
      const json = await res.json();
      const next = { updatedAt: Date.now(), daily: json.map(r => r.daily) };
      setSnapshot(next);
      setError('');
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch {}
    } catch {
      setError('날씨를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const cached = readCache();
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    // 캐시가 오래됐거나 날짜가 바뀌었으면 새로 받기
    if (!cached || Date.now() - cached.updatedAt > STALE_MS || cached.daily?.[0]?.time?.[0] !== today) load();
  }, [load]);

  const daily = snapshot?.daily;
  const city = CITIES[cityIndex];
  const cityDaily = daily?.[cityIndex];

  return (
    <main className="app weather">
      <header>
        <Link className="back" to="/">← 홈</Link>
        <div className="title-row">
          <h1>전국날씨</h1>
          <button className="refresh" onClick={load} disabled={loading}>
            {loading ? '갱신 중…' : '새로고침'}
          </button>
        </div>
        <p className="storage">
          {snapshot ? `마지막 갱신 ${new Date(snapshot.updatedAt).toLocaleString('ko-KR')}` : '불러오는 중…'}
          {' · 출처 Open-Meteo'}
        </p>
      </header>

      {error && <p className="notice error" role="alert">{error}</p>}

      {daily && (
        <>
          <nav className="days" aria-label="날짜 선택">
            {daily[0].time.map((iso, i) => (
              <button key={iso} className={'day' + (day === i ? ' active' : '')} onClick={() => setDay(i)}>
                {dayLabel(iso, i)}
              </button>
            ))}
          </nav>

          <div className="map-wrap">
            <svg className="map" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img"
              aria-label={`${dayLabel(daily[0].time[day], day)} 전국 날씨 지도`}>
              {PROVINCES.map(p => <path key={p.name} d={p.d} className="province"><title>{p.name}</title></path>)}
              {CITIES.map((c, i) => (
                <CityMarker key={c.name} city={c} daily={daily[i]} day={day}
                  selected={i === cityIndex} onSelect={() => setCityIndex(i)} />
              ))}
            </svg>
            <p className="legend">
              <span className="min">최저</span> / <span className="max">최고</span> 기온 · 도시를 누르면 주간 예보를 볼 수 있어요
            </p>
          </div>

          <section className="week">
            <div className="week-head">
              <h2>{city.name} 주간 예보</h2>
              <select value={cityIndex} onChange={e => setCityIndex(Number(e.target.value))} aria-label="도시 선택">
                {CITIES.map((c, i) => <option key={c.name} value={i}>{c.name}</option>)}
              </select>
            </div>
            <ul className="week-list">
              {cityDaily.time.map((iso, i) => {
                const [icon, desc] = weatherOf(cityDaily.weather_code[i]);
                return (
                  <li key={iso} className={'week-day' + (day === i ? ' active' : '')} onClick={() => setDay(i)}>
                    <span className="wd">{dayLabel(iso, i)}</span>
                    <span className="icon" aria-hidden="true">{icon}</span>
                    <span className="desc">{desc}</span>
                    <span className="temps">
                      <span className="min">{t(cityDaily.temperature_2m_min[i])}</span>
                      {' / '}
                      <span className="max">{t(cityDaily.temperature_2m_max[i])}</span>
                    </span>
                    <span className="rain">💧 {cityDaily.precipitation_probability_max[i] ?? '-'}%</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {!daily && !error && <div className="map-skeleton" />}
    </main>
  );
}
