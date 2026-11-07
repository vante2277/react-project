import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase, supabaseReady, dbErrorText } from '../supabase.js';
import { useAuth, displayName } from '../auth/AuthContext.jsx';
import '../styles/bbs.css';

const formatDate = iso => new Date(iso).toLocaleString('ko-KR');

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
    <div className="item editing">
      <input className="edit-title" value={title} maxLength={100} autoFocus
        onChange={e => setTitle(e.target.value)} />
      <textarea className="edit-content" value={content} maxLength={2000}
        onChange={e => setContent(e.target.value)} />
      <div className="actions">
        <button className="save-btn" onClick={save} disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
        <button className="cancel-btn" onClick={onCancel}>취소</button>
      </div>
    </div>
  );
}

function Comments({ postId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.from('comments').select('*').eq('post_id', postId).order('created_at')
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(dbErrorText(err));
        else setComments(data);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [postId]);

  const submit = async e => {
    e.preventDefault();
    const c = text.trim();
    if (!c) return;
    setBusy(true);
    setError('');
    const { data, error: err } = await supabase.from('comments')
      .insert({ post_id: postId, content: c, author: displayName(user) })
      .select().single();
    setBusy(false);
    if (err) return setError(dbErrorText(err));
    setComments(prev => [...prev, data]);
    setText('');
  };

  const remove = async id => {
    if (!confirm('이 댓글을 삭제할까요?')) return;
    setError('');
    const { error: err } = await supabase.from('comments').delete().eq('id', id);
    if (err) return setError(dbErrorText(err));
    setComments(prev => prev.filter(c => c.id !== id));
  };

  return (
    <section className="comments">
      <h2>댓글 <span className="total">{comments.length}</span></h2>
      {error && <p className="notice error" role="alert">{error}</p>}
      <ul className="comment-list">
        {loading && <li className="empty">불러오는 중…</li>}
        {!loading && !comments.length && <li className="empty">첫 댓글을 남겨보세요</li>}
        {comments.map(c => (
          <li key={c.id} className="comment">
            <div className="meta">
              <span className="author">{c.author || '익명'}</span>
              <span className="date">{formatDate(c.created_at)}</span>
              {user?.id === c.user_id && <button className="del" onClick={() => remove(c.id)}>삭제</button>}
            </div>
            <p className="content">{c.content}</p>
          </li>
        ))}
      </ul>
      {user ? (
        <form className="comment-form" onSubmit={submit}>
          <textarea placeholder="댓글을 입력하세요" maxLength={500} required
            value={text} onChange={e => setText(e.target.value)} />
          <button type="submit" disabled={busy}>{busy ? '등록 중…' : '등록'}</button>
        </form>
      ) : (
        <p className="notice">댓글을 쓰려면 <Link to="/login">로그인</Link>이 필요합니다.</p>
      )}
    </section>
  );
}

export default function BbsPost() {
  const { id } = useParams();
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const location = useLocation();
  // 목록에서 넘겨준 검색어·페이지가 있으면 그 목록으로 돌아갑니다.
  const from = location.state?.from;
  const listHref = from ? `/bbs?${from}` : '/bbs';
  const validId = /^\d+$/.test(id);

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(supabaseReady);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    // 숫자가 아닌 id 는 DB 에 물어볼 필요 없이 없는 글입니다.
    if (!validId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    supabase.from('posts').select('*, post_likes(count)').eq('id', id).maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(dbErrorText(err));
        else if (!data) setNotFound(true);
        else {
          const { post_likes, ...rest } = data;
          setPost(rest);
          setLikes(post_likes[0]?.count ?? 0);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, validId]);

  // 내가 좋아요를 눌렀는지는 로그인한 사용자에 따라 달라지므로 따로 가져옵니다.
  useEffect(() => {
    if (!supabase || !userId || !validId) return setLiked(false);
    let cancelled = false;
    supabase.from('post_likes').select('post_id').eq('post_id', id).eq('user_id', userId).maybeSingle()
      .then(({ data }) => { if (!cancelled) setLiked(Boolean(data)); });
    return () => { cancelled = true; };
  }, [id, validId, userId]);

  const toggleLike = async () => {
    if (!user) return navigate('/login');
    if (liking) return;
    const next = !liked;
    // 낙관적 업데이트: 응답을 기다리지 않고 화면부터 바꾸고, 실패하면 되돌립니다.
    setLiked(next);
    setLikes(n => n + (next ? 1 : -1));
    setLiking(true);
    setError('');
    const { error: err } = next
      ? await supabase.from('post_likes').insert({ post_id: post.id })
      : await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
    setLiking(false);
    if (!err) return;
    // 23505(기본키 중복): 다른 탭 등에서 이미 좋아요한 상태 → 표시는 맞고 개수만 한 번 더 센 것
    if (err.code === '23505') return setLikes(n => n - 1);
    setLiked(!next);
    setLikes(n => n + (next ? -1 : 1));
    setError(dbErrorText(err));
  };

  const update = async (t, c) => {
    setError('');
    const { data, error: err } = await supabase.from('posts')
      .update({ title: t, content: c, updated_at: new Date().toISOString() })
      .eq('id', post.id).select().single();
    if (err) return setError(dbErrorText(err));
    setPost(data);
    setEditing(false);
  };

  const remove = async () => {
    if (!confirm('이 글을 삭제할까요? 댓글과 좋아요도 함께 삭제됩니다.')) return;
    setError('');
    const { error: err } = await supabase.from('posts').delete().eq('id', post.id);
    if (err) return setError(dbErrorText(err));
    navigate(listHref, { replace: true });
  };

  return (
    <main className="app bbs">
      <header>
        <Link className="back" to={listHref}>← 목록</Link>
        <h1>자유게시판</h1>
      </header>

      {!supabaseReady ? (
        <p className="notice error">Supabase 설정이 없습니다. .env 파일에 URL과 키를 입력해주세요.</p>
      ) : loading ? (
        <p className="empty">불러오는 중…</p>
      ) : notFound ? (
        <div className="not-found">
          <p className="empty">글을 찾을 수 없습니다. 삭제되었거나 잘못된 주소예요.</p>
          <Link to="/bbs">자유게시판 목록으로</Link>
        </div>
      ) : (
        <>
          {error && <p className="notice error" role="alert">{error}</p>}
          {post && (
            <>
              <article className="post">
                {editing ? (
                  <PostEditor post={post} onSave={update} onCancel={() => setEditing(false)} />
                ) : (
                  <>
                    <h2 className="post-title">{post.title}</h2>
                    <div className="post-meta">
                      {post.author || '익명'} · {formatDate(post.created_at)}{post.updated_at && ' · 수정됨'}
                    </div>
                    <div className="post-content">{post.content}</div>
                    <div className="post-actions">
                      <button className={'like' + (liked ? ' on' : '')} onClick={toggleLike}
                        aria-pressed={liked} title={user ? '' : '로그인이 필요합니다'}>
                        {liked ? '♥' : '♡'} 좋아요 {likes}
                      </button>
                      {userId === post.user_id && (
                        <span className="owner-actions">
                          <button className="edit-btn" onClick={() => setEditing(true)}>수정</button>
                          <button className="del" onClick={remove}>삭제</button>
                        </span>
                      )}
                    </div>
                  </>
                )}
              </article>
              <Comments postId={post.id} />
            </>
          )}
        </>
      )}
    </main>
  );
}
