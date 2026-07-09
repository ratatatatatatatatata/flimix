-- FLIMIX: дубляж (тусдаа дууны файл) — live DB-д ажиллуулах snippet.
-- Supabase SQL editor дээр нэг удаа ажиллуулна. Дахин ажиллуулахад аюулгүй.

alter table public.audio_tracks add column if not exists url text;
alter table public.audio_tracks add column if not exists is_default boolean not null default false;
