-- FLIMIX: багцад багтах кинонууд (Supabase SQL editor дээр ажиллуулна)
-- Багцад кино сонгосон бол тухайн багцын эрхтэй хэрэглэгч ЗӨВХӨН тэдгээр
-- киног үзнэ. Кино сонгоогүй (хоосон) багц бүх контентод эрх нээнэ.

create table if not exists public.plan_movies (
  plan_id uuid not null references public.subscription_plans(id) on delete cascade,
  movie_id uuid not null references public.movies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (plan_id, movie_id)
);

alter table public.plan_movies enable row level security;

drop policy if exists "public read plan movies" on public.plan_movies;
create policy "public read plan movies" on public.plan_movies
  for select using (true);
