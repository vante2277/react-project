import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, supabaseReady, dbErrorText } from '../supabase.js';
import { useAuth } from '../auth/AuthContext.jsx';
import '../styles/todo.css';

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '진행 중' },
  { key: 'done', label: '완료' },
];

function TodoItem({ todo, onToggle, onEdit, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);
  const finished = useRef(false);

  const start = () => {
    finished.current = false;
    setDraft(todo.text);
    setEditing(true);
  };

  const finish = ok => {
    if (finished.current) return;
    finished.current = true;
    const v = draft.trim();
    if (ok && v && v !== todo.text) onEdit(v);
    else setDraft(todo.text);
    setEditing(false);
  };

  return (
    <li className={'item' + (todo.done ? ' done' : '')}>
      <input type="checkbox" checked={todo.done} onChange={e => onToggle(e.target.checked)} />
      {editing ? (
        <input className="edit" value={draft} maxLength={100} autoFocus
          onChange={e => setDraft(e.target.value)}
          onBlur={() => finish(true)}
          onKeyDown={e => {
            if (e.key === 'Enter') finish(true);
            if (e.key === 'Escape') finish(false);
          }} />
      ) : (
        <span className="text" title="더블클릭하여 수정"
          onDoubleClick={start}>
          {todo.text}
        </span>
      )}
      <button className="del" aria-label="삭제" onClick={onRemove}>✕</button>
    </li>
  );
}

function TodoList({ userId }) {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    supabase.from('todos').select('*').order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(dbErrorText(err));
        else setTodos(data);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  const shown = todos.filter(t => filter === 'all' || (filter === 'done' ? t.done : !t.done));
  const left = todos.filter(t => !t.done).length;

  // 화면을 먼저 바꾸고, 저장에 실패하면 되돌립니다.
  const patch = async (id, changes) => {
    const before = todos;
    setError('');
    setTodos(prev => prev.map(t => (t.id === id ? { ...t, ...changes } : t)));
    const { error: err } = await supabase.from('todos').update(changes).eq('id', id);
    if (err) {
      setTodos(before);
      setError(dbErrorText(err));
    }
  };

  const removeIds = async ids => {
    if (!ids.length) return;
    const before = todos;
    setError('');
    setTodos(prev => prev.filter(t => !ids.includes(t.id)));
    const { error: err } = await supabase.from('todos').delete().in('id', ids);
    if (err) {
      setTodos(before);
      setError(dbErrorText(err));
    }
  };

  const submit = async e => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setBusy(true);
    setError('');
    const { data, error: err } = await supabase.from('todos').insert({ text }).select().single();
    setBusy(false);
    if (err) return setError(dbErrorText(err));
    setTodos(prev => [data, ...prev]);
    setInput('');
  };

  return (
    <>
      <form className="add" onSubmit={submit}>
        <input type="text" placeholder="할 일을 입력하세요" autoComplete="off" maxLength={100} required
          value={input} onChange={e => setInput(e.target.value)} />
        <button type="submit" disabled={busy}>추가</button>
      </form>

      {error && <p className="notice error" role="alert">{error}</p>}

      <nav className="filters">
        {FILTERS.map(f => (
          <button key={f.key} className={'filter' + (filter === f.key ? ' active' : '')}
            onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </nav>

      <ul className="list">
        {loading && <li className="empty">불러오는 중…</li>}
        {!loading && !shown.length && <li className="empty">할 일이 없습니다</li>}
        {shown.map(t => (
          <TodoItem key={t.id} todo={t}
            onToggle={done => patch(t.id, { done })}
            onEdit={text => patch(t.id, { text })}
            onRemove={() => removeIds([t.id])} />
        ))}
      </ul>

      <footer>
        <span>남은 할 일 {left}개</span>
        <button className="link" onClick={() => removeIds(todos.filter(t => t.done).map(t => t.id))}>
          완료 항목 삭제
        </button>
      </footer>
    </>
  );
}

export default function Todo() {
  const { user, loading } = useAuth();

  return (
    <main className="app todo">
      <header>
        <Link className="back" to="/">← 홈</Link>
        <h1>To do list</h1>
        <p className="storage">저장 위치: Supabase (내 계정)</p>
      </header>

      {!supabaseReady ? (
        <p className="notice error">Supabase 설정이 없습니다. .env 파일에 URL과 키를 입력해주세요.</p>
      ) : loading ? null : user ? (
        <TodoList key={user.id} userId={user.id} />
      ) : (
        <p className="notice">할 일을 관리하려면 <Link to="/login">로그인</Link>이 필요합니다.</p>
      )}
    </main>
  );
}
