create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  username text not null check (char_length(username) between 1 and 30),
  reel_url text not null check (char_length(reel_url) <= 500),
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  post text not null check (char_length(post) between 1 and 800),
  created_at timestamptz not null default now()
);

alter table public.submissions enable row level security;
alter table public.posts enable row level security;

revoke all on public.submissions, public.posts from anon, authenticated;
grant all on public.submissions, public.posts to service_role;
