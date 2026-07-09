-- 0009: Cloudflare R2 video provider
-- video_assets.provider is the Postgres enum public.video_provider
-- (created in 0001_extensions_and_types.sql); extend it with 'r2'.
alter type public.video_provider add value if not exists 'r2';
