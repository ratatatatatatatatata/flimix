-- ============================================================
-- 0001_extensions_and_types.sql
-- ============================================================
-- ============================================================
-- FLIMIX 0001 — extensions & enum types
-- ============================================================

-- gen_random_uuid() lives in pgcrypto (pre-installed on Supabase).
create extension if not exists pgcrypto;
-- Trigram search over titles (title_mn / title_en / original_title).
create extension if not exists pg_trgm;

-- ---------- enums (mirror src/types/db.ts) ----------

create type public.user_role as enum ('user', 'content_manager', 'admin', 'super_admin');

create type public.content_status as enum ('draft', 'scheduled', 'published', 'unpublished', 'archived');

-- Playable content (video-bearing): movies and episodes.
create type public.content_type as enum ('movie', 'episode');

-- Catalog-level content (favorites, rights, homepage items): movies and series.
create type public.catalog_content_type as enum ('movie', 'series');

create type public.age_rating as enum ('G', 'PG', 'PG-13', 'R', 'NC-17');

create type public.subscription_status as enum ('trial', 'active', 'past_due', 'cancelled', 'expired');

create type public.payment_status as enum ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'expired');

create type public.payment_provider as enum ('qpay', 'socialpay', 'bank_transfer', 'manual');

create type public.rights_approval_status as enum ('pending', 'approved', 'rejected');

create type public.video_provider as enum ('bunny', 'cloudflare', 'aws', 'mock');

create type public.video_asset_status as enum ('processing', 'ready', 'failed');

create type public.watch_session_status as enum ('active', 'ended', 'terminated');

create type public.device_type as enum ('web', 'mobile', 'tablet', 'tv', 'other');

create type public.notification_type as enum ('system', 'payment', 'content', 'subscription');

create type public.homepage_layout as enum ('hero', 'row', 'grid', 'banner');

create type public.homepage_query_type as enum ('manual', 'auto');

-- Two-state publish status used by homepage_sections.
create type public.publish_status as enum ('draft', 'published');

-- ============================================================
-- 0002_core_content.sql
-- ============================================================
-- ============================================================
-- FLIMIX 0002 — core content catalog
-- lookup tables, movies, series, seasons, episodes, people,
-- junctions, video assets, subtitle/audio tracks
-- ============================================================

-- ---------- lookups ----------

create table public.genres (
  id       uuid primary key default gen_random_uuid(),
  slug     text not null unique,
  name_mn  text not null,
  name_en  text not null
);

create table public.countries (
  id       uuid primary key default gen_random_uuid(),
  code     text not null unique check (code = upper(code) and length(code) = 2), -- ISO 3166-1 alpha-2
  name_mn  text not null,
  name_en  text not null
);

create table public.languages (
  id       uuid primary key default gen_random_uuid(),
  code     text not null unique check (code = lower(code) and length(code) = 2), -- ISO 639-1
  name_mn  text not null,
  name_en  text not null
);

-- ---------- video assets (referenced by movies/episodes) ----------

create table public.video_assets (
  id                 uuid primary key default gen_random_uuid(),
  provider           public.video_provider not null,
  provider_video_id  text not null,
  hls_path           text not null, -- playlist path relative to CDN host, unsigned
  qualities          text[] not null default '{}',
  duration_seconds   integer check (duration_seconds is null or duration_seconds >= 0),
  status             public.video_asset_status not null default 'processing',
  created_at         timestamptz not null default now()
);

-- ---------- movies ----------

create table public.movies (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  title_mn           text not null,
  title_en           text,
  original_title     text,
  description_mn     text,
  description_en     text,
  release_year       integer check (release_year is null or release_year between 1900 and 2100),
  duration_seconds   integer check (duration_seconds is null or duration_seconds >= 0),
  age_rating         public.age_rating,
  country_id         uuid references public.countries(id) on delete set null,
  poster_url         text,
  backdrop_url       text,
  trailer_url        text,
  playback_asset_id  uuid references public.video_assets(id) on delete set null,
  popularity         numeric not null default 0,
  rating             numeric(3,1) check (rating is null or (rating >= 0 and rating <= 10)),
  is_free            boolean not null default false,
  status             public.content_status not null default 'draft',
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz -- soft delete
);

