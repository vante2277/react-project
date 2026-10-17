import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MENUS } from '../menus.js';
import { supabase } from '../supabase.js';
import { useAuth, displayName } from '../auth/AuthContext.jsx';
import '../styles/home.css';

const formatNow = () => new Date().toLocaleString('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  hour: '2-digit', minute: '2-digit',
});

export default function Home() {
  const [now, setNow] = useState(formatNow);
  const { user, loading } = useAuth();

  useEffect(() => {
    const id = setInterval(() => setNow(formatNow()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="home">
      {!loading && (
        <div className="account">
          {user ? (
            <>
              <span>{displayName(user)} 님</span>
              <button onClick={() => supabase.auth.signOut()}>로그아웃</button>
            </>
          ) : (
            <>
              <Link to="/login">로그인</Link>
              <Link className="primary" to="/signup">회원가입</Link>
            </>
          )}
        </div>
      )}

      <header className="hero">
        <h1>Daily Hub</h1>
        <p>매일 쓰는 작은 도구들을 한 곳에서</p>
        <div className="clock">{now}</div>
      </header>

      <nav aria-label="메인 메뉴">
        <ul className="menu">
          {MENUS.map(m => {
            const body = (
              <>
                <span className="icon" style={{ background: m.color }}>{m.icon}</span>
                <h2>{m.title}{m.href && <span className="external" aria-label="새 탭에서 열림"> ↗</span>}</h2>
                <p>{m.desc}</p>
              </>
            );
            return (
              <li key={m.path || m.href}>
                {m.href ? (
                  <a className="card" href={m.href} target="_blank" rel="noopener noreferrer">{body}</a>
                ) : (
                  <Link className="card" to={m.path}>{body}</Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <footer>© Daily Hub</footer>
    </div>
  );
}
