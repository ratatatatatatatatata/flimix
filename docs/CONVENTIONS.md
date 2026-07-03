# FLIMIX — Build conventions (contract for all contributors)

## Paths
- Repo root (sandbox): /sessions/beautiful-affectionate-planck/mnt/outputs/flimix
- Write files with bash heredocs (`cat > path <<'EOF'`). Windows Write tool fails on deep paths.

## Stack
Next.js 15 App Router, React 19, strict TypeScript, Tailwind (v3, config in tailwind.config.ts),
@supabase/ssr, zod, hls.js, lucide-react. Path alias `@/*` -> `./src/*`. NO other deps may be added.

## Already-built shared modules (import, do not recreate)
- `@/lib/i18n` → `t` (Mongolian UI labels), `formatDuration(sec)`, `formatMnt(amount)`
- `@/types/db` → all domain types (Movie, Series, Season, Episode, SubscriptionPlan, Payment, ContentRight, HomepageSection, UserRole, ContentStatus, PaymentStatus, SubscriptionStatus, etc.) — THE schema contract; migrations and queries must match it
- `@/lib/supabase/client` → `createClient()` (browser)
- `@/lib/supabase/server` → `createClient()` (async, server)
- `@/lib/supabase/admin` → `createAdminClient()` (service role, server-only)
- `@/lib/auth` → `getSession()`, `requireUser()`, `requireRole(min)`, `hasRole(session,min)`, `hasActiveSubscription(userId)`; roles: user < content_manager < admin < super_admin
- `@/components/brand/Logo` → `Logo`
- `@/components/ui/Button` → `Button` (variant: primary|secondary|ghost|danger; size sm|md|lg; loading)
- `@/components/ui/Input` → `Input` (label, error)
- `@/components/ui/Badge` → `Badge` (tone: default|accent|success|warning|danger)
- `@/components/ui/EmptyState` → `EmptyState` (title, description, action)
- `@/components/ui/Skeletons` → `PosterSkeleton`, `RowSkeleton`
- `@/components/catalog/PosterCard` → `PosterCard` (href,title,posterUrl,year,ageRating,progressPercent,isFree)
- `@/components/catalog/ContentRow` → `ContentRow` (title, seeAllHref, children)
- `@/components/layout/SiteHeader` → `SiteHeader` (async server component)
- `@/components/layout/SiteFooter` → `SiteFooter`
- `src/middleware.ts` exists (session refresh + /admin,/account,/watch auth gate)

## Design tokens (Tailwind)
- Backgrounds: `bg-ink-950` (page), `bg-ink-900` (section), `bg-ink-800` (card), `bg-ink-700` (elevated), border `border-ink-600`
- Accent: `royal-500` primary, `royal-300/400` text accents, `glow` sparingly
- Text: white headings, `text-mist-100` body, `text-mist-300/400` secondary, `text-mist-500` muted
- Utilities: `.container-fx` (page container), `.skeleton`, `.card-surface`, `.row-scroll`, `bg-hero-fade`, `bg-card-fade`, `shadow-card`, `shadow-accent`, `animate-fade-in`
- Premium dark cinematic, spacious, restrained animation. No white backgrounds, no neon overload, not a Netflix clone.

## Language
ALL user-facing copy in Mongolian (use `t` where a label exists; write natural Mongolian otherwise).
Comments and code identifiers in English.

## Route map (App Router, route groups)
- `src/app/(public)/` → layout with SiteHeader+SiteFooter; pages: `page.tsx` (landing), `browse/`, `search/`, `movie/[slug]/`, `series/[slug]/`, `legal/{terms,privacy,copyright,content-removal,refund,child-safety}/`, `subscribe/`
- `src/app/(auth)/` → centered card layout; `login/`, `register/`, `forgot-password/`, `reset-password/`, `verify-email/`
- `src/app/account/` → user area (profile, favorites, history, devices, subscription, payments, security)
- `src/app/watch/[type]/[id]/` → player page (type = movie|episode)
- `src/app/admin/` → admin area with own sidebar layout
- `src/app/api/` → route handlers: `playback/`, `progress/`, `payments/{qpay,socialpay}/webhook/`, `search/`
NOTE: `(public)/layout.tsx` renders SiteHeader/SiteFooter. Root layout only sets <html>/<body>.

## Data access rules
- Server components query Supabase via `@/lib/supabase/server` directly (RLS enforced).
- Mutations via server actions (`"use server"`) or route handlers; validate ALL input with zod.
- Admin mutations: verify role with `requireRole(...)` BEFORE touching data; use `createAdminClient()` only after that check; write an `audit_logs` row for every admin mutation.
- Never expose SUPABASE_SERVICE_ROLE_KEY, Bunny keys, payment secrets to the client.
- Published-content filter for public queries: `.eq("status","published").is("deleted_at",null)`.
- Payment status changes come ONLY from server-verified webhook/polling code.

## DB naming
snake_case tables/columns exactly as in `src/types/db.ts`. UUID PKs (gen_random_uuid()).
Junction tables: movie_genres, series_genres, movie_cast, series_cast (movie_id/series_id + genre_id/cast_member_id).

## Quality bar
Strict TS, no `any`, no unfinished stubs, loading.tsx + error.tsx per major route group,
accessible components (labels, aria), mobile-first responsive.

## Cross-module contracts (implement/consume EXACTLY these signatures)

### `@/lib/video` (owner: video module)
```ts
export interface SignedPlayback { hlsUrl: string; expiresAt: string; }
export async function getSignedPlaybackUrl(asset: VideoAsset): Promise<SignedPlayback>;
```
Bunny adapter signs CDN token-auth URLs server-side; mock provider returns a public
sample HLS stream (https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8) for local dev.

### `@/lib/payments` (owner: video/payments module)
```ts
export interface InvoiceResult {
  paymentId: string;        // payments.id
  checkoutUrl?: string;     // redirect-style providers
  qrText?: string;          // QPay QR content
  deeplinks?: { name: string; link: string }[];
}
export async function createInvoice(input: {
  userId: string; planId: string; provider: PaymentProvider; promoCode?: string;
}): Promise<InvoiceResult>;
export async function verifyAndApplyPayment(paymentId: string): Promise<PaymentStatus>;
```
`verifyAndApplyPayment` re-checks with the provider server-side, is idempotent
(unique external_id, row lock), activates/extends the subscription on `paid`.

### Playback API (owner: video module)
`POST /api/playback` body `{ contentType: "movie"|"episode", contentId: string }` →
403 unless subscriber (or movie.is_free); returns `{ hlsUrl, expiresAt, subtitles: SubtitleTrack[], progressSeconds: number, sessionId: string }`.
Creates a watch_sessions row and enforces plan stream_limit.

### Progress API (owner: video module)
`POST /api/progress` body `{ contentType, contentId, progressSeconds, durationSeconds, sessionId }` → upserts watch_progress (completed when >=95%).

### Consumers
Account/subscription flows call `createInvoice` / `verifyAndApplyPayment` via server
actions; they must NOT implement provider logic themselves.
