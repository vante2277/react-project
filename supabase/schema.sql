-- Supabase 대시보드 > SQL Editor 에 이 파일 내용을 붙여넣고 Run 하세요. (여러 번 실행해도 안전합니다)

-- ───────────── 게시판 ─────────────
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author text not null default '',
  title text not null check (char_length(title) between 1 and 100),
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.posts enable row level security;

-- 글 읽기는 누구나, 쓰기는 로그인한 사용자, 수정·삭제는 작성자 본인만
drop policy if exists "posts_select" on public.posts;
create policy "posts_select" on public.posts for select using (true);

drop policy if exists "posts_insert" on public.posts;
create policy "posts_insert" on public.posts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "posts_update" on public.posts;
create policy "posts_update" on public.posts for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "posts_delete" on public.posts;
create policy "posts_delete" on public.posts for delete to authenticated
  using (auth.uid() = user_id);

-- ───────────── To do ─────────────
create table if not exists public.todos (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 100),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists todos_user_id_idx on public.todos (user_id);

alter table public.todos enable row level security;

-- 할 일은 본인 것만 보고 관리
drop policy if exists "todos_own" on public.todos;
create policy "todos_own" on public.todos for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ───────────── 피식 (배치가 모으는 만화) ─────────────
-- 쓰기는 서버의 배치만 service_role 키로 합니다. (service_role 은 RLS 를 거치지 않으므로 쓰기 정책을 만들지 않음)
create table if not exists public.comics (
  id text primary key,
  date date not null unique,            -- 하루 1건 (배치 멱등성의 마지막 안전장치)
  num int not null,
  title text not null,
  alt text not null default '',
  img text not null,
  link text not null,
  published date,
  is_latest boolean not null default false,
  source text not null default 'xkcd',
  collected_at timestamptz not null default now()
);

alter table public.comics enable row level security;

drop policy if exists "comics_select" on public.comics;
create policy "comics_select" on public.comics for select using (true);

create table if not exists public.comic_batch_runs (
  id text primary key,
  trigger text not null,
  started_at timestamptz not null,
  status text not null check (status in ('success', 'skipped', 'failed')),
  message text not null default '',
  post_id text,
  duration_ms int
);

create index if not exists comic_batch_runs_started_at_idx on public.comic_batch_runs (started_at desc);

alter table public.comic_batch_runs enable row level security;

drop policy if exists "comic_batch_runs_select" on public.comic_batch_runs;
create policy "comic_batch_runs_select" on public.comic_batch_runs for select using (true);

-- 피식 한국어 번역 (제목·작가의 한마디). null 이면 다음 배치 실행이 보충합니다.
alter table public.comics add column if not exists title_ko text;
alter table public.comics add column if not exists alt_ko text;
