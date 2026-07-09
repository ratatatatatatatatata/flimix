/**
 * FLIMIX domain types — mirror of the Supabase schema.
 * Keep in sync with supabase/migrations. For fully generated types run:
 *   supabase gen types typescript --project-id <id> > src/types/supabase.ts
 */

export type UUID = string;

export type UserRole =
  | "user"
  | "content_manager"
  | "admin"
  | "super_admin";

export type ContentStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "unpublished"
  | "archived";

export type ContentType = "movie" | "episode";

export type AgeRating = "G" | "PG" | "PG-13" | "R" | "NC-17";

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "expired";

export type PaymentProvider = "qpay" | "socialpay" | "bank_transfer" | "manual";

export type RightsApprovalStatus = "pending" | "approved" | "rejected";

export interface Profile {
  id: UUID;
  user_id: UUID;
  display_name: string;
  avatar_url: string | null;
  birth_date: string | null;
  is_child_profile: boolean;
  created_at: string;
}

export interface Genre {
  id: UUID;
  slug: string;
  name_mn: string;
  name_en: string;
}

export interface Country {
  id: UUID;
  code: string; // ISO 3166-1 alpha-2
  name_mn: string;
  name_en: string;
}

export interface Language {
  id: UUID;
  code: string; // ISO 639-1
  name_mn: string;
  name_en: string;
}

export interface Movie {
  id: UUID;
  slug: string;
  title_mn: string;
  title_en: string | null;
  original_title: string | null;
  description_mn: string | null;
  description_en: string | null;
  release_year: number | null;
  duration_seconds: number | null;
  age_rating: AgeRating | null;
  country_id: UUID | null;
  poster_url: string | null;
  backdrop_url: string | null;
  trailer_url: string | null;
  playback_asset_id: UUID | null;
  popularity: number;
  rating: number | null;
  is_free: boolean;
  status: ContentStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // joined
  genres?: Genre[];
  country?: Country | null;
}

export interface Series {
  id: UUID;
  slug: string;
  title_mn: string;
  title_en: string | null;
  original_title: string | null;
  description_mn: string | null;
  description_en: string | null;
  release_year: number | null;
  age_rating: AgeRating | null;
  country_id: UUID | null;
  poster_url: string | null;
  backdrop_url: string | null;
  trailer_url: string | null;
  popularity: number;
  rating: number | null;
  status: ContentStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  genres?: Genre[];
  seasons?: Season[];
}

export interface Season {
  id: UUID;
  series_id: UUID;
  season_number: number;
  title: string | null;
  description: string | null;
  created_at: string;
  episodes?: Episode[];
}

export interface Episode {
  id: UUID;
  season_id: UUID;
  episode_number: number;
  title_mn: string;
  title_en: string | null;
  description_mn: string | null;
  duration_seconds: number | null;
  poster_url: string | null;
  playback_asset_id: UUID | null;
  intro_start_seconds: number | null;
  intro_end_seconds: number | null;
  status: ContentStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CastMember {
  id: UUID;
  name: string;
  photo_url: string | null;
}

export interface CrewMember {
  id: UUID;
  name: string;
  role: string; // director, producer, writer...
  photo_url: string | null;
}

export interface VideoAsset {
  id: UUID;
  provider: "bunny" | "cloudflare" | "aws" | "mock" | "r2";
  provider_video_id: string;
  hls_path: string; // path/playlist relative to CDN host, no signature
  qualities: string[]; // ["360p","480p","720p","1080p"]
  duration_seconds: number | null;
  status: "processing" | "ready" | "failed";
  created_at: string;
}

export interface SubtitleTrack {
  id: UUID;
  content_type: ContentType;
  content_id: UUID;
  language_id: UUID;
  label: string;
  url: string;
  is_default: boolean;
  language?: Language;
}

export interface AudioTrack {
  id: UUID;
  content_type: ContentType;
  content_id: UUID;
  language_id: UUID;
  label: string;
  url: string | null;
  is_default: boolean;
  language?: Language;
}

export interface Favorite {
  id: UUID;
  user_id: UUID;
  movie_id: UUID | null;
  series_id: UUID | null;
  created_at: string;
  movie?: Movie | null;
  series?: Series | null;
}

export interface WatchProgress {
  id: UUID;
  user_id: UUID;
  profile_id: UUID | null;
  content_type: ContentType;
  content_id: UUID;
  progress_seconds: number;
  duration_seconds: number;
  completed: boolean;
  last_watched_at: string;
}

export interface WatchSession {
  id: UUID;
  user_id: UUID;
  profile_id: UUID | null;
  device_id: UUID | null;
  content_type: ContentType;
  content_id: UUID;
  started_at: string;
  ended_at: string | null;
  ip_hash: string | null;
  status: "active" | "ended" | "terminated";
}

export interface SubscriptionPlan {
  id: UUID;
  slug: string;
  name_mn: string;
  name_en: string;
  price_mnt: number;
  duration_days: number;
  device_limit: number;
  stream_limit: number;
  trial_days: number;
  features_mn: string[];
  is_active: boolean;
  created_at: string;
}

export interface Subscription {
  id: UUID;
  user_id: UUID;
  plan_id: UUID;
  status: SubscriptionStatus;
  started_at: string;
  current_period_end: string;
  cancelled_at: string | null;
  created_at: string;
  plan?: SubscriptionPlan;
}

export interface Payment {
  id: UUID;
  user_id: UUID;
  subscription_id: UUID | null;
  provider: PaymentProvider;
  external_id: string | null;
  amount_mnt: number;
  status: PaymentStatus;
  paid_at: string | null;
  receipt_number: string | null;
  created_at: string;
}

export interface PromoCode {
  id: UUID;
  code: string;
  discount_percent: number | null;
  bonus_days: number | null;
  max_uses: number | null;
  used_count: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
}

export interface UserDevice {
  id: UUID;
  user_id: UUID;
  device_name: string;
  device_type: "web" | "mobile" | "tablet" | "tv" | "other";
  user_agent: string | null;
  last_active_at: string;
  created_at: string;
}

export interface HomepageSection {
  id: UUID;
  slug: string;
  title_mn: string;
  layout: "hero" | "row" | "grid" | "banner";
  query_type: "manual" | "auto";
  auto_query: Record<string, unknown> | null;
  sort_order: number;
  visible_from: string | null;
  visible_until: string | null;
  device_visibility: string[]; // ["web","mobile","tv"]
  status: "draft" | "published";
  created_at: string;
  items?: HomepageSectionItem[];
}

export interface HomepageSectionItem {
  id: UUID;
  section_id: UUID;
  content_type: "movie" | "series";
  content_id: UUID;
  sort_order: number;
  movie?: Movie | null;
  series?: Series | null;
}

export interface ContentPartner {
  id: UUID;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
}

export interface ContentRight {
  id: UUID;
  content_type: "movie" | "series";
  content_id: UUID;
  partner_id: UUID | null;
  rights_owner: string;
  contract_number: string | null;
  rights_start: string;
  rights_end: string;
  allowed_countries: string[];
  allowed_platforms: string[];
  is_exclusive: boolean;
  revenue_share_percent: number | null;
  approval_status: RightsApprovalStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: UUID;
  actor_id: UUID | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_hash: string | null;
  created_at: string;
}

export interface Notification {
  id: UUID;
  user_id: UUID;
  title_mn: string;
  body_mn: string | null;
  type: "system" | "payment" | "content" | "subscription";
  read_at: string | null;
  created_at: string;
}
