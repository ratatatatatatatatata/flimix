-- FLIMIX: Cloudflare R2 video provider (Supabase SQL editor дээр нэг удаа ажиллуулна)
-- FLIMIX-SETUP-ALL*.sql-ээр өмнө нь суулгасан сангуудад зориулав.
-- (supabase/migrations/0009_r2_provider.sql-тэй ижил агуулга)
alter type public.video_provider add value if not exists 'r2';
