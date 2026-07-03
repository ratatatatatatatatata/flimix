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
