create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  username text not null check (char_length(username) between 1 and 30),
  reel_url text not null check (char_length(reel_url) <= 500),
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  username text check (username is null or char_length(username) between 1 and 30),
  reel_url text check (reel_url is null or char_length(reel_url) <= 500),
  post text not null check (char_length(post) between 1 and 800),
  created_at timestamptz not null default now()
);

alter table public.posts add column if not exists username text;
alter table public.posts add column if not exists reel_url text;