-- ---------- series / seasons / episodes ----------

create table public.series (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  title_mn           text not null,
  title_en           text,
  original_title     text,
  description_mn     text,
  description_en     text,
  release_year       integer check (release_year is null or release_year between 1900 and 2100),
  age_rating         public.age_rating,
  country_id         uuid references public.countries(id) on delete set null,
  poster_url         text,
  backdrop_url       text,
  trailer_url        text,
  popularity         numeric not null default 0,
  rating             numeric(3,1) check (rating is null or (rating >= 0 and rating <= 10)),
  status             public.content_status not null default 'draft',
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz -- soft delete
);

create table public.seasons (
  id             uuid primary key default gen_random_uuid(),
  series_id      uuid not null references public.series(id) on delete cascade,
  season_number  integer not null check (season_number >= 0),
  title          text,
  description    text,
  created_at     timestamptz not null default now(),
  unique (series_id, season_number)
);

create table public.episodes (
  id                    uuid primary key default gen_random_uuid(),
  season_id             uuid not null references public.seasons(id) on delete cascade,
  episode_number        integer not null check (episode_number >= 0),
  title_mn              text not null,
  title_en              text,
  description_mn        text,
  duration_seconds      integer check (duration_seconds is null or duration_seconds >= 0),
  poster_url            text,
  playback_asset_id     uuid references public.video_assets(id) on delete set null,
  intro_start_seconds   integer check (intro_start_seconds is null or intro_start_seconds >= 0),
  intro_end_seconds     integer check (intro_end_seconds is null or intro_end_seconds >= 0),
  status                public.content_status not null default 'draft',
  published_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (season_id, episode_number)
);

-- ---------- people ----------

create table public.cast_members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  photo_url  text
);

create table public.crew_members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text not null, -- director, producer, writer...
  photo_url  text
);

-- ---------- junctions ----------

create table public.movie_genres (
  movie_id  uuid not null references public.movies(id) on delete cascade,
  genre_id  uuid not null references public.genres(id) on delete cascade,
  primary key (movie_id, genre_id)
);

create table public.series_genres (
  series_id  uuid not null references public.series(id) on delete cascade,
  genre_id   uuid not null references public.genres(id) on delete cascade,
  primary key (series_id, genre_id)
);

create table public.movie_cast (
  movie_id        uuid not null references public.movies(id) on delete cascade,
  cast_member_id  uuid not null references public.cast_members(id) on delete cascade,
  character_name  text,
  sort_order      integer not null default 0,
  primary key (movie_id, cast_member_id)
);

create table public.series_cast (
  series_id       uuid not null references public.series(id) on delete cascade,
  cast_member_id  uuid not null references public.cast_members(id) on delete cascade,
  character_name  text,
  sort_order      integer not null default 0,
  primary key (series_id, cast_member_id)
);

-- ---------- subtitle & audio tracks (polymorphic: movie | episode) ----------

create table public.subtitle_tracks (
  id            uuid primary key default gen_random_uuid(),
  content_type  public.content_type not null,
  content_id    uuid not null, -- movies.id or episodes.id (no FK: polymorphic)
  language_id   uuid not null references public.languages(id) on delete cascade,
  label         text not null,
  url           text not null,
  is_default    boolean not null default false,
  unique (content_type, content_id, language_id)
);

create table public.audio_tracks (
  id            uuid primary key default gen_random_uuid(),
  content_type  public.content_type not null,
  content_id    uuid not null, -- movies.id or episodes.id (no FK: polymorphic)
  language_id   uuid not null references public.languages(id) on delete cascade,
  label         text not null,
  unique (content_type, content_id, language_id)
);

-- ---------- indexes ----------

-- catalog filters
create index idx_movies_status_published_at on public.movies (status, published_at desc) where deleted_at is null;
create index idx_movies_release_year        on public.movies (release_year);
create index idx_movies_country             on public.movies (country_id);
create index idx_movies_popularity          on public.movies (popularity desc) where deleted_at is null;
create index idx_series_status_published_at on public.series (status, published_at desc) where deleted_at is null;
create index idx_series_release_year        on public.series (release_year);
create index idx_series_country             on public.series (country_id);
create index idx_seasons_series             on public.seasons (series_id);
create index idx_episodes_season            on public.episodes (season_id);

