create table if not exists public.posts (id bigint generated always as identity primary key, user_id uuid not null default auth.uid() references auth.users (id) on delete cascade, author text not null default '', title text not null check (char_length(title) between 1 and 100), content text not null check (char_length(content) between 1 and 2000), created_at timestamptz not null default now(), updated_at timestamptz);

alter table public.posts enable row level security;

drop policy if exists "posts_select" on public.posts;

create policy "posts_select" on public.posts for select using (true);

drop policy if exists "posts_insert" on public.posts;

create policy "posts_insert" on public.posts for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "posts_update" on public.posts;

create policy "posts_update" on public.posts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "posts_delete" on public.posts;

create policy "posts_delete" on public.posts for delete to authenticated using (auth.uid() = user_id);

notify pgrst, 'reload schema';

select table_name from information_schema.tables where table_schema = 'public' and table_name in ('posts', 'todos');
