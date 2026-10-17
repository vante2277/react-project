import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { supabase, supabaseReady } from '../supabase.js';
import { useAuth, authErrorText } from '../auth/AuthContext.jsx';
import GoogleButton from '../auth/GoogleButton.jsx';
import '../styles/auth.css';

export default function Signup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nickname: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const change = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) return setError('비밀번호는 6자 이상이어야 합니다.');
    if (form.password !== form.confirm) return setError('비밀번호가 서로 일치하지 않습니다.');

    setBusy(true);
    const email = form.email.trim();
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: {
        data: { nickname: form.nickname.trim() },
        emailRedirectTo: window.location.origin,
      },
    });
    setBusy(false);

    if (err) return setError(authErrorText(err));
    // 이메일 인증을 켜둔 경우, 이미 가입된 이메일이면 에러 대신 identities 가 빈 사용자를 돌려줍니다.
    if (data.user?.identities?.length === 0) return setError('이미 가입된 이메일입니다.');
    // 이메일 인증이 꺼져 있으면 바로 로그인되므로 홈으로 이동합니다.
    if (data.session) return navigate('/', { replace: true });
    setSentTo(email);
  };

  return (
    <main className="app auth">
      <header>
        <Link className="back" to="/">← 홈</Link>
        <h1>회원가입</h1>
      </header>

      {!supabaseReady ? (
        <p className="notice error">Supabase 설정이 없습니다. .env 파일에 URL과 키를 입력해주세요.</p>
      ) : sentTo ? (
        <div className="notice success">
          <strong>{sentTo}</strong> 으로 인증 메일을 보냈습니다.<br />
          메일의 링크를 누르면 가입이 완료됩니다.
          <Link className="link" to="/login">로그인하러 가기</Link>
        </div>
      ) : (
        <>
        <form className="auth-form" onSubmit={submit}>
          <label>
            닉네임
            <input name="nickname" value={form.nickname} onChange={change}
              maxLength={20} autoComplete="nickname" required />
          </label>
          <label>
            이메일
            <input name="email" type="email" value={form.email} onChange={change}
              autoComplete="email" required />
          </label>
          <label>
            비밀번호
            <input name="password" type="password" value={form.password} onChange={change}
              placeholder="6자 이상" autoComplete="new-password" required />
          </label>
          <label>
            비밀번호 확인
            <input name="confirm" type="password" value={form.confirm} onChange={change}
              autoComplete="new-password" required />
          </label>
          {error && <p className="notice error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? '가입 중…' : '가입하기'}</button>
          <p className="switch">이미 계정이 있나요? <Link to="/login">로그인</Link></p>
        </form>
        <GoogleButton />
        </>
      )}
    </main>
  );
}
