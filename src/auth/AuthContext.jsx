import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase.js';

const AuthContext = createContext({ user: null, loading: false });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const displayName = user =>
  user?.user_metadata?.nickname || user?.user_metadata?.full_name || user?.email || '';

// Supabase 에러 메시지를 한국어로 바꿔 보여줍니다.
const MESSAGES = {
  'User already registered': '이미 가입된 이메일입니다.',
  'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
  'Email not confirmed': '이메일 인증이 아직 완료되지 않았습니다. 메일함을 확인해주세요.',
};

export const authErrorText = error => {
  if (MESSAGES[error.message]) return MESSAGES[error.message];
  if (/password should be/i.test(error.message)) return '비밀번호는 6자 이상이어야 합니다.';
  if (/invalid format|is invalid/i.test(error.message)) return '이메일 형식이 올바르지 않습니다.';
  if (/rate limit/i.test(error.message)) return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
  if (/provider is not enabled/i.test(error.message)) return 'Supabase 에서 Google 로그인이 아직 켜져 있지 않습니다.';
  return error.message;
};
