-- ============================================================
-- FLIMIX 0005 — rights management, partners, homepage & admin
-- content_partners, content_rights, content_right_documents,
-- partner_revenue_shares, homepage_sections,
-- homepage_section_items, audit_logs, admin_notes
-- ============================================================

-- ---------- content partners ----------

create table public.content_partners (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  contact_email  text,
  contact_phone  text,
  created_at     timestamptz not null default now()
);

-- ---------- content rights (licensing windows per movie/series) ----------

create table public.content_rights (
  id                     uuid primary key default gen_random_uuid(),
  content_type           public.catalog_content_type not null,
  content_id             uuid not null, -- movies.id or series.id (polymorphic)
  partner_id             uuid references public.content_partners(id) on delete set null,
  rights_owner           text not null,
  contract_number        text,
  rights_start           date not null,
  rights_end             date not null,
  allowed_countries      text[] not null default '{}', -- ISO country codes; empty = worldwide
  allowed_platforms      text[] not null default '{}', -- ["web","mobile","tv"]; empty = all
  is_exclusive           boolean not null default false,
  revenue_share_percent  numeric(5,2) check (revenue_share_percent is null or (revenue_share_percent between 0 and 100)),
  approval_status        public.rights_approval_status not null default 'pending',
  admin_notes            text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint content_rights_valid_window check (rights_end >= rights_start)
);

create index idx_content_rights_content on public.content_rights (content_type, content_id);
create index idx_content_rights_partner on public.content_rights (partner_id);
-- expiry warnings dashboard: "rights ending soon"
create index idx_content_rights_end on public.content_rights (rights_end) where approval_status = 'approved';

-- ---------- rights supporting documents ----------

create table public.content_right_documents (
  id                uuid primary key default gen_random_uuid(),
  content_right_id  uuid not null references public.content_rights(id) on delete cascade,
  file_name         text not null,
  file_url          text not null,
  uploaded_by       uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index idx_right_documents_right on public.content_right_documents (content_right_id);

-- ---------- partner revenue shares (periodic settlement rows) ----------

create table public.partner_revenue_shares (
  id                 uuid primary key default gen_random_uuid(),
  partner_id         uuid not null references public.content_partners(id) on delete cascade,
  period_start       date not null,
  period_end         date not null,
  gross_revenue_mnt  bigint not null default 0 check (gross_revenue_mnt >= 0),
  share_percent      numeric(5,2) not null check (share_percent between 0 and 100),
  share_amount_mnt   bigint not null default 0 check (share_amount_mnt >= 0),
  is_settled         boolean not null default false,
  settled_at         timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),
  unique (partner_id, period_start, period_end),
  constraint revenue_share_valid_period check (period_end >= period_start)
);

-- ---------- homepage curation ----------

create table public.homepage_sections (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  title_mn           text not null,
  layout             public.homepage_layout not null default 'row',
  query_type         public.homepage_query_type not null default 'manual',
  auto_query         jsonb, -- e.g. {"type":"newest"} | {"type":"country","country":"MN"}
  sort_order         integer not null default 0,
  visible_from       timestamptz,
  visible_until      timestamptz,
  device_visibility  text[] not null default '{web,mobile,tv}',
  status             public.publish_status not null default 'draft',
  created_at         timestamptz not null default now(),
  -- auto sections must define a query; manual sections must not
  constraint homepage_sections_query_shape
    check ((query_type = 'auto' and auto_query is not null) or (query_type = 'manual' and auto_query is null))
);

create index idx_homepage_sections_order on public.homepage_sections (status, sort_order);

create table public.homepage_section_items (
  id            uuid primary key default gen_random_uuid(),
  section_id    uuid not null references public.homepage_sections(id) on delete cascade,
  content_type  public.catalog_content_type not null,
  content_id    uuid not null, -- movies.id or series.id (polymorphic)
  sort_order    integer not null default 0,
  unique (section_id, content_type, content_id)
);

create index idx_homepage_items_section on public.homepage_section_items (section_id, sort_order);

-- ---------- audit logs (append-only; written by service role) ----------

create table public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references auth.users(id) on delete set null,
  action       text not null,      -- e.g. "movie.update", "rights.approve"
  entity_type  text not null,      -- table / domain entity name
  entity_id    text,               -- stringified PK of the affected row
  details      jsonb,
  ip_hash      text,
  created_at   timestamptz not null default now()
);

create index idx_audit_logs_actor  on public.audit_logs (actor_id, created_at desc);
create index idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);

-- ---------- admin notes (free-form internal notes on any entity) ----------

create table public.admin_notes (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,
  entity_id    uuid not null,
  author_id    uuid references auth.users(id) on delete set null,
  note         text not null,
  created_at   timestamptz not null default now()
);

create index idx_admin_notes_entity on public.admin_notes (entity_type, entity_id);
