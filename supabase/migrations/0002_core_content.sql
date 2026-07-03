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