-- junction FKs (reverse lookups)
create index idx_movie_genres_genre  on public.movie_genres (genre_id);
create index idx_series_genres_genre on public.series_genres (genre_id);
create index idx_movie_cast_member   on public.movie_cast (cast_member_id);
create index idx_series_cast_member  on public.series_cast (cast_member_id);

-- polymorphic track lookups
create index idx_subtitle_tracks_content on public.subtitle_tracks (content_type, content_id);
create index idx_audio_tracks_content    on public.audio_tracks (content_type, content_id);

-- trigram search over titles
create index idx_movies_title_mn_trgm       on public.movies using gin (title_mn gin_trgm_ops);
create index idx_movies_title_en_trgm       on public.movies using gin (title_en gin_trgm_ops);
create index idx_movies_original_title_trgm on public.movies using gin (original_title gin_trgm_ops);
create index idx_series_title_mn_trgm       on public.series using gin (title_mn gin_trgm_ops);
create index idx_series_title_en_trgm       on public.series using gin (title_en gin_trgm_ops);
create index idx_series_original_title_trgm on public.series using gin (original_title gin_trgm_ops);

-- ============================================================
-- 0003_users_and_engagement.sql
-- ============================================================
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

-- ============================================================
-- 0004_subscriptions_payments.sql
-- ============================================================
-- ============================================================
-- FLIMIX 0004 — subscriptions & payments
-- subscription_plans, subscriptions, payments,
-- payment_attempts, promo_codes
-- ============================================================

-- ---------- plans ----------

create table public.subscription_plans (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name_mn        text not null,
  name_en        text not null,
  price_mnt      integer not null check (price_mnt >= 0),
  duration_days  integer not null check (duration_days > 0),
  device_limit   integer not null default 1 check (device_limit > 0),
  stream_limit   integer not null default 1 check (stream_limit > 0),
  trial_days     integer not null default 0 check (trial_days >= 0),
  features_mn    text[] not null default '{}',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ---------- subscriptions ----------

create table public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  plan_id             uuid not null references public.subscription_plans(id) on delete restrict,
  status              public.subscription_status not null default 'trial',
  started_at          timestamptz not null default now(),
  current_period_end  timestamptz not null,
  cancelled_at        timestamptz,
  created_at          timestamptz not null default now()
);

create index idx_subscriptions_user_status on public.subscriptions (user_id, status);
create index idx_subscriptions_period_end  on public.subscriptions (current_period_end);

-- ---------- payments ----------

create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  subscription_id  uuid references public.subscriptions(id) on delete set null,
  provider         public.payment_provider not null,
  external_id      text, -- provider-side invoice/transaction id
  amount_mnt       integer not null check (amount_mnt >= 0),
  status           public.payment_status not null default 'pending',
  paid_at          timestamptz,
  receipt_number   text,
  created_at       timestamptz not null default now()
);

-- idempotent webhook processing: one payment per provider transaction
create unique index uq_payments_provider_external
  on public.payments (provider, external_id) where external_id is not null;
create index idx_payments_user on public.payments (user_id, created_at desc);
create index idx_payments_status on public.payments (status) where status = 'pending';

-- ---------- payment attempts (provider request/response audit trail) ----------

create table public.payment_attempts (
  id                uuid primary key default gen_random_uuid(),
  payment_id        uuid not null references public.payments(id) on delete cascade,
  provider          public.payment_provider not null,
  request_payload   jsonb,
  response_payload  jsonb,
  status            public.payment_status not null default 'pending',
  error_message     text,
  created_at        timestamptz not null default now()
);

create index idx_payment_attempts_payment on public.payment_attempts (payment_id);

-- ---------- promo codes ----------

create table public.promo_codes (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique check (code = upper(code)),
  discount_percent  integer check (discount_percent is null or (discount_percent between 1 and 100)),
  bonus_days        integer check (bonus_days is null or bonus_days > 0),
  max_uses          integer check (max_uses is null or max_uses > 0),
  used_count        integer not null default 0 check (used_count >= 0),
  valid_from        timestamptz not null default now(),
  valid_until       timestamptz,
  is_active         boolean not null default true,
  -- a promo must grant something
  constraint promo_codes_has_benefit check (discount_percent is not null or bonus_days is not null)
);

