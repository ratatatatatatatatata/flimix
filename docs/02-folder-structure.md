# 02 — Folder structure

Annotated repository layout. The route map and module ownership below are binding —
they come from `docs/CONVENTIONS.md`, which is the contract every contributor follows.

```
flimix/
├── .env.example                  # Every env var, documented. Copy to .env.local. Real values never committed.
├── next.config.ts                # image remotePatterns (Supabase, *.b-cdn.net), security headers, poweredByHeader off
├── tailwind.config.ts            # design tokens: ink-* backgrounds, royal-* accent, mist-* text
├── tsconfig.json                 # strict TS, path alias @/* -> ./src/*
├── docs/                         # this documentation set (01–10 + CONVENTIONS.md)
├── supabase/
│   └── migrations/               # numbered SQL migrations — the source of truth for the DB
│       ├── 0001_extensions_and_types.sql     # pgcrypto etc., all enum types
│       ├── 0002_core_content.sql             # movies, series, seasons, episodes, video_assets, genres, cast/crew, tracks
│       ├── 0003_users_and_engagement.sql     # profiles, user_roles, favorites, watch_progress, watch_sessions, devices, notifications
│       ├── 0004_subscriptions_payments.sql   # subscription_plans, subscriptions, payments, payment_attempts, promo_codes
│       └── 0005_rights_and_admin.sql         # content_partners, content_rights, homepage_sections, audit_logs
└── src/
    ├── middleware.ts             # @supabase/ssr session refresh on every request + auth gate for /admin,/account,/watch
    ├── types/
    │   └── db.ts                 # THE schema contract. All domain types. Migrations and queries must match it.
    ├── app/
    │   ├── layout.tsx            # root layout: <html>/<body> + globals only. NO header/footer here.
    │   ├── globals.css           # Tailwind layers + utilities (.container-fx, .card-surface, .row-scroll, …)
    │   ├── loading.tsx / error.tsx / not-found.tsx
    │   │
    │   ├── (public)/             # ROUTE GROUP: everything a guest can see
    │   │   ├── layout.tsx        #   renders SiteHeader + SiteFooter around children
    │   │   ├── page.tsx          #   landing page (hero + homepage_sections rows)
    │   │   ├── browse/           #   catalog grid with genre/year filters
    │   │   ├── search/           #   search results (server-rendered; /api/search backs typeahead)
    │   │   ├── movie/[slug]/     #   movie detail (published-only filter enforced)
    │   │   ├── series/[slug]/    #   series detail + seasons/episodes
    │   │   ├── subscribe/        #   plan picker → payment (guests see plans; checkout requires login)
    │   │   └── legal/            #   terms, privacy, copyright, content-removal, refund, child-safety
    │   │
    │   ├── (auth)/               # ROUTE GROUP: centered-card layout, no site chrome
    │   │   ├── layout.tsx
    │   │   ├── login/  register/  forgot-password/  reset-password/  verify-email/
    │   │
    │   ├── account/              # authenticated user area (middleware-gated, no route group parens: URL is /account)
    │   │   ├── layout.tsx        #   requireUser() + account nav
    │   │   ├── page.tsx          #   profile overview
    │   │   ├── favorites/  history/  devices/  subscription/  payments/  security/
    │   │
    │   ├── watch/[type]/[id]/    # player page; type = movie | episode. Client component with hls.js.
    │   │
    │   ├── admin/                # admin panel, own sidebar layout (see docs/07-admin-structure.md)
    │   │   ├── layout.tsx        #   requireRole("content_manager") minimum; sidebar nav
    │   │   ├── page.tsx          #   overview dashboard
    │   │   ├── content/  series/  rights/  users/  plans/  homepage/  reports/  audit/  settings/
    │   │
    │   └── api/                  # route handlers — machine-facing endpoints only
    │       ├── playback/route.ts             # POST: auth+subscription+stream-limit → signed HLS URL
    │       ├── progress/route.ts             # POST: upsert watch_progress
    │       ├── search/route.ts               # GET: typeahead JSON
    │       └── payments/
    │           ├── qpay/webhook/route.ts     # provider callback (signature-verified)
    │           └── socialpay/webhook/route.ts
    │
    ├── components/
    │   ├── brand/Logo.tsx
    │   ├── ui/                   # Button, Input, Badge, EmptyState, Skeletons — the only primitives; do not fork
    │   ├── catalog/              # PosterCard, ContentRow — shared catalog rendering
    │   └── layout/               # SiteHeader (async server component), SiteFooter
    │
    └── lib/                      # ALL business logic lives here — never in components or route files
        ├── i18n.ts               # t (Mongolian labels), formatDuration, formatMnt
        ├── auth.ts               # getSession, requireUser, requireRole, hasRole, hasActiveSubscription
        ├── supabase/
        │   ├── client.ts         # browser client (anon key)
        │   ├── server.ts         # server client (cookies, RLS applies)
        │   └── admin.ts          # service-role client — "server-only", used ONLY after requireRole()
        ├── video/                # provider abstraction: getSignedPlaybackUrl(asset) → { hlsUrl, expiresAt }
        │                         #   bunny adapter (token-auth signing) + mock adapter (public test stream)
        └── payments/             # adapter layer: createInvoice(), verifyAndApplyPayment()
                                  #   qpay / socialpay / bank_transfer adapters behind one interface
```

