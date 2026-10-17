import { createClient } from '@supabase/supabase-js';

// 프로젝트 루트의 .env 에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 를 넣어주세요. (.env.example 참고)
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseReady = Boolean(url && key);
export const supabase = supabaseReady ? createClient(url, key) : null;

// DB 에러를 화면에 보여줄 한국어 문장으로 바꿉니다.
export const dbErrorText = error => {
  if (error.code === 'PGRST205' || error.code === '42P01' || /schema cache|does not exist/i.test(error.message)) {
    return '테이블이 없습니다. Supabase SQL Editor 에서 supabase/schema.sql 을 실행해주세요.';
  }
  if (error.code === '42501' || /row-level security/i.test(error.message)) return '권한이 없습니다.';
  if (/failed to fetch/i.test(error.message)) return '서버에 연결할 수 없습니다. 네트워크를 확인해주세요.';
  return error.message;
};
