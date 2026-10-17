import { useState } from 'react';
import { Link } from 'react-router-dom';
import { INVESTORS, ALL_QUOTES } from '../quotes.js';
import '../styles/quotes.css';

// 날짜마다 바뀌는 오늘의 명언
const todayIndex = () => {
  const d = new Date();
  const days = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  return days % ALL_QUOTES.length;
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return <button className="copy" onClick={copy}>{copied ? '복사됨 ✓' : '복사'}</button>;
}

const copyText = (q, inv) => `"${q.ko}"\n${q.en}\n— ${inv.name} (${inv.en})`;

function Quote({ q, inv }) {
  return (
    <li className="quote">
      <p className="ko">“{q.ko}”</p>
      <p className="en">{q.en}</p>
      <div className="quote-foot">
        <span className="source">{q.source}</span>
        <CopyButton text={copyText(q, inv)} />
      </div>
    </li>
  );
}

const matches = (text, keyword) => text.toLowerCase().includes(keyword);

export default function Quotes() {
  const [featured, setFeatured] = useState(todayIndex);
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState('all');

  const today = ALL_QUOTES[featured];
  const kw = keyword.trim().toLowerCase();

  const shuffle = () => {
    let next = featured;
    while (next === featured) next = Math.floor(Math.random() * ALL_QUOTES.length);
    setFeatured(next);
  };

  const shown = INVESTORS
    .filter(inv => selected === 'all' || inv.id === selected)
    .map(inv => {
      if (!kw) return { inv, quotes: inv.quotes };
      // 인물 이름이 맞으면 명언 전체, 아니면 내용이 맞는 명언만
      const nameHit = matches(inv.name + ' ' + inv.en + ' ' + inv.style, kw);
      const quotes = nameHit ? inv.quotes : inv.quotes.filter(q => matches(q.ko + ' ' + q.en, kw));
      return { inv, quotes };
    })
    .filter(({ quotes }) => quotes.length);

  return (
    <main className="app quotes">
      <header>
        <Link className="back" to="/">← 홈</Link>
        <h1>투자명언</h1>
        <p className="storage">투자 대가 {INVESTORS.length}명 · 명언 {ALL_QUOTES.length}개</p>
      </header>

      <section className="today" aria-label="오늘의 명언">
        <div className="today-head">
          <span className="badge">오늘의 명언</span>
          <button className="shuffle" onClick={shuffle}>다른 명언 ↻</button>
        </div>
        <p className="ko">“{today.ko}”</p>
        <p className="en">{today.en}</p>
        <div className="quote-foot">
          <span className="who">— {today.investor.name} <span>{today.investor.en}</span></span>
          <CopyButton text={copyText(today, today.investor)} />
        </div>
      </section>

      <div className="tools">
        <input type="search" placeholder="명언이나 이름으로 검색 (예: 복리, 버핏, value)"
          value={keyword} onChange={e => setKeyword(e.target.value)} />
        <nav className="chips" aria-label="인물 선택">
          <button className={'chip' + (selected === 'all' ? ' active' : '')} onClick={() => setSelected('all')}>전체</button>
          {INVESTORS.map(inv => (
            <button key={inv.id} className={'chip' + (selected === inv.id ? ' active' : '')}
              onClick={() => setSelected(selected === inv.id ? 'all' : inv.id)}>
              {inv.name}
            </button>
          ))}
        </nav>
      </div>

      {!shown.length && <p className="empty">검색 결과가 없습니다</p>}

      {shown.map(({ inv, quotes }) => (
        <article key={inv.id} className="investor">
          <header className="investor-head">
            <div>
              <h2>{inv.name} <span className="en-name">{inv.en}</span></h2>
              <p className="facts">{inv.country} · {inv.years}</p>
            </div>
            <span className="style">{inv.style}</span>
          </header>
          <p className="bio">{inv.bio}</p>
          <ul className="quote-list">
            {quotes.map(q => <Quote key={q.en} q={q} inv={inv} />)}
          </ul>
        </article>
      ))}

      <p className="note">명언은 본인의 저서·주주서한·인터뷰 등 출처가 확인되는 것 위주로 모았고, 한국어는 원문을 번역한 것입니다.</p>
    </main>
  );
}
