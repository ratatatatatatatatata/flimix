-- ============================================================
-- FLIMIX 0003 — users & engagement
-- profiles, user_roles, favorites, watch_progress,
-- watch_sessions, user_devices, notifications
-- ============================================================

-- ---------- profiles (one or more viewing profiles per auth user) ----------

create table public.profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  display_name      text not null,
  avatar_url        text,
  birth_date        date,
  is_child_profile  boolean not null default false,
  created_at        timestamptz not null default now()
);

create index idx_profiles_user on public.profiles (user_id);

-- ---------- user_roles (RBAC; a user may hold several roles) ----------

create table public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        public.user_role not null default 'user',
  granted_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (user_id, role)
);

create index idx_user_roles_user on public.user_roles (user_id);

-- ---------- user devices ----------

create table public.user_devices (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  device_name     text not null,
  device_type     public.device_type not null default 'web',
  user_agent      text,
  last_active_at  timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index idx_user_devices_user on public.user_devices (user_id);

-- ---------- favorites (exactly one of movie_id / series_id) ----------

create table public.favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  movie_id    uuid references public.movies(id) on delete cascade,
  series_id   uuid references public.series(id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- polymorphic favorite must reference exactly one content row
  constraint favorites_exactly_one_target
    check ((movie_id is not null)::int + (series_id is not null)::int = 1)
);

-- one favorite per user per content item
create unique index uq_favorites_user_movie  on public.favorites (user_id, movie_id)  where movie_id  is not null;
create unique index uq_favorites_user_series on public.favorites (user_id, series_id) where series_id is not null;
create index idx_favorites_user on public.favorites (user_id, created_at desc);

-- ---------- watch progress ----------

create table public.watch_progress (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  profile_id        uuid references public.profiles(id) on delete set null,
  content_type      public.content_type not null,
  content_id        uuid not null, -- movies.id or episodes.id (polymorphic)
  progress_seconds  integer not null default 0 check (progress_seconds >= 0),
  duration_seconds  integer not null default 0 check (duration_seconds >= 0),
  completed         boolean not null default false,
  last_watched_at   timestamptz not null default now(),
  unique (user_id, content_type, content_id)
);

create index idx_watch_progress_user_last on public.watch_progress (user_id, last_watched_at desc);

-- ---------- watch sessions (concurrency / stream_limit enforcement) ----------

create table public.watch_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  profile_id    uuid references public.profiles(id) on delete set null,
  device_id     uuid references public.user_devices(id) on delete set null,
  content_type  public.content_type not null,
  content_id    uuid not null,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  ip_hash       text,
  status        public.watch_session_status not null default 'active'
);

create index idx_watch_sessions_user_active on public.watch_sessions (user_id, status);
create index idx_watch_sessions_started     on public.watch_sessions (started_at desc);

-- ---------- notifications ----------

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title_mn    text not null,
  body_mn     text,
  type        public.notification_type not null default 'system',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index idx_notifications_user on public.notifications (user_id, created_at desc);
