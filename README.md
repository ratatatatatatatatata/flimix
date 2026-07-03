# FLIMIX — Монгол кино стриминг платформ

Production-ready Mongolian movie & series streaming platform.
Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS · Supabase (Postgres, Auth, Storage, RLS) · Bunny Stream (HLS CDN) · QPay / SocialPay payments.

## Documentation

| Doc | Contents |
|---|---|
| [docs/01-architecture.md](docs/01-architecture.md) | System architecture, scaling to 5,000 concurrent viewers |
| [docs/02-folder-structure.md](docs/02-folder-structure.md) | Annotated repo layout |
| [docs/03-database-erd.md](docs/03-database-erd.md) | ERD + schema design decisions |
| [docs/04-auth-roles.md](docs/04-auth-roles.md) | Auth & role strategy (guest → super_admin) |
| [docs/05-video-streaming.md](docs/05-video-streaming.md) | HLS pipeline, signed URLs, stream limits, DRM stance |
| [docs/06-payments.md](docs/06-payments.md) | Payment abstraction, QPay/SocialPay flows, state machines |
| [docs/07-admin-structure.md](docs/07-admin-structure.md) | Admin panel IA + role gating |
| [docs/08-security.md](docs/08-security.md) | Security strategy (RLS, validation, secrets, audit) |
| [docs/09-roadmap.md](docs/09-roadmap.md) | Phase 1–3 roadmap + launch checklist |
| [docs/10-recommendations.md](docs/10-recommendations.md) | MVP + future recommendation design |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Code conventions & cross-module contracts |

## Local setup

Prereqs: Node 20+, a Supabase project, (optional) Supabase CLI.

```bash
# 1. Install
npm install

# 2. Environment
cp .env.example .env.local
#    Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#    SUPABASE_SERVICE_ROLE_KEY (server-only!). Payment/Bunny keys optional for dev.

# 3. Database migrations (pick one)
#    a) Supabase CLI:
supabase link --project-ref <your-project-ref>
supabase db push          # applies supabase/migrations/*.sql in order
#    b) Or paste each file from supabase/migrations/ into the SQL editor, in order.

# 4. Storage buckets (Dashboard → Storage): create
#    - "media"       (public)  — posters/backdrops
#    - "rights-docs" (private) — license documents

# 5. Seed demo data (creates demo users + ~24 movies, 4 series, plans, sections)
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed.mjs

# 6. Run
npm run dev        # http://localhost:3000
npm run typecheck  # strict TS check
npm run build      # production build
```

## Demo accounts (created by seed)

| Role | Email | Password |
|---|---|---|
| Super admin + admin | admin@flimix.mn | Admin123! |
| Content manager | manager@flimix.mn | Manager123! |
| Subscriber (active plan) | demo@flimix.mn | Demo123! |

Admin panel: `/admin`. Change these passwords before any shared deployment.

## Key routes

Public: `/` `/browse` `/search` `/movie/[slug]` `/series/[slug]` `/subscribe` `/legal/*`
Auth: `/login` `/register` `/forgot-password` `/reset-password`
User: `/account/*` (profiles, favorites, history, devices, subscription, payments, security)
Player: `/watch/movie/[id]`, `/watch/episode/[id]` (signed HLS URLs via `POST /api/playback`)
Admin: `/admin` (overview, content, series, rights, users, plans, homepage, reports, audit, settings)

## Video during development

Seeded titles use a `mock` video asset pointing at a public HLS test stream, so the full
player (quality levels, subtitles UI, resume, progress saving) works without a CDN account.
For production, create a Bunny Stream library, set the `BUNNY_*` vars, and store per-title
`video_assets` rows with provider `bunny`. See docs/05-video-streaming.md.

## Payments during development

QPay/SocialPay adapters activate only when their env vars are set; otherwise checkout
falls back to bank-transfer instructions (admin verifies manually). Webhooks:
`/api/payments/qpay/webhook`, `/api/payments/socialpay/webhook` — signature-verified,
status always re-checked server-side. See docs/06-payments.md.

## Deployment

- **Vercel**: import repo, set all env vars from `.env.example` (mark service-role & payment keys as secrets).
- **Supabase**: run migrations + seed; enable Google OAuth provider (Authentication → Providers) with `https://<domain>/auth/callback` redirect.
- **Bunny Stream**: enable token authentication on the library; set hostname + token key.
- Before publishing real content: upload rights documents in `/admin/rights` and get them approved — the publish action is blocked without an approved, unexpired right.

## Legal note

All movies, series, posters, subtitles and video files must only be published after
streaming rights and ownership documents have been verified. Seed content is invented
demo data; no copyrighted media is included.
