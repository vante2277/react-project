import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, supabaseReady, dbErrorText } from '../supabase.js';
import { useAuth, displayName } from '../auth/AuthContext.jsx';
import '../styles/bbs.css';

const PAGE_SIZE = 10;

// 검색어에서 PostgREST 필터 문법(쉼표·괄호·따옴표)과 LIKE 와일드카드로 쓰이는 문자를 뺍니다.
const cleanQuery = q => q.replace(/[%_*,()"\\]/g, ' ').trim();

function Pagination({ page, totalPages, hrefOf }) {
  if (totalPages <= 1) return null;
  // 현재 페이지를 가운데에 두고 최대 5개 번호를 보여줍니다.
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);

  return (
    <nav className="pagination" aria-label="페이지">
      {page > 1 ? <Link to={hrefOf(page - 1)}>‹ 이전</Link> : <span className="disabled">‹ 이전</span>}
      {pages.map(n => (
        <Link key={n} to={hrefOf(n)} className={n === page ? 'current' : ''}
          aria-current={n === page ? 'page' : undefined}>{n}</Link>
      ))}
      {page < totalPages ? <Link to={hrefOf(page + 1)}>다음 ›</Link> : <span className="disabled">다음 ›</span>}
    </nav>
  );
}

export default function Bbs() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  // 검색어와 페이지는 URL(?q=&page=)에 둡니다. 새로고침·뒤로가기·링크 공유를 해도 같은 화면이 나옵니다.
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1);

  const [keyword, setKeyword] = useState(q);
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(supabaseReady);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hrefOf = n => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (n > 1) next.set('page', n);
    const s = next.toString();
    return s ? `/bbs?${s}` : '/bbs';
  };

  // 뒤로가기 등으로 URL 의 검색어가 바뀌면 입력창도 맞춥니다.
  useEffect(() => setKeyword(q), [q]);

  // 입력을 멈추고 300ms 가 지나면 URL 에 반영합니다. (한 글자마다 요청하지 않도록 디바운스)
  useEffect(() => {
    const v = keyword.trim();
    if (v === q) return;
    const timer = setTimeout(() => setParams(v ? { q: v } : {}, { replace: true }), 300);
    return () => clearTimeout(timer);
  }, [keyword, q, setParams]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    // comments(count), post_likes(count): 연결된 테이블의 개수를 글과 함께 한 번에 가져옵니다.
    let query = supabase.from('posts')
      .select('id, title, author, created_at, updated_at, comments(count), post_likes(count)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    const term = cleanQuery(q);
    if (term) query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);

    query.then(({ data, count, error: err }) => {
      if (cancelled) return;
      // PGRST103: 글 수보다 뒤쪽 페이지를 요청함 → 1페이지로 보냅니다.
      if (err?.code === 'PGRST103') return setParams(q ? { q } : {}, { replace: true });
      if (err) setError(dbErrorText(err));
      else {
        setPosts(data);
        setTotal(count ?? 0);
        setError('');
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [q, page, setParams]);

  const submit = async e => {
    e.preventDefault();
    const t = title.trim();
    const c = content.trim();
    if (!t || !c) return;
    setBusy(true);
    setError('');
    const { data, error: err } = await supabase.from('posts')
      .insert({ title: t, content: c, author: displayName(user) })
      .select('id').single();
    setBusy(false);
    if (err) return setError(dbErrorText(err));
    navigate(`/bbs/${data.id}`);
  };

  return (
    <main className="app bbs">
      <header>
        <Link className="back" to="/">← 홈</Link>
        <h1>자유게시판</h1>
        <p className="storage">저장 위치: Supabase</p>
      </header>

      {!supabaseReady ? (
        <p className="notice error">Supabase 설정이 없습니다. .env 파일에 URL과 키를 입력해주세요.</p>
      ) : (
        <>
          {authLoading ? null : user ? (
            <form className="write" onSubmit={submit}>
              <input type="text" placeholder="제목을 입력하세요" autoComplete="off" maxLength={100} required
                value={title} onChange={e => setTitle(e.target.value)} />
              <textarea placeholder="내용을 입력하세요" maxLength={2000} required
                value={content} onChange={e => setContent(e.target.value)} />
              <button type="submit" disabled={busy}>{busy ? '작성 중…' : '작성'}</button>
            </form>
          ) : (
            <p className="notice">글을 쓰려면 <Link to="/login">로그인</Link>이 필요합니다.</p>
          )}

          {error && <p className="notice error" role="alert">{error}</p>}

          <section className="board">
            <div className="board-head">
              <h2>{q ? `"${q}" 검색 결과` : '글 목록'} <span className="total">{total}건</span></h2>
              <input className="search" type="search" placeholder="제목·내용 검색" aria-label="게시글 검색"
                value={keyword} onChange={e => setKeyword(e.target.value)} />
            </div>
            <ul className="list posts">
              {loading && <li className="empty">불러오는 중…</li>}
              {!loading && !posts.length && <li className="empty">{q ? '검색 결과가 없습니다' : '작성된 글이 없습니다'}</li>}
              {!loading && posts.map(p => {
                const comments = p.comments[0]?.count ?? 0;
                const likes = p.post_likes[0]?.count ?? 0;
                return (
                  <li key={p.id} className="item">
                    {/* 상세에서 "목록"으로 돌아올 때 지금의 검색어·페이지를 유지하도록 state 로 넘깁니다. */}
                    <Link className="post-link" to={`/bbs/${p.id}`} state={{ from: params.toString() }}>
                      <div className="row">
                        <span className="title">
                          {p.title}
                          {comments > 0 && <span className="comment-count">[{comments}]</span>}
                        </span>
                        <span className="date">{new Date(p.created_at).toLocaleDateString('ko-KR')}</span>
                      </div>
                      <div className="author">
                        {p.author || '익명'}{p.updated_at && ' · 수정됨'}
                        {likes > 0 && <span className="like-count"> · ♥ {likes}</span>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Pagination page={page} totalPages={totalPages} hrefOf={hrefOf} />
          </section>
        </>
      )}
    </main>
  );
}