## Route groups explained

- **`(public)` and `(auth)` are layout boundaries, not URL segments.** `(public)/browse`
  serves at `/browse`. The parentheses exist so the marketing chrome (header/footer) and
  the centered auth card can be different layouts without nesting URLs.
- **`account`, `watch`, `admin` are real URL segments** and are exactly the prefixes
  `src/middleware.ts` gates: an unauthenticated request to any of them is redirected to
  `/login?next=<path>` before any page code runs.
- Every major route group ships its own `loading.tsx` and `error.tsx` (quality bar in
  CONVENTIONS).

## Server / client component split

Default is **server component**. Client components (`"use client"`) are the exception
and exist only where the browser is genuinely needed:

| Client component | Why |
|---|---|
| Player on `/watch/[type]/[id]` | hls.js, media events, progress timer |
| Search typeahead input | keystroke debouncing against `/api/search` |
| Forms (login, register, checkout) | controlled inputs, inline validation UX (server actions still re-validate) |
| Row scrollers / carousels | pointer interactions |

Everything else — landing, browse, detail pages, account pages, the whole admin panel's
read views — renders on the server and queries Supabase directly via
`@/lib/supabase/server` with RLS in force.

## Where business logic lives

`src/lib` owns all logic. Components render; route handlers parse/authorize/delegate.

- **Reads:** server components call `createClient()` from `@/lib/supabase/server` and
  query directly. RLS enforces visibility, and public queries additionally apply
  `.eq("status","published").is("deleted_at",null)`.
- **Writes:** server actions (`"use server"`) or route handlers only. Every input is
  parsed with a Zod schema before anything touches the database.
- **Admin writes:** `requireRole(...)` first, then (and only then) `createAdminClient()`
  from `@/lib/supabase/admin`, then an `audit_logs` insert. This ordering is mandatory —
  see `docs/07-admin-structure.md` (`runAdminAction`).
- **Cross-module contracts:** account/subscription flows call `createInvoice` /
  `verifyAndApplyPayment` from `@/lib/payments` and never implement provider HTTP
  themselves; the player calls `POST /api/playback` and never constructs CDN URLs.

## Data access rules (summary)

1. No Supabase query outside `src/lib` and server components/actions/route handlers.
2. `createAdminClient()` never appears in a file reachable from the client bundle;
   the module is marked server-only and any import from a client component must fail CI.
3. Payment status transitions happen only in webhook handlers and
   `verifyAndApplyPayment` — never from browser-initiated state.
4. snake_case table/column names exactly as in `src/types/db.ts`; no drift between
   migrations, types, and queries.