-- ============================================================
-- 0005_rights_and_admin.sql
-- ============================================================
-- ============================================================
-- FLIMIX 0005 — rights management, partners, homepage & admin
-- content_partners, content_rights, content_right_documents,
-- partner_revenue_shares, homepage_sections,
-- homepage_section_items, audit_logs, admin_notes
-- ============================================================

-- ---------- content partners ----------

create table public.content_partners (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  contact_email  text,
  contact_phone  text,
  created_at     timestamptz not null default now()
);

-- ---------- content rights (licensing windows per movie/series) ----------

create table public.content_rights (
  id                     uuid primary key default gen_random_uuid(),
  content_type           public.catalog_content_type not null,
  content_id             uuid not null, -- movies.id or series.id (polymorphic)
  partner_id             uuid references public.content_partners(id) on delete set null,
  rights_owner           text not null,
  contract_number        text,
  rights_start           date not null,
  rights_end             date not null,
  allowed_countries      text[] not null default '{}', -- ISO country codes; empty = worldwide
  allowed_platforms      text[] not null default '{}', -- ["web","mobile","tv"]; empty = all
  is_exclusive           boolean not null default false,
  revenue_share_percent  numeric(5,2) check (revenue_share_percent is null or (revenue_share_percent between 0 and 100)),
  approval_status        public.rights_approval_status not null default 'pending',
  admin_notes            text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint content_rights_valid_window check (rights_end >= rights_start)
);

create index idx_content_rights_content on public.content_rights (content_type, content_id);
create index idx_content_rights_partner on public.content_rights (partner_id);
-- expiry warnings dashboard: "rights ending soon"
create index idx_content_rights_end on public.content_rights (rights_end) where approval_status = 'approved';

-- ---------- rights supporting documents ----------

create table public.content_right_documents (
  id                uuid primary key default gen_random_uuid(),
  content_right_id  uuid not null references public.content_rights(id) on delete cascade,
  file_name         text not null,
  file_url          text not null,
  uploaded_by       uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index idx_right_documents_right on public.content_right_documents (content_right_id);

-- ---------- partner revenue shares (periodic settlement rows) ----------

create table public.partner_revenue_shares (
  id                 uuid primary key default gen_random_uuid(),
  partner_id         uuid not null references public.content_partners(id) on delete cascade,
  period_start       date not null,
  period_end         date not null,
  gross_revenue_mnt  bigint not null default 0 check (gross_revenue_mnt >= 0),
  share_percent      numeric(5,2) not null check (share_percent between 0 and 100),
  share_amount_mnt   bigint not null default 0 check (share_amount_mnt >= 0),
  is_settled         boolean not null default false,
  settled_at         timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),
  unique (partner_id, period_start, period_end),
  constraint revenue_share_valid_period check (period_end >= period_start)
);

-- ---------- homepage curation ----------

create table public.homepage_sections (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  title_mn           text not null,
  layout             public.homepage_layout not null default 'row',
  query_type         public.homepage_query_type not null default 'manual',
  auto_query         jsonb, -- e.g. {"type":"newest"} | {"type":"country","country":"MN"}
  sort_order         integer not null default 0,
  visible_from       timestamptz,
  visible_until      timestamptz,
  device_visibility  text[] not null default '{web,mobile,tv}',
  status             public.publish_status not null default 'draft',
  created_at         timestamptz not null default now(),
  -- auto sections must define a query; manual sections must not
  constraint homepage_sections_query_shape
    check ((query_type = 'auto' and auto_query is not null) or (query_type = 'manual' and auto_query is null))
);

create index idx_homepage_sections_order on public.homepage_sections (status, sort_order);

create table public.homepage_section_items (
  id            uuid primary key default gen_random_uuid(),
  section_id    uuid not null references public.homepage_sections(id) on delete cascade,
  content_type  public.catalog_content_type not null,
  content_id    uuid not null, -- movies.id or series.id (polymorphic)
  sort_order    integer not null default 0,
  unique (section_id, content_type, content_id)
);

create index idx_homepage_items_section on public.homepage_section_items (section_id, sort_order);

-- ---------- audit logs (append-only; written by service role) ----------

