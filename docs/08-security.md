# 08 — Security

Threat model in one line: protect **user accounts and payment integrity**, keep
**unpublished/expired content and staff tooling private**, and make **casual content
piracy inconvenient** (see the honest DRM statement in `docs/05-video-streaming.md`).

## 1. Row Level Security (RLS) — philosophy

RLS is the **last** line of defense, not the first. Application code checks roles and
filters; RLS guarantees that when application code is wrong, the blast radius is a bug,
not a breach. Every table has RLS enabled; the service-role key bypasses it, which is
exactly why that key is caged (§3).

Policy patterns (the real policies live in `supabase/migrations`):

```sql
-- Public catalog: anyone may read published, non-deleted content
create policy movies_public_read on public.movies
  for select using (status = 'published' and deleted_at is null);

-- Staff may read everything (has_role() is the security-definer fn from docs/04)
create policy movies_staff_read on public.movies
  for select using (public.has_role('content_manager'));

-- User-owned rows: owner-only, both directions
create policy favorites_owner on public.favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Subscriptions/payments: users READ their own; NO insert/update policy for users —
-- writes happen only via server-verified payment code (service role)
create policy payments_owner_read on public.payments
  for select using (auth.uid() = user_id);

-- audit_logs: admin read only; inserts via service role only
create policy audit_admin_read on public.audit_logs
  for select using (public.has_role('admin'));
```

Note the deliberate *absence* of write policies on payments/subscriptions for regular
users — the anon/authenticated key physically cannot forge a subscription.

## 2. Server-side role checks

Four layers, always (detailed in `docs/04-auth-roles.md`): middleware gate →
layout `requireRole` → server-action/route-handler `requireRole` re-check → RLS
`has_role()`. The re-check at the action layer is non-negotiable because server actions
are directly invokable HTTP endpoints.

## 3. Service-role isolation

- `@/lib/supabase/admin` (`createAdminClient()`) is a **server-only module** — it must
  never be imported from a client component; the service key would otherwise be
  inlined into the browser bundle.
- It appears only inside audited admin actions (after `requireRole`, via
  `runAdminAction`) and inside payment/webhook/playback server code that must write
  rows users cannot (payments, subscriptions, watch_sessions, audit_logs).
- Ordinary reads use the anon-key server client so RLS stays in force by default.

## 4. Environment variable hygiene

- `NEXT_PUBLIC_*` = the only vars allowed in the browser: Supabase URL + anon key,
  app URL. Everything else in `.env.example` is server-only.
- Real values live in Vercel project env (per environment: preview vs production) and
  the Supabase dashboard — **never in the repo**. `.env.local` is gitignored;
  `.env.example` carries placeholders only.
- Key rotation: service-role key, Bunny keys, and payment secrets are rotatable
  without code changes (read at runtime, not build time).

## 5. Input validation

Every mutation input — server action or route handler — is parsed with **Zod** before
any database call. Schemas live next to the action. `parse` (throw) over `safeParse`
in admin code so malformed input fails loudly; user-facing forms use `safeParse` and
render field errors via the `Input` component's `error` prop.

## 6. XSS / CSRF / SQLi posture in Next + Supabase

| Vector | Posture |
|---|---|
| SQL injection | No string-built SQL anywhere. supabase-js builds parameterized PostgREST calls; the few SQL functions (`has_role`) take typed args. |
| XSS | React escapes by default; **`dangerouslySetInnerHTML` is banned** in this codebase (no CMS-driven HTML; legal pages are typed content). User-supplied text (display names, admin notes) renders as text nodes only. |
| CSRF | Auth cookies are SameSite=Lax + httpOnly (@supabase/ssr defaults); Next.js server actions require same-origin (Origin/Host check built in); webhooks don't use cookies at all — they authenticate by signature. |
| Clickjacking | `X-Frame-Options: DENY` in `next.config.ts` headers. |
| MIME sniffing | `X-Content-Type-Options: nosniff`. |
| Referrer leaks | `Referrer-Policy: strict-origin-when-cross-origin`. |
| Feature abuse | `Permissions-Policy: camera=(), microphone=(), geolocation=()`. |
| Fingerprinting the stack | `poweredByHeader: false`. |

