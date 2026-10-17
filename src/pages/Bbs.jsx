import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, supabaseReady, dbErrorText } from '../supabase.js';
import { useAuth, displayName } from '../auth/AuthContext.jsx';
import '../styles/bbs.css';

function PostEditor({ post, onSave, onCancel }) {
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const t = title.trim();
    const c = content.trim();
    if (!t || !c) return;
    setBusy(true);
    await onSave(t, c);
    setBusy(false);
  };

  return (
    <li className="item editing">
      <input className="edit-title" value={title} maxLength={100} autoFocus
        onChange={e => setTitle(e.target.value)} />
      <textarea className="edit-content" value={content} maxLength={2000}
        onChange={e => setContent(e.target.value)} />
      <div className="actions">
        <button className="save-btn" onClick={save} disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
        <button className="cancel-btn" onClick={onCancel}>취소</button>
      </div>
    </li>
  );
}

export default function Bbs() {
  const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(supabaseReady);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.from('posts').select('*').order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(dbErrorText(err));
        else setPosts(data);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const submit = async e => {
    e.preventDefault();
    const t = title.trim();
    const c = content.trim();
    if (!t || !c) return;
    setBusy(true);
    setError('');
    const { data, error: err } = await supabase.from('posts')
      .insert({ title: t, content: c, author: displayName(user) })
      .select().single();
    setBusy(false);
    if (err) return setError(dbErrorText(err));
    setPosts(prev => [data, ...prev]);
    setTitle('');
    setContent('');
  };

  const update = async (id, t, c) => {
    setError('');
    const { data, error: err } = await supabase.from('posts')
      .update({ title: t, content: c, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (err) return setError(dbErrorText(err));
    setPosts(prev => prev.map(p => (p.id === id ? data : p)));
    setEditingId(null);
  };

  const remove = async id => {
    if (!confirm('이 글을 삭제할까요?')) return;
    setError('');
    const { error: err } = await supabase.from('posts').delete().eq('id', id);
    if (err) return setError(dbErrorText(err));
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  return (
    <main className="app bbs">
      <header>
        <Link className="back" to="/">← 홈</Link>
        <h1>게시판</h1>
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
            <h2>글 목록</h2>
            <ul className="list">
              {loading && <li className="empty">불러오는 중…</li>}
              {!loading && !posts.length && <li className="empty">작성된 글이 없습니다</li>}
              {posts.map(p => (p.id === editingId ? (
                <PostEditor key={p.id} post={p}
                  onSave={(t, c) => update(p.id, t, c)}
                  onCancel={() => setEditingId(null)} />
              ) : (
                <li key={p.id} className="item">
                  <div className="row">
                    <span className="title">{p.title}</span>
                    <span className="date">{new Date(p.created_at).toLocaleString('ko-KR')}</span>
                  </div>
                  <div className="author">{p.author || '익명'}{p.updated_at && ' · 수정됨'}</div>
                  <div className="content">{p.content}</div>
                  {user?.id === p.user_id && (
                    <div className="actions">
                      <button className="edit-btn" onClick={() => setEditingId(p.id)}>수정</button>
                      <button className="del" onClick={() => remove(p.id)}>삭제</button>
                    </div>
                  )}
                </li>
              )))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