create table public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references auth.users(id) on delete set null,
  action       text not null,      -- e.g. "movie.update", "rights.approve"
  entity_type  text not null,      -- table / domain entity name
  entity_id    text,               -- stringified PK of the affected row
  details      jsonb,
  ip_hash      text,
  created_at   timestamptz not null default now()
);

create index idx_audit_logs_actor  on public.audit_logs (actor_id, created_at desc);
create index idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);

-- ---------- admin notes (free-form internal notes on any entity) ----------

create table public.admin_notes (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,
  entity_id    uuid not null,
  author_id    uuid references auth.users(id) on delete set null,
  note         text not null,
  created_at   timestamptz not null default now()
);

create index idx_admin_notes_entity on public.admin_notes (entity_type, entity_id);

-- ============================================================
-- 0006_functions_triggers.sql
-- ============================================================
-- ============================================================
-- FLIMIX 0006 — helper functions & triggers
-- (created BEFORE 0007 because RLS policies depend on them)
-- ============================================================

-- ---------- role hierarchy helper ----------
-- user < content_manager < admin < super_admin
-- SECURITY DEFINER so it can read user_roles regardless of the
-- caller's RLS context (avoids recursive policy evaluation).

create or replace function public.role_rank(r public.user_role)
returns integer
language sql
immutable
as $$
  select case r
    when 'user'            then 1
    when 'content_manager' then 2
    when 'admin'           then 3
    when 'super_admin'     then 4
  end;
$$;

create or replace function public.has_role(uid uuid, min_role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = uid
      and public.role_rank(ur.role) >= public.role_rank(min_role)
  );
$$;

-- ---------- active-subscriber helper ----------

create or replace function public.is_subscriber(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = uid
      and s.status in ('trial', 'active')
      and s.current_period_end > now()
  );
$$;

-- Lock helpers down: callable by API roles, not writable paths.
revoke all on function public.has_role(uuid, public.user_role) from public;
revoke all on function public.is_subscriber(uuid) from public;
grant execute on function public.role_rank(public.user_role) to anon, authenticated, service_role;
grant execute on function public.has_role(uuid, public.user_role) to anon, authenticated, service_role;
grant execute on function public.is_subscriber(uuid) to anon, authenticated, service_role;

-- ---------- updated_at maintenance ----------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_movies_updated_at
  before update on public.movies
  for each row execute function public.set_updated_at();

create trigger trg_series_updated_at
  before update on public.series
  for each row execute function public.set_updated_at();

create trigger trg_episodes_updated_at
  before update on public.episodes
  for each row execute function public.set_updated_at();

create trigger trg_content_rights_updated_at
  before update on public.content_rights
  for each row execute function public.set_updated_at();

-- ---------- new auth user bootstrap ----------
-- Creates a default viewing profile and the base 'user' role
-- for every new auth.users row.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, 'user'), '@', 1)
    )
  );

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 0007_rls_policies.sql
-- ============================================================
-- ============================================================
-- FLIMIX 0007 — Row Level Security
--
-- Access model:
--   anon / authenticated .... published catalog + own rows
--   content_manager ......... full CRUD on content tables
--   admin / super_admin ..... everything (business + audit read)
--   service_role ............ bypasses RLS entirely (webhooks,
--                             seed, audit_logs INSERT, payments)
-- ============================================================

-- ---------- enable RLS on every table ----------

alter table public.genres                  enable row level security;
alter table public.countries               enable row level security;
alter table public.languages               enable row level security;
alter table public.video_assets            enable row level security;
alter table public.movies                  enable row level security;
alter table public.series                  enable row level security;
alter table public.seasons                 enable row level security;
alter table public.episodes                enable row level security;
alter table public.cast_members            enable row level security;
alter table public.crew_members            enable row level security;
alter table public.movie_genres            enable row level security;
alter table public.series_genres           enable row level security;
alter table public.movie_cast              enable row level security;
alter table public.series_cast             enable row level security;
alter table public.subtitle_tracks         enable row level security;
alter table public.audio_tracks            enable row level security;
alter table public.profiles                enable row level security;
alter table public.user_roles              enable row level security;
alter table public.user_devices            enable row level security;
alter table public.favorites               enable row level security;
alter table public.watch_progress          enable row level security;
alter table public.watch_sessions          enable row level security;
alter table public.notifications           enable row level security;
alter table public.subscription_plans      enable row level security;
alter table public.subscriptions           enable row level security;
alter table public.payments                enable row level security;
alter table public.payment_attempts        enable row level security;
alter table public.promo_codes             enable row level security;
alter table public.content_partners        enable row level security;
alter table public.content_rights          enable row level security;
alter table public.content_right_documents enable row level security;
alter table public.partner_revenue_shares  enable row level security;
alter table public.homepage_sections       enable row level security;
alter table public.homepage_section_items  enable row level security;
alter table public.audit_logs              enable row level security;
alter table public.admin_notes             enable row level security;

