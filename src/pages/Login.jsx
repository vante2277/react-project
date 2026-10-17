import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { supabase, supabaseReady } from '../supabase.js';
import { useAuth, authErrorText } from '../auth/AuthContext.jsx';
import GoogleButton from '../auth/GoogleButton.jsx';
import '../styles/auth.css';

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async e => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) return setError(authErrorText(err));
    navigate('/', { replace: true });
  };

  return (
    <main className="app auth">
      <header>
        <Link className="back" to="/">← 홈</Link>
        <h1>로그인</h1>
      </header>

      {!supabaseReady ? (
        <p className="notice error">Supabase 설정이 없습니다. .env 파일에 URL과 키를 입력해주세요.</p>
      ) : (
        <>
        <form className="auth-form" onSubmit={submit}>
          <label>
            이메일
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email" required />
          </label>
          <label>
            비밀번호
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="current-password" required />
          </label>
          {error && <p className="notice error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button>
          <p className="switch">계정이 없나요? <Link to="/signup">회원가입</Link></p>
        </form>
        <GoogleButton />
        </>
      )}
    </main>
  );
}