All headers are configured centrally in `next.config.ts` `headers()`.

## 7. Signed media URLs + TTL

Playback URLs are HMAC-signed per asset path with expiry
(`PLAYBACK_URL_TTL_SECONDS`, default 3600 s) and issued only after auth + subscription
+ stream-limit checks in `POST /api/playback`. Rights-contract documents in Supabase
Storage live in a **private bucket** and are served via short-lived signed Storage
URLs to admins only. Public artwork buckets are read-only public.

## 8. Webhook verification

Payment webhooks verify the provider signature/shared secret before any processing,
and even then only trigger a server-to-server re-check (`payment/check`) — the webhook
body is never trusted as a source of truth. Unverified → `401`, log, stop.
See `docs/06-payments.md` §10.

## 9. Rate limiting

- **Now (single-region, few instances):** in-memory token bucket per user/IP-hash in
  the hot route handlers — `/api/playback` (e.g. 10/min/user), `/api/progress`
  (loose), auth actions (login/register/reset: strict per IP-hash), `/api/search`.
  In-memory limits are per-lambda-instance and therefore approximate — acceptable for
  MVP because the DB-level invariants (stream_limit, unique external_id) hold anyway.
- **Later (multi-instance correctness):** swap the bucket store for Upstash
  Redis/`@upstash/ratelimit` behind the same helper interface; call sites unchanged.
  Trigger: sustained abuse observed, or multi-region deployment.

## 10. Audit logging

Every admin mutation writes `audit_logs` (actor, action, entity, redacted details,
ip_hash) via the mandatory `runAdminAction` wrapper (`docs/07-admin-structure.md`).
Payment status transitions and role grants are always audited. Audit rows are
insert-only (no update/delete policy for anyone below service role).

## 11. File-upload validation

| Upload | Rules |
|---|---|
| Artwork (posters/backdrops/avatars) | Server-side: allowlist `image/jpeg,png,webp`, max 5 MB, re-check magic bytes not just extension; stored in Supabase Storage with generated names (never user-supplied paths) |
| Subtitles | `.vtt` only, max 2 MB, parsed/validated before save (a subtitle file is rendered into the player DOM — treat as untrusted input) |
| Video masters | Uploaded server-side to Bunny via API; never into Supabase Storage; size/format limits per Bunny library settings |
| Rights documents | pdf/jpg/png, max 20 MB, private bucket, admin-only signed access |
| CSV import | Parsed with a real CSV parser, per-row Zod validation, row cap (5,000), never interpreted as formulas on export (cells prefixed if starting with `=+-@` — CSV-injection guard) |

## 12. Secrets management

Vercel env (app secrets) + Supabase dashboard (DB/auth config) are the only secret
stores. No secrets in the repo, in client bundles, in logs, or in `audit_logs.details`.
CI uses placeholder envs. Anyone leaving the team → rotate service-role, Bunny, and
payment credentials (they are shared-secret style, not per-person).

## 13. IP hashing (privacy)

Raw client IPs are **never persisted**. `watch_sessions.ip_hash` and
`audit_logs.ip_hash` store `sha256(ip + IP_HASH_SALT)` — enough to correlate abuse
patterns (same salt → same hash) without holding personal network identifiers. The
salt is a server secret; rotating it intentionally severs old correlations.

## 14. Logging prohibitions

Never logged, anywhere (app logs, audit details, payment_attempts, error reports):
passwords or password hashes, auth tokens/cookies, full payment credentials (FLIMIX
never even receives card data — payments happen inside bank apps), signed playback
URLs with live tokens, raw IPs. Error monitoring must scrub request bodies from auth
and payment routes.

## 15. Data ownership

All production data (user records, payment records, watch data), source code, designs,
and content metadata produced for this platform **belong to the FLIMIX company**.
Contractors and partner integrations operate on FLIMIX-owned infrastructure and retain
no rights to copies of production data. Partner-facing exports (revenue-share reports)
contain aggregates only, never user-level data.
