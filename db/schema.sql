-- Proofroom: multi-tenant schema for Neon Postgres.
-- Every statement is idempotent so `npm run build` can apply it on each deploy
-- (scripts/db-migrate.mjs splits on semicolons at end of line; no function bodies).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Accounts and tenancy
-- ---------------------------------------------------------------------------

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  password_hash text,
  email_verified_at timestamptz,
  is_platform_admin boolean not null default false,
  last_login_at timestamptz,
  failed_logins integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_email_lower_idx on users (lower(email));

-- A studio is the tenant. Photographers belong to studios through memberships.
create table if not exists studios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  legal_name text,
  email text not null,
  phone text,
  website text,
  logo_url text,
  brand_color text not null default '#111111',
  timezone text not null default 'America/New_York',
  currency text not null default 'usd',
  custom_domain text unique,
  custom_domain_verified_at timestamptz,
  -- Two tiers: 'free' (1 seat, storage-capped, gated) and 'pro' ($18/seat/mo).
  plan text not null default 'free',
  -- 'comped' = a platform-admin comp of Pro; overrides billing state.
  plan_override text check (plan_override in ('comped')),
  trial_ends_at timestamptz,
  -- Set when the trial or subscription ends unpaid; galleries stay live until grace_ends_at.
  read_only_since timestamptz,
  grace_ends_at timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_account_id text unique,
  stripe_account_status text not null default 'none' check (stripe_account_status in ('none', 'pending', 'enabled', 'restricted')),
  next_order_number integer not null default 1001,
  storage_bytes bigint not null default 0,
  onboarding jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  suspended_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studios_custom_domain_idx on studios (lower(custom_domain));

-- Revision 4 (single plan): applied to databases created before it.
alter table studios drop column if exists billing_interval;
alter table studios drop constraint if exists studios_plan_check;
alter table studios add column if not exists plan_override text;
alter table studios drop constraint if exists studios_plan_override_check;
alter table studios add constraint studios_plan_override_check check (plan_override in ('comped'));
alter table studios add column if not exists read_only_since timestamptz;
alter table studios add column if not exists grace_ends_at timestamptz;

-- Revision 5 (Free + Pro per-seat): supersedes the single 'studio' plan.
-- read_only_since/grace_ends_at stay for platform suspension; the trial path
-- no longer sets them (a lapsed trial downgrades to Free, see downgradeExpiredTrials).
update studios set plan = 'pro'
  where subscription_status in ('active', 'trialing', 'past_due') or plan_override = 'comped';
update studios set plan = 'free' where plan not in ('free', 'pro');
alter table studios alter column plan set default 'free';
alter table studios drop constraint if exists studios_plan_check;
alter table studios add constraint studios_plan_check check (plan in ('free', 'pro'));