-- ============================================================
-- PUBLIC CATALOG (anon + authenticated, read-only)
-- ============================================================

-- lookup tables are harmless: fully readable
create policy "public read genres"    on public.genres    for select using (true);
create policy "public read countries" on public.countries for select using (true);
create policy "public read languages" on public.languages for select using (true);
create policy "public read cast"      on public.cast_members for select using (true);
create policy "public read crew"      on public.crew_members for select using (true);

-- published, non-deleted titles only
create policy "public read published movies" on public.movies
  for select using (status = 'published' and deleted_at is null);

create policy "public read published series" on public.series
  for select using (status = 'published' and deleted_at is null);

-- seasons/episodes visible only when the parent series is published
create policy "public read seasons of published series" on public.seasons
  for select using (
    exists (
      select 1 from public.series sr
      where sr.id = seasons.series_id
        and sr.status = 'published' and sr.deleted_at is null
    )
  );

create policy "public read published episodes" on public.episodes
  for select using (
    episodes.status = 'published'
    and exists (
      select 1
      from public.seasons se
      join public.series sr on sr.id = se.series_id
      where se.id = episodes.season_id
        and sr.status = 'published' and sr.deleted_at is null
    )
  );

-- junction rows follow the published state of their parent title
create policy "public read movie_genres" on public.movie_genres
  for select using (
    exists (select 1 from public.movies m
            where m.id = movie_genres.movie_id
              and m.status = 'published' and m.deleted_at is null)
  );

create policy "public read series_genres" on public.series_genres
  for select using (
    exists (select 1 from public.series s
            where s.id = series_genres.series_id
              and s.status = 'published' and s.deleted_at is null)
  );

create policy "public read movie_cast" on public.movie_cast
  for select using (
    exists (select 1 from public.movies m
            where m.id = movie_cast.movie_id
              and m.status = 'published' and m.deleted_at is null)
  );

create policy "public read series_cast" on public.series_cast
  for select using (
    exists (select 1 from public.series s
            where s.id = series_cast.series_id
              and s.status = 'published' and s.deleted_at is null)
  );

-- subtitle/audio tracks: readable when their (polymorphic) parent is published
create policy "public read subtitle_tracks" on public.subtitle_tracks
  for select using (
    (content_type = 'movie' and exists (
       select 1 from public.movies m
       where m.id = subtitle_tracks.content_id
         and m.status = 'published' and m.deleted_at is null))
    or
    (content_type = 'episode' and exists (
       select 1
       from public.episodes e
       join public.seasons se on se.id = e.season_id
       join public.series sr on sr.id = se.series_id
       where e.id = subtitle_tracks.content_id
         and e.status = 'published'
         and sr.status = 'published' and sr.deleted_at is null))
  );

create policy "public read audio_tracks" on public.audio_tracks
  for select using (
    (content_type = 'movie' and exists (
       select 1 from public.movies m
       where m.id = audio_tracks.content_id
         and m.status = 'published' and m.deleted_at is null))
    or
    (content_type = 'episode' and exists (
       select 1
       from public.episodes e
       join public.seasons se on se.id = e.season_id
       join public.series sr on sr.id = se.series_id
       where e.id = audio_tracks.content_id
         and e.status = 'published'
         and sr.status = 'published' and sr.deleted_at is null))
  );

-- homepage: published sections within their visibility window
create policy "public read published homepage sections" on public.homepage_sections
  for select using (
    status = 'published'
    and (visible_from  is null or visible_from  <= now())
    and (visible_until is null or visible_until >= now())
  );

