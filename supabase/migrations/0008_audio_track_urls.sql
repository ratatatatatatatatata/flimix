-- ============================================================
-- FLIMIX 0008 — dub audio tracks become playable
--
-- audio_tracks so far only described languages; now each row can
-- carry a direct media URL (uploaded file or CDN link) plus a
-- default flag. When a track with a URL exists the player replaces
-- the video's original audio entirely with this file.
--
-- RLS: 0007 already ships "public read audio_tracks" (published
-- parent only, mirroring subtitle_tracks) and "cm manage
-- audio_tracks" — no policy changes needed here.
-- ============================================================

alter table public.audio_tracks add column if not exists url text;
alter table public.audio_tracks add column if not exists is_default boolean not null default false;
