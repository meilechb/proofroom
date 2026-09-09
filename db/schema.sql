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
  -- One plan. The column stays so tiers can be added later without a rewrite.
  plan text not null default 'studio',
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
update studios set plan = 'studio' where plan <> 'studio';
alter table studios alter column plan set default 'studio';
alter table studios add column if not exists plan_override text;
alter table studios drop constraint if exists studios_plan_override_check;
alter table studios add constraint studios_plan_override_check check (plan_override in ('comped'));
alter table studios add column if not exists read_only_since timestamptz;
alter table studios add column if not exists grace_ends_at timestamptz;

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

-- email_log: delivery events from Resend and what the email was about (plan 2.49)
alter table email_log add column if not exists template_key text;
alter table email_log add column if not exists from_domain text;
alter table email_log add column if not exists related_type text;
alter table email_log add column if not exists related_id uuid;
alter table email_log add column if not exists opened_at timestamptz;
alter table email_log add column if not exists clicked_at timestamptz;
alter table email_log add column if not exists bounced_at timestamptz;
alter table email_log add column if not exists complained_at timestamptz;