create policy "public read homepage items of published sections" on public.homepage_section_items
  for select using (
    exists (select 1 from public.homepage_sections hs
            where hs.id = homepage_section_items.section_id
              and hs.status = 'published')
  );

-- pricing page
create policy "public read active plans" on public.subscription_plans
  for select using (is_active = true);

-- NOTE: video_assets has NO public policy on purpose — raw HLS paths are
-- only handed out via the server-side playback API after entitlement checks.

-- ============================================================
-- AUTHENTICATED USERS — own rows
-- ============================================================

-- profiles: full control over own viewing profiles
create policy "users read own profiles" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users insert own profiles" on public.profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users update own profiles" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "users delete own profiles" on public.profiles
  for delete to authenticated using (user_id = (select auth.uid()));

-- user_roles: users may see their own roles; only super_admin mutates
-- (writes normally go through service role in admin server actions)
create policy "users read own roles" on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()));

-- favorites: full CRUD on own rows
create policy "users read own favorites" on public.favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users insert own favorites" on public.favorites
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users delete own favorites" on public.favorites
  for delete to authenticated using (user_id = (select auth.uid()));

-- watch progress: read/upsert/delete own
create policy "users read own watch_progress" on public.watch_progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users insert own watch_progress" on public.watch_progress
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users update own watch_progress" on public.watch_progress
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "users delete own watch_progress" on public.watch_progress
  for delete to authenticated using (user_id = (select auth.uid()));

-- watch sessions: read/create/end own (termination by server)
create policy "users read own watch_sessions" on public.watch_sessions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users insert own watch_sessions" on public.watch_sessions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users update own watch_sessions" on public.watch_sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- devices: full CRUD on own rows
create policy "users read own devices" on public.user_devices
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users insert own devices" on public.user_devices
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users update own devices" on public.user_devices
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "users delete own devices" on public.user_devices
  for delete to authenticated using (user_id = (select auth.uid()));

-- notifications: read + mark-read + dismiss own (creation via service role)
create policy "users read own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users update own notifications" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "users delete own notifications" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

-- subscriptions: SELECT-only (lifecycle handled by payment webhooks / service role)
create policy "users read own subscriptions" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

-- payments: SELECT-only for users; status is written exclusively server-side
create policy "users read own payments" on public.payments
  for select to authenticated using (user_id = (select auth.uid()));

-- promo codes: signed-in users may look up currently valid codes at checkout
create policy "users read valid promo codes" on public.promo_codes
  for select to authenticated using (
    is_active = true
    and valid_from <= now()
    and (valid_until is null or valid_until >= now())
  );

-- ============================================================
-- CONTENT MANAGER — manage the catalog
-- ============================================================
-- has_role() is SECURITY DEFINER; hierarchy user<content_manager<admin<super_admin,
-- so these policies also cover admin and super_admin.

create policy "cm manage genres" on public.genres
  for all using (public.has_role((select auth.uid()), 'content_manager'))
  with check (public.has_role((select auth.uid()), 'content_manager'));
create policy "cm manage countries" on public.countries
  for all using (public.has_role((select auth.uid()), 'content_manager'))
  with check (public.has_role((select auth.uid()), 'content_manager'));
create policy "cm manage languages" on public.languages
  for all using (public.has_role((select auth.uid()), 'content_manager'))
  with check (public.has_role((select auth.uid()), 'content_manager'));
create policy "cm manage movies" on public.movies
  for all using (public.has_role((select auth.uid()), 'content_manager'))
  with check (public.has_role((select auth.uid()), 'content_manager'));
create policy "cm manage series" on public.series
  for all using (public.has_role((select auth.uid()), 'content_manager'))
  with check (public.has_role((select auth.uid()), 'content_manager'));
create policy "cm manage seasons" on public.seasons
  for all using (public.has_role((select auth.uid()), 'content_manager'))
  with check (public.has_role((select auth.uid()), 'content_manager'));
create policy "cm manage episodes" on public.episodes
  for all using (public.has_role((select auth.uid()), 'content_manager'))
  with check (public.has_role((select auth.uid()), 'content_manager'));
