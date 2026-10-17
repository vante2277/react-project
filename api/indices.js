// 주요국 주식지수 시세 (Yahoo Finance 차트 API)
// Vercel 에서는 /api/indices 서버리스 함수로, 로컬에서는 vite.config.js / server/server.js 가 같은 handler 를 사용합니다.

export const INDICES = [
  { symbol: '^KS11', name: '코스피', country: 'KR' },
  { symbol: '^KQ11', name: '코스닥', country: 'KR' },
  { symbol: '^GSPC', name: 'S&P 500', country: 'US' },
  { symbol: '^IXIC', name: '나스닥', country: 'US' },
  { symbol: '^DJI', name: '다우존스', country: 'US' },
  { symbol: '000001.SS', name: '상해종합', country: 'CN' },
  { symbol: '399001.SZ', name: '심천성분', country: 'CN' },
  { symbol: '^TWII', name: '가권(TAIEX)', country: 'TW' },
  { symbol: '^N225', name: '닛케이 225', country: 'JP' },
];

const SPARK_POINTS = 60;

async function fetchOne({ symbol, name, country }) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`${symbol} ${res.status}`);
  const result = (await res.json()).chart?.result?.[0];
  if (!result) throw new Error(`${symbol} no data`);

  const { meta } = result;
  const price = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose;
  const regular = meta.currentTradingPeriod?.regular;
  const now = Date.now() / 1000;

  // 차트용 종가: 빈 값 제거 후 SPARK_POINTS 개 정도로 줄임
  const closes = (result.indicators?.quote?.[0]?.close || []).filter(v => v != null);
  const step = Math.max(1, Math.ceil(closes.length / SPARK_POINTS));
  const spark = closes.filter((_, i) => i % step === 0 || i === closes.length - 1);

  return {
    symbol, name, country, price, prevClose,
    change: price - prevClose,
    changePct: ((price - prevClose) / prevClose) * 100,
    high: meta.regularMarketDayHigh,
    low: meta.regularMarketDayLow,
    time: meta.regularMarketTime * 1000,
    open: Boolean(regular && now >= regular.start && now < regular.end),
    spark,
  };
}

export async function getIndices() {
  const results = await Promise.allSettled(INDICES.map(fetchOne));
  return results.map((r, i) => (r.status === 'fulfilled' ? r.value : { ...INDICES[i], error: true }));
}

export default async function handler(req, res) {
  try {
    const data = await getIndices();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // Vercel CDN 에서 15초 캐시, 이후 30초 동안은 이전 값을 바로 주면서 뒤에서 갱신
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    res.end(JSON.stringify({ updatedAt: Date.now(), data }));
  } catch {
    res.statusCode = 502;
    res.end('{"error":"fetch failed"}');
  }
}