create table if not exists memberships (
  user_id uuid not null references users (id) on delete cascade,
  studio_id uuid not null references studios (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (user_id, studio_id)
);

create index if not exists memberships_studio_idx on memberships (studio_id);

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  token_hash text not null unique,
  invited_by uuid references users (id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Database-backed sessions: revocable, one row per signed-in device.
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token_hash text not null unique,
  studio_id uuid references studios (id) on delete set null,
  user_agent text,
  ip text,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_idx on sessions (user_id);

-- One-time tokens: email verification, password reset. Hash only.
create table if not exists auth_tokens (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('verify_email', 'reset_password', 'magic_link')),
  user_id uuid not null references users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Sliding-window rate limits for public endpoints (login, signup, access codes, contact).
create table if not exists rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

create table if not exists audit_log (
  id bigserial primary key,
  studio_id uuid references studios (id) on delete cascade,
  actor_user_id uuid references users (id) on delete set null,
  actor_label text,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_studio_idx on audit_log (studio_id, created_at desc);

-- Personal API tokens for the Lightroom plugin. Scoped to one studio.
create table if not exists api_tokens (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  created_by uuid references users (id) on delete set null,
  name text not null,
  token_hash text not null unique,
  token_prefix text not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists api_tokens_studio_idx on api_tokens (studio_id);

-- ---------------------------------------------------------------------------
-- Stripe bookkeeping
-- ---------------------------------------------------------------------------

-- Webhook idempotency: one row per processed event id (platform and connect).
create table if not exists stripe_events (
  id text primary key,
  type text not null,
  account text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Studio domain: clients, packages, sessions (orders), galleries, photos
-- ---------------------------------------------------------------------------

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  company text,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_studio_idx on clients (studio_id, created_at desc);
create index if not exists clients_studio_email_idx on clients (studio_id, lower(email));

create table if not exists inquiries (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  client_id uuid references clients (id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  message text,
  source text,
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists inquiries_studio_idx on inquiries (studio_id, created_at desc);

create table if not exists packages (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  deposit_cents integer not null default 0 check (deposit_cents >= 0),
  included_finals integer not null default 0,
  extra_final_cents integer not null default 0,
  includes text[] not null default '{}',
  turnaround text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (studio_id, slug)
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  order_number integer not null,
  client_id uuid not null references clients (id) on delete restrict,
  package_id uuid references packages (id) on delete set null,
  title text not null,
  description text,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'pending_payment' check (status in (
    'draft', 'pending_payment', 'paid', 'scheduled', 'editing',
    'proofing', 'final_delivered', 'completed', 'cancelled'
  )),
  shoot_date date,
  notes text,
  deposit_cents integer not null default 0,
  included_finals integer not null default 0,
  extra_final_cents integer not null default 0,
  contract_version text,
  contract_signed_at timestamptz,
  contract_signed_name text,
  contract_signed_ip text,
  contract_portfolio_ok boolean,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, order_number)
);

create index if not exists orders_studio_idx on orders (studio_id, created_at desc);
create index if not exists orders_client_idx on orders (client_id);

-- One row per payment attempt. Only status = 'paid' rows count toward the balance.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  order_id uuid not null references orders (id) on delete cascade,
  kind text not null check (kind in ('deposit', 'balance', 'full', 'manual')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded')),
  method text not null default 'card',
  stripe_account_id text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payments_order_idx on payments (order_id, created_at);

create table if not exists galleries (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  order_id uuid references orders (id) on delete set null,
  client_id uuid not null references clients (id) on delete restrict,
  slug text not null,
  title text not null,
  kind text not null check (kind in ('proof', 'final')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  access_code text,
  allow_downloads boolean not null default false,
  welcome_message text,
  expires_at timestamptz,
  source text not null default 'web' check (source in ('web', 'lightroom')),
  -- Team headshot days: one gallery per person under a parent "event" gallery.
  parent_id uuid references galleries (id) on delete set null,
  subject_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, slug)
);

create index if not exists galleries_studio_idx on galleries (studio_id, created_at desc);
create index if not exists galleries_client_idx on galleries (client_id);
create index if not exists galleries_parent_idx on galleries (parent_id);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  gallery_id uuid not null references galleries (id) on delete cascade,
  original_url text not null unique,
  preview_url text not null,
  lr_photo_id text,
  filename text not null,
  width integer,
  height integer,
  size_bytes bigint not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists photos_gallery_idx on photos (gallery_id, sort_order);
create unique index if not exists photos_gallery_lr_photo_idx on photos (gallery_id, lr_photo_id) where lr_photo_id is not null;

create table if not exists photo_comments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  photo_id uuid not null references photos (id) on delete cascade,
  gallery_id uuid not null references galleries (id) on delete cascade,
  author_name text not null,
  author_role text not null check (author_role in ('studio', 'client')),
  body text not null check (char_length(body) between 1 and 2000),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists photo_comments_gallery_idx on photo_comments (gallery_id, created_at);

create table if not exists photo_selections (
  photo_id uuid primary key references photos (id) on delete cascade,
  studio_id uuid not null references studios (id) on delete cascade,
  gallery_id uuid not null references galleries (id) on delete cascade,
  selected boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists photo_selections_gallery_idx on photo_selections (gallery_id);

create table if not exists email_templates (
  studio_id uuid not null references studios (id) on delete cascade,
  key text not null,
  subject text not null,
  body text not null,
  cta_label text,
  updated_at timestamptz not null default now(),
  primary key (studio_id, key)
);

create table if not exists email_log (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios (id) on delete cascade,
  kind text,
  to_address text not null,
  subject text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error text,
  provider_id text,
  created_at timestamptz not null default now()
);

create index if not exists email_log_studio_idx on email_log (studio_id, created_at desc);

-- Marketing site inbound: waitlist / contact form on the root domain.
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  message text,
  source text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Asset library, portfolio, tenant website, CRM extras, analytics
-- ---------------------------------------------------------------------------

-- Every uploaded image or document. Portfolio items and site blocks reference assets by id.
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  kind text not null default 'image' check (kind in ('image', 'logo', 'document')),
  url text not null,
  thumb_url text,
  web_url text,
  filename text not null,
  content_type text,
  width integer,
  height integer,
  size_bytes bigint not null default 0,
  alt text not null default '',
  tags text[] not null default '{}',
  folder text,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists assets_studio_idx on assets (studio_id, created_at desc);

create table if not exists portfolio_items (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  asset_id uuid not null references assets (id) on delete cascade,
  category text not null default 'headshots',
  caption text,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (studio_id, asset_id)
);

create index if not exists portfolio_items_studio_idx on portfolio_items (studio_id, sort_order);

-- Tenant website pages. `blocks` is an ordered array of typed sections (see src/lib/site.ts).
create table if not exists site_pages (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  slug text not null,
  title text not null,
  kind text not null default 'custom' check (kind in ('home', 'portfolio', 'pricing', 'about', 'contact', 'gallery_login', 'area', 'custom')),
  blocks jsonb not null default '[]'::jsonb,
  draft_blocks jsonb,
  seo jsonb not null default '{}'::jsonb,
  nav_label text,
  nav_order integer,
  in_footer boolean not null default false,
  is_published boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (studio_id, slug)
);

create index if not exists site_pages_studio_idx on site_pages (studio_id, nav_order);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  name text not null,
  body text not null,
  rating smallint check (rating between 1 and 5),
  source text,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  client_id uuid references clients (id) on delete cascade,
  order_id uuid references orders (id) on delete set null,
  title text not null,
  due_on date,
  done_at timestamptz,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists tasks_studio_idx on tasks (studio_id, done_at, due_on);

-- Client timeline entries written by people (system events live in audit_log).
create table if not exists client_notes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  kind text not null default 'note' check (kind in ('note', 'call', 'email', 'meeting')),
  body text not null,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists client_notes_client_idx on client_notes (client_id, created_at desc);

alter table clients add column if not exists tags text[] not null default '{}';
alter table clients add column if not exists unsubscribed_at timestamptz;

-- Booking requests from the website booking form (richer than a plain inquiry).
create table if not exists booking_requests (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  inquiry_id uuid references inquiries (id) on delete set null,
  package_id uuid references packages (id) on delete set null,
  people_count integer,
  preferred_dates text,
  location_pref text,
  created_at timestamptz not null default now()
);

-- Daily-bucketed counters. One row per (studio, target, event, day).
create table if not exists analytics_daily (
  studio_id uuid not null references studios (id) on delete cascade,
  day date not null,
  event text not null,
  target text not null,
  count integer not null default 0,
  primary key (studio_id, day, event, target)
);

-- Uploaded PDFs and generated documents kept in the private store.
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  client_id uuid references clients (id) on delete cascade,
  order_id uuid references orders (id) on delete cascade,
  kind text not null default 'other' check (kind in ('agreement', 'invoice', 'other')),
  title text not null,
  url text not null,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

-- Automation sends: guarantees one email per (rule, target).
create table if not exists automation_sends (
  studio_id uuid not null references studios (id) on delete cascade,
  rule text not null,
  target text not null,
  sent_at timestamptz not null default now(),
  primary key (studio_id, rule, target)
);

-- ---------------------------------------------------------------------------
-- Revision 4 additions (September 2026). Columns are added with
-- "add column if not exists" so fresh and existing databases converge.
-- ---------------------------------------------------------------------------

-- studios: the studio's own Stripe account connection (plan 2.6)
alter table studios add column if not exists stripe_connect_method text not null default 'none';
alter table studios drop constraint if exists studios_stripe_connect_method_check;
alter table studios add constraint studios_stripe_connect_method_check check (stripe_connect_method in ('oauth', 'onboarding', 'manual', 'none'));
alter table studios add column if not exists stripe_charges_enabled boolean not null default false;
alter table studios add column if not exists stripe_details_submitted boolean not null default false;
alter table studios add column if not exists stripe_connected_at timestamptz;
alter table studios add column if not exists manual_payment_instructions text;
alter table studios add column if not exists manual_payment_link text;

-- studios: referral code and the template website (plan 2.8)
alter table studios add column if not exists referral_code text;
create unique index if not exists studios_referral_code_idx on studios (referral_code) where referral_code is not null;
alter table studios add column if not exists referred_by_code text;
alter table studios add column if not exists site_template text not null default 'editorial';
alter table studios drop constraint if exists studios_site_template_check;
alter table studios add constraint studios_site_template_check check (site_template in ('editorial', 'gallery'));
alter table studios add column if not exists site jsonb not null default '{}'::jsonb;
alter table studios add column if not exists site_draft jsonb;
alter table studios add column if not exists site_published_at timestamptz;

-- Platform admin: scheduled hard-delete of a studio's data (plan 19.3.6/7)
alter table studios add column if not exists purge_at timestamptz;
-- Leads: mark a lead contacted from the platform admin (plan 19.6)
alter table leads add column if not exists contacted_at timestamptz;

-- clients: pipeline stage, activity, archive timestamp, one client per email (plan 2.19)
alter table clients add column if not exists stage text not null default 'lead';
alter table clients drop constraint if exists clients_stage_check;
alter table clients add constraint clients_stage_check check (stage in ('lead', 'awaiting_payment', 'booked', 'proofing', 'delivered', 'archived'));
alter table clients add column if not exists last_activity_at timestamptz;
alter table clients add column if not exists archived_at timestamptz;
alter table clients add column if not exists source text;
create unique index if not exists clients_studio_email_unique_idx on clients (studio_id, lower(email));

-- orders: scheduling and cancellation details (plan 2.27)
alter table orders add column if not exists scheduled_at timestamptz;
alter table orders add column if not exists location text;
alter table orders add column if not exists discount_cents integer not null default 0;
alter table orders add column if not exists cancelled_at timestamptz;
alter table orders add column if not exists cancel_reason text;

-- packages: session length and whether the package is offered on the booking page (plan 21.10)
alter table packages add column if not exists duration_minutes integer;
alter table packages add column if not exists bookable boolean not null default true;

-- payments: refunds and disputes mirrored from the studio's Stripe account (plan 2.29)
alter table payments add column if not exists stripe_charge_id text;
alter table payments add column if not exists refunded_cents integer not null default 0;
alter table payments add column if not exists dispute_status text;
alter table payments add column if not exists disputed_at timestamptz;
alter table payments add column if not exists receipt_url text;
alter table payments add column if not exists failure_message text;
alter table payments drop constraint if exists payments_status_check;
alter table payments add constraint payments_status_check check (status in ('pending', 'paid', 'partially_refunded', 'refunded', 'failed', 'disputed'));

-- galleries: access, download and proofing options (plan 2.33)
alter table galleries add column if not exists password_hash text;
alter table galleries add column if not exists download_pin_hash text;
alter table galleries add column if not exists download_size text not null default 'web';
alter table galleries drop constraint if exists galleries_download_size_check;
alter table galleries add constraint galleries_download_size_check check (download_size in ('web', 'full', 'both'));
alter table galleries add column if not exists pay_gated boolean not null default false;
alter table galleries add column if not exists allow_comments boolean not null default true;
alter table galleries add column if not exists allow_client_upload boolean not null default false;
alter table galleries add column if not exists allow_sharing boolean not null default true;
alter table galleries add column if not exists watermark boolean not null default false;
alter table galleries add column if not exists cover_photo_id uuid references photos (id) on delete set null;
alter table galleries add column if not exists sort_mode text not null default 'manual';
alter table galleries drop constraint if exists galleries_sort_mode_check;
alter table galleries add constraint galleries_sort_mode_check check (sort_mode in ('manual', 'filename', 'captured'));
alter table galleries add column if not exists published_at timestamptz;
alter table galleries add column if not exists view_count integer not null default 0;

-- photos: duplicates, provenance, soft delete (plan 2.35)
alter table photos add column if not exists thumb_url text;
alter table photos add column if not exists sha256 text;
alter table photos add column if not exists uploaded_by text not null default 'studio';
alter table photos drop constraint if exists photos_uploaded_by_check;
alter table photos add constraint photos_uploaded_by_check check (uploaded_by in ('studio', 'client', 'plugin'));
alter table photos add column if not exists captured_at timestamptz;
alter table photos add column if not exists deleted_at timestamptz;

-- assets: usage tracking and soft delete (plan 2.41)
alter table assets add column if not exists usage_count integer not null default 0;
alter table assets add column if not exists deleted_at timestamptz;

-- Per-user notification preferences, one set per membership (plan 17.5)
alter table memberships add column if not exists notification_prefs jsonb;

-- email_log: delivery events from Resend and what the email was about (plan 2.49)
alter table email_log add column if not exists template_key text;
alter table email_log add column if not exists from_domain text;
alter table email_log add column if not exists related_type text;
alter table email_log add column if not exists related_id uuid;
alter table email_log add column if not exists opened_at timestamptz;
alter table email_log add column if not exists clicked_at timestamptz;
alter table email_log add column if not exists bounced_at timestamptz;
alter table email_log add column if not exists complained_at timestamptz;
alter table email_log add column if not exists delivered_at timestamptz;
alter table email_log add column if not exists last_event text;
alter table email_log add column if not exists body text;
create index if not exists email_log_provider_idx on email_log (provider_id);

-- ---------------------------------------------------------------------------
-- Revision 4 new tables
-- ---------------------------------------------------------------------------

-- Platform-wide toggles (signups_open, maintenance_banner, min_plugin_version). Plan 2.17.
create table if not exists platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- The template website replaces site_pages: the site lives in studios.site / site_draft. Plan 2.44.
drop table if exists site_pages;

-- Client timeline: system events (gallery sent, payment received, email sent). Plan 2.24.
create table if not exists client_events (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  kind text not null,
  ref_type text,
  ref_id uuid,
  summary text not null default '',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists client_events_client_idx on client_events (client_id, created_at desc);

-- Per-studio agreement text, versioned; orders store the version they were signed under. Plan 2.31.
create table if not exists agreement_templates (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  version integer not null,
  body_md text not null,
  is_active boolean not null default true,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (studio_id, version)
);

-- Gallery analytics per visitor. Plan 2.38, 2.39.
create table if not exists gallery_visits (
  gallery_id uuid not null references galleries (id) on delete cascade,
  visitor_hash text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  views integer not null default 1,
  downloads integer not null default 0,
  primary key (gallery_id, visitor_hash)
);

create table if not exists gallery_downloads (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references galleries (id) on delete cascade,
  photo_id uuid references photos (id) on delete set null,
  kind text not null check (kind in ('single', 'selection', 'zip')),
  size text not null default 'web' check (size in ('web', 'full')),
  visitor_hash text,
  created_at timestamptz not null default now()
);

create index if not exists gallery_downloads_gallery_idx on gallery_downloads (gallery_id, created_at desc);

-- Local area landing pages (/headshots/[town]). Plan 2.45.
create table if not exists site_areas (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  town text not null,
  slug text not null,
  intro_override text,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (studio_id, slug)
);

-- The studio's own sending domain in Resend. One per studio. Plan 2.51.
create table if not exists sending_domains (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null unique references studios (id) on delete cascade,
  domain text not null unique,
  resend_domain_id text unique,
  status text not null default 'not_started' check (status in ('not_started', 'pending', 'verified', 'failed', 'temporary_failure')),
  records jsonb not null default '[]'::jsonb,
  from_local_part text not null default 'hello',
  region text,
  verified_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Addresses we must never email again for a studio (hard bounce, complaint, manual). Plan 2.52.
create table if not exists suppressions (
  studio_id uuid not null references studios (id) on delete cascade,
  email text not null,
  reason text not null check (reason in ('bounce', 'complaint', 'manual', 'unsubscribe')),
  created_at timestamptz not null default now(),
  primary key (studio_id, email)
);

-- One-off emails to a filtered client list. Plan 2.53.
create table if not exists broadcasts (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  subject text not null,
  body text not null,
  filter jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists broadcasts_studio_idx on broadcasts (studio_id, created_at desc);

-- Referral program: 10% off for 12 months for both parties. Plan 2.54, 2.55.
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_studio_id uuid not null references studios (id) on delete cascade,
  code text not null,
  referred_studio_id uuid references studios (id) on delete set null,
  referred_email text,
  status text not null default 'invited' check (status in ('invited', 'signed_up', 'rewarded', 'void')),
  signed_up_at timestamptz,
  rewarded_at timestamptz,
  invoice_id text,
  referrer_reward_state text not null default 'none' check (referrer_reward_state in ('none', 'pending', 'queued', 'applied', 'reversed')),
  referred_reward_state text not null default 'none' check (referred_reward_state in ('none', 'pending', 'queued', 'applied', 'reversed')),
  void_reason text,
  created_at timestamptz not null default now()
);

create index if not exists referrals_referrer_idx on referrals (referrer_studio_id, created_at desc);
create unique index if not exists referrals_referred_studio_idx on referrals (referred_studio_id) where referred_studio_id is not null;

create table if not exists reward_queue (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  coupon_id text not null,
  reason text not null,
  referral_id uuid references referrals (id) on delete set null,
  apply_after timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists reward_queue_pending_idx on reward_queue (studio_id) where applied_at is null;

-- Imports from other gallery tools or plain zips. Plan 2.56, 2.57.
create table if not exists imports (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  source text not null check (source in ('pixieset', 'pictime', 'shootproof', 'zip', 'csv')),
  status text not null default 'uploading' check (status in ('uploading', 'scanning', 'review', 'running', 'done', 'failed', 'cancelled')),
  mapping jsonb not null default '{}'::jsonb,
  file_count integer not null default 0,
  gallery_count integer not null default 0,
  photo_count integer not null default 0,
  processed_count integer not null default 0,
  log jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists import_files (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references imports (id) on delete cascade,
  url text not null,
  filename text not null,
  size_bytes bigint not null default 0,
  status text not null default 'pending' check (status in ('pending', 'scanned', 'processed', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists import_files_import_idx on import_files (import_id);

-- Booking page slots. Confirmed and held slots for one studio cannot overlap. Plan 2.59.
create extension if not exists btree_gist;

create table if not exists booking_slots (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  package_id uuid references packages (id) on delete set null,
  client_id uuid references clients (id) on delete set null,
  order_id uuid references orders (id) on delete set null,
  status text not null default 'held' check (status in ('held', 'confirmed', 'cancelled', 'no_show', 'completed')),
  hold_expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  exclude using gist (studio_id with =, tstzrange(starts_at, ends_at) with &&) where (status in ('held', 'confirmed'))
);

create index if not exists booking_slots_studio_idx on booking_slots (studio_id, starts_at);

-- Session planning: notes, shot list, mood board. Plan 2.60.
create table if not exists session_plans (
  order_id uuid primary key references orders (id) on delete cascade,
  studio_id uuid not null references studios (id) on delete cascade,
  notes_md text not null default '',
  shot_list jsonb not null default '[]'::jsonb,
  mood_asset_ids uuid[] not null default '{}',
  client_visible boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes for list queries (plan 2.61 to 2.64)
-- ---------------------------------------------------------------------------
create index if not exists clients_studio_stage_idx on clients (studio_id, stage);
create index if not exists inquiries_studio_unread_idx on inquiries (studio_id) where status = 'new';
create index if not exists orders_studio_status_idx on orders (studio_id, status);
create index if not exists orders_studio_scheduled_idx on orders (studio_id, scheduled_at);
create index if not exists payments_studio_paid_idx on payments (studio_id, paid_at);
create index if not exists galleries_studio_published_idx on galleries (studio_id) where status = 'published';
create index if not exists photos_sha256_idx on photos (sha256) where sha256 is not null;
create index if not exists photo_comments_unresolved_idx on photo_comments (gallery_id) where not resolved;
create index if not exists photo_selections_kind_idx on photo_selections (gallery_id, selected);
create index if not exists assets_studio_kind_idx on assets (studio_id, kind);
create index if not exists assets_tags_idx on assets using gin (tags);
create index if not exists sessions_expires_idx on sessions (expires_at);
create index if not exists email_log_related_idx on email_log (related_type, related_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance (plan 2.65). The function body stays on one line
-- because scripts/db-migrate.mjs splits statements on ";" at end of line.
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists studios_set_updated_at on studios;
create trigger studios_set_updated_at before update on studios for each row execute function set_updated_at();
drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at before update on users for each row execute function set_updated_at();
drop trigger if exists clients_set_updated_at on clients;
create trigger clients_set_updated_at before update on clients for each row execute function set_updated_at();
drop trigger if exists orders_set_updated_at on orders;
create trigger orders_set_updated_at before update on orders for each row execute function set_updated_at();
drop trigger if exists galleries_set_updated_at on galleries;
create trigger galleries_set_updated_at before update on galleries for each row execute function set_updated_at();
drop trigger if exists sending_domains_set_updated_at on sending_domains;
create trigger sending_domains_set_updated_at before update on sending_domains for each row execute function set_updated_at();
drop trigger if exists broadcasts_set_updated_at on broadcasts;
create trigger broadcasts_set_updated_at before update on broadcasts for each row execute function set_updated_at();
drop trigger if exists imports_set_updated_at on imports;
create trigger imports_set_updated_at before update on imports for each row execute function set_updated_at();
drop trigger if exists booking_slots_set_updated_at on booking_slots;
create trigger booking_slots_set_updated_at before update on booking_slots for each row execute function set_updated_at();
drop trigger if exists session_plans_set_updated_at on session_plans;
create trigger session_plans_set_updated_at before update on session_plans for each row execute function set_updated_at();
drop trigger if exists platform_settings_set_updated_at on platform_settings;
create trigger platform_settings_set_updated_at before update on platform_settings for each row execute function set_updated_at();

-- auth_tokens: email change tokens carry the new address in meta (plan 5.18)
alter table auth_tokens add column if not exists meta jsonb not null default '{}'::jsonb;
alter table auth_tokens drop constraint if exists auth_tokens_kind_check;
alter table auth_tokens add constraint auth_tokens_kind_check check (kind in ('verify_email', 'reset_password', 'magic_link', 'change_email'));

-- Marketing site page views, aggregated per day and path (plan 8.21). No studio, no visitor identity.
create table if not exists marketing_views_daily (
  day date not null,
  path text not null,
  referrer text not null default '',
  count integer not null default 0,
  primary key (day, path, referrer)
);

-- ---------------------------------------------------------------------------
-- Revision — Store (STORE-BUILD-PLAN.md phase S1): sell portfolio images,
-- packages, licences and gift cards. Money is integer cents; every table
-- carries studio_id and is registered in OwnedTable (src/lib/auth.ts).
-- Selling is Pro-only (entitlements.store). Physical prints (print_*) are the
-- deferred track and unused until phase S31.
-- ---------------------------------------------------------------------------

-- Curated groups of images that can be sold or unlocked as one.
create table if not exists store_collections (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  cover_asset_id uuid references assets (id) on delete set null,
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'hidden')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, slug)
);

create index if not exists store_collections_studio_idx on store_collections (studio_id, sort_order);

create table if not exists store_collection_items (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  collection_id uuid not null references store_collections (id) on delete cascade,
  photo_id uuid references photos (id) on delete cascade,
  asset_id uuid references assets (id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists store_collection_items_idx on store_collection_items (collection_id, sort_order);

-- A sellable item. `kind` selects the shape; source columns point at what is sold.
create table if not exists store_products (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  kind text not null check (kind in ('image', 'bundle', 'gallery_unlock', 'collection_unlock', 'gift_card', 'voucher', 'digital', 'print')),
  slug text not null,
  title text not null,
  description text,
  asset_id uuid references assets (id) on delete set null,
  photo_id uuid references photos (id) on delete set null,
  gallery_id uuid references galleries (id) on delete set null,
  collection_id uuid references store_collections (id) on delete set null,
  license_text text,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  seo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, slug)
);

create index if not exists store_products_studio_idx on store_products (studio_id, sort_order);
create index if not exists store_products_kind_idx on store_products (studio_id, kind) where is_active;

-- Priced options on a product: one row per resolution x licence.
create table if not exists product_prices (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  product_id uuid not null references store_products (id) on delete cascade,
  resolution text not null default 'original' check (resolution in ('web', 'standard', 'original')),
  license text not null default 'personal' check (license in ('personal', 'rf', 'rm', 'extended')),
  amount_cents integer not null check (amount_cents >= 0),
  compare_at_cents integer check (compare_at_cents >= 0),
  min_pick integer,
  max_pick integer,
  rm_matrix jsonb,
  sale_starts_at timestamptz,
  sale_ends_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists product_prices_product_idx on product_prices (product_id, sort_order);

-- Reusable pricing presets applied across many products.
create table if not exists price_sheets (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists price_sheet_rows (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  sheet_id uuid not null references price_sheets (id) on delete cascade,
  resolution text not null default 'original' check (resolution in ('web', 'standard', 'original')),
  license text not null default 'personal' check (license in ('personal', 'rf', 'rm', 'extended')),
  amount_cents integer not null check (amount_cents >= 0),
  min_pick integer,
  max_pick integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists price_sheet_rows_sheet_idx on price_sheet_rows (sheet_id, sort_order);

-- Non-image downloadable files (presets, LUTs, e-books) attached to a product.
create table if not exists digital_files (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  product_id uuid not null references store_products (id) on delete cascade,
  url text not null,
  filename text not null,
  content_type text,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists digital_files_product_idx on digital_files (product_id);

-- Physical print catalogue (deferred track, unused until S31).
create table if not exists print_products (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  product_id uuid not null references store_products (id) on delete cascade,
  lab text,
  created_at timestamptz not null default now()
);

create table if not exists print_variants (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  print_product_id uuid not null references print_products (id) on delete cascade,
  name text not null,
  size text,
  finish text,
  base_cost_cents integer not null default 0 check (base_cost_cents >= 0),
  price_cents integer not null default 0 check (price_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists print_variants_product_idx on print_variants (print_product_id);

-- A buyer purchase (the store's order). order_number is assigned per studio in code.
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  order_number integer not null,
  buyer_email text not null,
  buyer_name text,
  buyer_client_id uuid references clients (id) on delete set null,
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'disputed')),
  payment_mode text not null default 'connected' check (payment_mode in ('connected', 'marketplace', 'manual')),
  discount_code text,
  stripe_account_id text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  dispute_status text,
  receipt_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, order_number)
);

create index if not exists sales_studio_idx on sales (studio_id, created_at desc);
create index if not exists sales_buyer_idx on sales (studio_id, buyer_email);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  sale_id uuid not null references sales (id) on delete cascade,
  product_id uuid references store_products (id) on delete set null,
  photo_id uuid references photos (id) on delete set null,
  asset_id uuid references assets (id) on delete set null,
  kind text not null default 'image',
  resolution text not null default 'original',
  license text not null default 'personal',
  usage_scope jsonb not null default '{}'::jsonb,
  qty integer not null default 1 check (qty > 0),
  unit_amount_cents integer not null default 0 check (unit_amount_cents >= 0),
  amount_cents integer not null default 0 check (amount_cents >= 0),
  license_document_id uuid references documents (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists sale_items_sale_idx on sale_items (sale_id);

-- The right to download a purchased file: a hashed token, an expiry and a cap.
create table if not exists download_grants (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  sale_id uuid not null references sales (id) on delete cascade,
  sale_item_id uuid references sale_items (id) on delete cascade,
  photo_id uuid references photos (id) on delete set null,
  file_id uuid references digital_files (id) on delete set null,
  resolution text not null default 'original',
  token_hash text not null unique,
  expires_at timestamptz,
  max_downloads integer not null default 5,
  downloads_used integer not null default 0,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists download_grants_sale_idx on download_grants (sale_id);

create table if not exists download_events (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  grant_id uuid not null references download_grants (id) on delete cascade,
  ip text,
  ua text,
  bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists download_events_grant_idx on download_events (grant_id, created_at desc);

create table if not exists discount_codes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  code text not null,
  kind text not null check (kind in ('percent', 'fixed', 'free_ship')),
  value integer not null check (value >= 0),
  min_subtotal_cents integer,
  product_scope uuid references store_products (id) on delete cascade,
  gallery_scope uuid references galleries (id) on delete cascade,
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses integer,
  uses integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, code)
);

create table if not exists discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  code_id uuid not null references discount_codes (id) on delete cascade,
  sale_id uuid not null references sales (id) on delete cascade,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists discount_redemptions_code_idx on discount_redemptions (code_id);

create table if not exists gift_cards (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  code_hash text not null unique,
  code_last4 text not null,
  initial_cents integer not null check (initial_cents >= 0),
  balance_cents integer not null check (balance_cents >= 0),
  currency text not null default 'usd',
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists gift_card_txns (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  gift_card_id uuid not null references gift_cards (id) on delete cascade,
  sale_id uuid references sales (id) on delete set null,
  delta_cents integer not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists gift_card_txns_card_idx on gift_card_txns (gift_card_id, created_at);

create table if not exists store_favorites (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  buyer_key text not null,
  product_id uuid references store_products (id) on delete cascade,
  photo_id uuid references photos (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (studio_id, buyer_key, product_id)
);

create table if not exists carts (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios (id) on delete cascade,
  buyer_email text,
  items jsonb not null default '[]'::jsonb,
  recovered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists carts_studio_idx on carts (studio_id, updated_at desc);

-- Store metrics, aggregated per day, event and target (product id). No id column.
create table if not exists store_events_daily (
  studio_id uuid not null references studios (id) on delete cascade,
  day date not null,
  event text not null,
  target text not null default '',
  count integer not null default 0,
  primary key (studio_id, day, event, target)
);

-- updated_at triggers for the mutable store tables.
drop trigger if exists store_collections_set_updated_at on store_collections;
create trigger store_collections_set_updated_at before update on store_collections for each row execute function set_updated_at();
drop trigger if exists store_products_set_updated_at on store_products;
create trigger store_products_set_updated_at before update on store_products for each row execute function set_updated_at();
drop trigger if exists price_sheets_set_updated_at on price_sheets;
create trigger price_sheets_set_updated_at before update on price_sheets for each row execute function set_updated_at();
drop trigger if exists sales_set_updated_at on sales;
create trigger sales_set_updated_at before update on sales for each row execute function set_updated_at();
drop trigger if exists discount_codes_set_updated_at on discount_codes;
create trigger discount_codes_set_updated_at before update on discount_codes for each row execute function set_updated_at();
drop trigger if exists gift_cards_set_updated_at on gift_cards;
create trigger gift_cards_set_updated_at before update on gift_cards for each row execute function set_updated_at();
drop trigger if exists carts_set_updated_at on carts;
create trigger carts_set_updated_at before update on carts for each row execute function set_updated_at();

-- Store fulfilment reuses gallery_downloads for purchase downloads; widen the kind check.
alter table gallery_downloads drop constraint if exists gallery_downloads_kind_check;
alter table gallery_downloads add constraint gallery_downloads_kind_check check (kind in ('single', 'selection', 'zip', 'purchase'));

-- Both Stripe webhook routes stamp processed_at; the column was never declared.
alter table stripe_events add column if not exists processed_at timestamptz;

-- A sale can be part-paid with a studio gift card. The spend is drawn down on
-- fulfilment (guarded, once) so an abandoned checkout never touches the balance.
-- Declared here, after gift_cards exists, so the reference resolves.
alter table sales add column if not exists gift_card_id uuid references gift_cards (id) on delete set null;
alter table sales add column if not exists gift_card_cents integer not null default 0;

-- A gift card can itself be sold as a product; link it to the line that sold it
-- so fulfilment issues it exactly once.
alter table gift_cards add column if not exists sale_item_id uuid references sale_items (id) on delete set null;
create unique index if not exists gift_cards_sale_item_idx on gift_cards (sale_item_id) where sale_item_id is not null;
