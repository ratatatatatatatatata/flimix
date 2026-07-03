# 09 — Roadmap

Three phases. Each phase ships user-visible value and leaves the schema untouched —
`src/types/db.ts` already models Phase 2/3 concepts (profiles, devices, promo codes,
notifications, homepage sections) so later phases are UI + logic, not migrations.

## Phase 1 — Core MVP

**Scope**

- Auth: email+password with verification, Google OAuth, password reset (`(auth)` routes)
- Catalog: landing with homepage sections, browse with genre/year filters, search
  (page + `/api/search` typeahead)
- Detail pages: movie and series (seasons/episodes, cast, related titles)
- Playback: custom HLS player (hls.js), signed URLs via `POST /api/playback`,
  quality/subtitle selection, resume, stream-limit enforcement
- Engagement: favorites, watch progress + continue-watching row, watch history
- Admin: content + series CRUD, video upload/transcode status, rights registry with
  approval + publish guard, homepage curation, user/plan management, audit log
- Monetization: subscription plans, QPay (QR + deeplinks) and SocialPay checkout,
  bank-transfer manual flow, subscription lifecycle, account payment history
- Legal pages (terms, privacy, copyright, content-removal, refund, child-safety)

**Exit criteria**

- A guest can register, verify, subscribe, pay via QPay sandbox, and watch a 1080p
  title with resume — on a mid-range Android phone over throttled 4G
- A content_manager can take a title from upload → transcoded → rights-approved →
  published without engineering help
- No paid content playable without an entitled session (verified by direct API probing)
- All Phase-1 tables under RLS; `npm run build` clean with strict TS; loading/error
  states on every major route group

**Main risks**

| Risk | Mitigation |
|---|---|
| QPay merchant onboarding latency (real-world weeks) | Start onboarding immediately; adapter tested against sandbox; bank-transfer flow works day one |
| Transcode/DRM assumptions in partner contracts | Honest DRM statement (docs/05 §7) surfaced during rights negotiation, not after |
| Player edge cases on Mongolian Android fleet | Test matrix: low-end Android + Chrome, iOS Safari (native HLS), desktop; mock provider enables player QA before content exists |
| Content ops bottleneck (metadata entry for 300 titles) | CSV import (draft-only) in admin |

## Phase 2 — Growth

**Scope**

- Multi-profile UX (profile picker, per-profile progress/rows; child profiles with PIN)
- Device management **enforcement** (device_limit blocking + revoke UI — schema live since Phase 1)
- Promo codes GA (self-serve redemption at checkout; campaign tracking)
- Detailed reports: per-title funnels, completion rates, churn cohorts
- Rights & revenue-share reporting (partner statements from watch_sessions × revenue_share_percent)
- Notifications (in-app center + email: new episodes of favorited series, payment/subscription events)
- Personalized homepage rows (continue watching ↑, "because you watched" via docs/10 SQL)
- Phone auth if SMS gateway contracted

**Exit criteria**

- Profiles fully isolate progress/recommendations; child profile cannot start an R stream (API-verified)
- Partner statement for a real month reconciles against payments data
- Promo campaign runs end-to-end without engineering involvement

**Main risks:** report queries degrading OLTP (mitigate: read replica or nightly
rollup tables); notification fatigue (per-type opt-outs from day one).

## Phase 3 — Platform expansion

**Scope**

- Mobile apps (iOS/Android) consuming the same APIs; store subscriptions
  (App Store/Google Play receipt validation → `verifyAndApplyPayment` pattern)
- Smart TV (Tizen/webOS or Android TV) — `device_visibility` on homepage sections and
  `device_type` on sessions already model it
- Advanced recommendations (item-item co-occurrence per docs/10 §4)
- Offline downloads + DRM (Widevine/FairPlay via DRM service) — required pair; only if
  partner contracts demand it (docs/05 §7)
- Live/premiere events if the business case appears

**Exit criteria per track:** apps pass store review with billing compliant; TV app
plays 1080p on the 3 dominant TV platforms in-market; DRM (if pursued) validated
against one flagship partner contract.

**Main risks:** store billing revenue share vs MNT pricing; DRM licensing cost
(per-title/per-license fees) vs actual piracy losses — decide on data, not fear;
TV fragmentation (limit to top platforms by market share).

## Launch checklist (end of Phase 1)

- [ ] **Rights verified before publish** — every published title has an approved,
      in-window `content_rights` row; publish guard + nightly sweep tested
- [ ] **Load test the playback endpoint** — `POST /api/playback` at 100 rps burst and
      `/api/progress` at ~350 writes/s through Supavisor; p95 < 500 ms; stream-limit
      correctness under concurrency
- [ ] **Payment sandbox → prod cutover** — prod QPay/SocialPay credentials in Vercel
      prod env only; one real MNT end-to-end payment (paid, receipt, subscription
      applied, webhook + manual-check paths both verified); refund drill executed
- [ ] **Legal pages review** — all six legal pages reviewed by counsel in Mongolian;
      refund policy matches actual payment/refund behavior
- [ ] Security sweep: RLS probe with anon key against every table; secrets scan on
      repo; headers verified in prod response
- [ ] Ops: error monitoring with scrubbing, uptime checks on /, /api/playback,
      webhook endpoints; Supabase backups verified restorable; on-call rotation for
      launch week
