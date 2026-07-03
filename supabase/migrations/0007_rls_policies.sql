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
