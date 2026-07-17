-- FLIMIX: киноны түрээс (Supabase SQL editor дээр ажиллуулна)
-- Олон удаа ажиллуулж болно (if not exists / on conflict хамгаалалттай).

-- 1) movies: түрээсийн үнэ (null = түрээсгүй, багцын эрхээр үзнэ)
alter table public.movies
  add column if not exists rental_price_mnt integer,
  add column if not exists rental_hours integer not null default 48;

-- 2) Түрээсийн бүртгэл: төлбөр баталгаажсаны дараа сервер талд бичигдэнэ.
create table if not exists public.movie_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id uuid not null references public.movies(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  amount_mnt integer not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists movie_purchases_user_movie_idx
  on public.movie_purchases (user_id, movie_id, expires_at desc);

alter table public.movie_purchases enable row level security;

-- Хэрэглэгч зөвхөн өөрийн түрээсийг харна; бичилт зөвхөн service role-оор.
drop policy if exists "own purchases read" on public.movie_purchases;
create policy "own purchases read" on public.movie_purchases
  for select using ((select auth.uid()) = user_id);
