-- ============================================================
-- FLIMIX 0004 — subscriptions & payments
-- subscription_plans, subscriptions, payments,
-- payment_attempts, promo_codes
-- ============================================================

-- ---------- plans ----------

create table public.subscription_plans (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name_mn        text not null,
  name_en        text not null,
  price_mnt      integer not null check (price_mnt >= 0),
  duration_days  integer not null check (duration_days > 0),
  device_limit   integer not null default 1 check (device_limit > 0),
  stream_limit   integer not null default 1 check (stream_limit > 0),
  trial_days     integer not null default 0 check (trial_days >= 0),
  features_mn    text[] not null default '{}',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ---------- subscriptions ----------

create table public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  plan_id             uuid not null references public.subscription_plans(id) on delete restrict,
  status              public.subscription_status not null default 'trial',
  started_at          timestamptz not null default now(),
  current_period_end  timestamptz not null,
  cancelled_at        timestamptz,
  created_at          timestamptz not null default now()
);

create index idx_subscriptions_user_status on public.subscriptions (user_id, status);
create index idx_subscriptions_period_end  on public.subscriptions (current_period_end);

-- ---------- payments ----------

create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  subscription_id  uuid references public.subscriptions(id) on delete set null,
  provider         public.payment_provider not null,
  external_id      text, -- provider-side invoice/transaction id
  amount_mnt       integer not null check (amount_mnt >= 0),
  status           public.payment_status not null default 'pending',
  paid_at          timestamptz,
  receipt_number   text,
  created_at       timestamptz not null default now()
);

-- idempotent webhook processing: one payment per provider transaction
create unique index uq_payments_provider_external
  on public.payments (provider, external_id) where external_id is not null;
create index idx_payments_user on public.payments (user_id, created_at desc);
create index idx_payments_status on public.payments (status) where status = 'pending';

-- ---------- payment attempts (provider request/response audit trail) ----------

create table public.payment_attempts (
  id                uuid primary key default gen_random_uuid(),
  payment_id        uuid not null references public.payments(id) on delete cascade,
  provider          public.payment_provider not null,
  request_payload   jsonb,
  response_payload  jsonb,
  status            public.payment_status not null default 'pending',
  error_message     text,
  created_at        timestamptz not null default now()
);

create index idx_payment_attempts_payment on public.payment_attempts (payment_id);

-- ---------- promo codes ----------

create table public.promo_codes (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique check (code = upper(code)),
  discount_percent  integer check (discount_percent is null or (discount_percent between 1 and 100)),
  bonus_days        integer check (bonus_days is null or bonus_days > 0),
  max_uses          integer check (max_uses is null or max_uses > 0),
  used_count        integer not null default 0 check (used_count >= 0),
  valid_from        timestamptz not null default now(),
  valid_until       timestamptz,
  is_active         boolean not null default true,
  -- a promo must grant something
  constraint promo_codes_has_benefit check (discount_percent is not null or bonus_days is not null)
);