create policy "cm manage cast_members" on public.cast_members
  for all using (public.has_role((select auth.uid()), 'content_manager'))
  with check (public.has_role((select auth.uid()), 'content_manager'));
create policy "cm manage crew_members" on public.crew_members
  for all using (public.has_role((select auth.uid()), 'content_manager'))
  with check (public.has_role((select auth.uid()), 'content_manager'));
create policy "cm manage movie_genres" on public.movie_genres
  for all using (public.has_role((select auth.uid()), 'content_manager'))
  with check (public.has_role((select auth.uid()), 'content_manager'));
create policy "cm manage series_genres" on public.series_genres
  for all using (public.has_role((select auth.uid()), 'content_manager'))
  with check (public.has_role((select auth.uid()), 'content_manager'));
create policy "cm manage movie_cast" on public.movie_cast
  for all using (public.has_role((select auth.uid()), 'content_manager'))
  with check (public.has_role((select auth.uid()), 'content_manager'));
create policy "cm manage series_cast" on public.series_cast
  for all using (public.has_role((select auth.uid()), 'content_manager'))
  with check (public.has_role((select auth.uid()), 'content_manager'));
create policy "cm manage subtitle_tracks" on public.subtitle_tracks
  for all using (public.has_role((select auth.uid()), 'content_manager'))
  with check (public.has_role((select auth.uid()), 'content_manager'));
create policy "cm manage audio_tracks" on public.audio_tracks
  for all using (public.has_role((select auth.uid()), 'content_manager'))
  with check (public.has_role((select auth.uid()), 'content_manager'));
create policy "cm manage video_assets" on public.video_assets
  for all using (public.has_role((select auth.uid()), 'content_manager'))
  with check (public.has_role((select auth.uid()), 'content_manager'));
create policy "cm manage homepage_sections" on public.homepage_sections
  for all using (public.has_role((select auth.uid()), 'content_manager'))
  with check (public.has_role((select auth.uid()), 'content_manager'));
create policy "cm manage homepage_section_items" on public.homepage_section_items
  for all using (public.has_role((select auth.uid()), 'content_manager'))
  with check (public.has_role((select auth.uid()), 'content_manager'));

-- ============================================================
-- ADMIN — business operations
-- ============================================================

create policy "admin manage content_partners" on public.content_partners
  for all using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));
create policy "admin manage content_rights" on public.content_rights
  for all using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));
create policy "admin manage content_right_documents" on public.content_right_documents
  for all using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));
create policy "admin manage partner_revenue_shares" on public.partner_revenue_shares
  for all using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));
create policy "admin manage admin_notes" on public.admin_notes
  for all using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));
create policy "admin manage subscription_plans" on public.subscription_plans
  for all using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));
create policy "admin manage promo_codes" on public.promo_codes
  for all using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));
create policy "admin manage subscriptions" on public.subscriptions
  for all using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));
create policy "admin manage notifications" on public.notifications
  for all using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));

-- payments/attempts: admins may READ everything; writes stay with the
-- service role (webhook verification path) so payment state can't be forged.
create policy "admin read payments" on public.payments
  for select using (public.has_role((select auth.uid()), 'admin'));
create policy "admin read payment_attempts" on public.payment_attempts
  for select using (public.has_role((select auth.uid()), 'admin'));

-- support visibility
create policy "admin read profiles" on public.profiles
  for select using (public.has_role((select auth.uid()), 'admin'));
create policy "admin read user_devices" on public.user_devices
  for select using (public.has_role((select auth.uid()), 'admin'));
create policy "admin read watch_sessions" on public.watch_sessions
  for select using (public.has_role((select auth.uid()), 'admin'));
create policy "admin read user_roles" on public.user_roles
  for select using (public.has_role((select auth.uid()), 'admin'));

-- role grants are the most sensitive mutation: super_admin only
-- (day-to-day writes go through service role after requireRole checks)
create policy "super_admin manage user_roles" on public.user_roles
  for all using (public.has_role((select auth.uid()), 'super_admin'))
  with check (public.has_role((select auth.uid()), 'super_admin'));

-- audit logs: INSERT happens via service role only (bypasses RLS —
-- deliberately no insert policy). Admin+ may read.
create policy "admin read audit_logs" on public.audit_logs
  for select using (public.has_role((select auth.uid()), 'admin'));

