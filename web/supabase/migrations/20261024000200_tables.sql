-- Phool Ghar: tables, indexes, sequences. All money is integer paise. Safe to re-run.

create sequence if not exists public.order_no_seq;

create or replace function public.next_order_no() returns text
  language sql volatile set search_path = public as $$
  select 'PG-' || to_char(now() at time zone 'Asia/Kolkata', 'YY') || '-' ||
         lpad(nextval('public.order_no_seq')::text, 6, '0')
$$;

-- ---------------------------------------------------------------- identity
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'customer',
  full_name text,
  phone text,
  email text,
  permissions text[] not null default '{}',
  active boolean not null default true,
  lang text not null default 'en',
  notify_prefs jsonb not null default '{"email":true,"whatsapp":true,"sms":false,"push":false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_permissions_valid check (
    permissions <@ array['orders','products','stock','subscriptions','customers','coupons','reports','settings','team']::text[]),
  constraint profiles_lang_valid check (lang ~ '^[a-z]{2}(-[A-Za-z]{2})?$')
);
create index if not exists profiles_role_idx on public.profiles (role) where role <> 'customer';

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default 'Home' check (label in ('Home', 'Office', 'Temple', 'Shop', 'Other')),
  recipient_name text not null check (char_length(recipient_name) between 2 and 100),
  recipient_phone text not null check (recipient_phone ~ '^[6-9][0-9]{9}$'),
  line1 text not null check (char_length(line1) between 3 and 200),
  line2 text check (char_length(line2) <= 200),
  landmark text check (char_length(landmark) <= 200),
  city text not null check (char_length(city) between 2 and 80),
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  instructions text check (char_length(instructions) <= 300),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses (user_id);
create unique index if not exists addresses_one_default_idx on public.addresses (user_id) where is_default;

-- ---------------------------------------------------------------- config
create table if not exists public.delivery_zones (
  pincode text primary key check (pincode ~ '^[1-9][0-9]{5}$'),
  city text not null,
  area text,
  fee_paise integer not null default 0 check (fee_paise >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_slots (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{1,31}$'),
  label text not null,
  start_time time not null,
  end_time time not null,
  capacity integer not null default 50 check (capacity >= 0),
  subscription_ok boolean not null default true,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  constraint delivery_slots_window check (end_time > start_time)
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- catalogue
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  blurb text,
  image_url text,
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  tagline text,
  description text,
  category_id uuid references public.categories (id) on delete restrict,
  image_url text,
  gallery jsonb not null default '[]'::jsonb,
  price_paise integer not null check (price_paise >= 0),
  per_day_paise integer check (per_day_paise is null or per_day_paise > 0),
  tag text,
  care text,
  active boolean not null default true,
  track_stock boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_active_sort_idx on public.products (sort) where active;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_key text not null check (variant_key in ('small', 'regular', 'large')),
  label text not null,
  note text,
  multiplier numeric(4, 2) not null check (multiplier > 0),
  created_at timestamptz not null default now(),
  unique (product_id, variant_key)
);

create table if not exists public.product_stock (
  product_id uuid not null references public.products (id) on delete cascade,
  stock_date date not null,
  qty integer not null default 0 check (qty >= 0),
  unlimited boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (product_id, stock_date)
);

create table if not exists public.plan_periods (
  days integer primary key check (days > 0 and days <= 366),
  label text not null,
  discount_pct numeric(5, 2) not null default 0 check (discount_pct >= 0 and discount_pct <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.coupons (
  code text primary key check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,32}$'),
  kind text not null check (kind in ('percent', 'flat')),
  -- percent: 1..100 ; flat: amount in paise
  value integer not null check (value > 0),
  min_order_paise integer not null default 0 check (min_order_paise >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  per_user_limit integer not null default 1 check (per_user_limit >= 1),
  valid_from timestamptz,
  valid_to timestamptz,
  applies_to text not null default 'all' check (applies_to in ('all', 'one_time', 'subscription')),
  first_order_only boolean not null default false,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint coupons_percent_range check (kind <> 'percent' or value <= 100)
);

-- ---------------------------------------------------------------- subscriptions / orders
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  variant_key text not null check (variant_key in ('small', 'regular', 'large')),
  plan_days integer not null check (plan_days > 0),
  delivery_days integer[] not null,
  start_date date not null,
  end_date date not null,
  slot_id text not null references public.delivery_slots (id),
  address jsonb not null,
  status public.sub_status not null default 'pending_payment',
  per_day_paise integer not null check (per_day_paise > 0),
  total_paise integer not null check (total_paise >= 0),
  paid_through date,
  paused_from date,
  paused_to date,
  skipped_days integer not null default 0,
  payment_id uuid,
  cancelled_at timestamptz,
  cancel_reason text,
  idempotency_key text unique,
  -- additive columns (not in the contract)
  delivery_count integer not null default 0 check (delivery_count >= 0),
  subtotal_paise integer not null default 0,
  discount_paise integer not null default 0,
  delivery_fee_paise integer not null default 0,
  tax_paise integer not null default 0,
  coupon_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_days_valid check (
    cardinality(delivery_days) between 1 and 7 and delivery_days <@ array[0,1,2,3,4,5,6]),
  constraint subscriptions_dates_valid check (end_date >= start_date)
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id, created_at desc);
create index if not exists subscriptions_status_end_idx on public.subscriptions (status, end_date);

create table if not exists public.subscription_skips (
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  skip_date date not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- additive: 'skip' (single day) or 'pause' (expanded from a pause window)
  kind text not null default 'skip' check (kind in ('skip', 'pause')),
  primary key (subscription_id, skip_date)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique default public.next_order_no(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  kind text not null default 'one_time' check (kind in ('one_time', 'subscription_delivery')),
  subscription_id uuid references public.subscriptions (id) on delete restrict,
  delivery_date date not null,
  slot_id text not null references public.delivery_slots (id),
  status public.order_status not null default 'placed',
  payment_status public.payment_status not null default 'pending',
  address jsonb not null,
  gift_note text check (char_length(gift_note) <= 300),
  subtotal_paise integer not null default 0 check (subtotal_paise >= 0),
  discount_paise integer not null default 0 check (discount_paise >= 0),
  delivery_fee_paise integer not null default 0 check (delivery_fee_paise >= 0),
  tax_paise integer not null default 0 check (tax_paise >= 0),
  total_paise integer not null default 0 check (total_paise >= 0),
  coupon_code text,
  assigned_to uuid references public.profiles (id) on delete set null,
  failure_reason text,
  delivered_at timestamptz,
  idempotency_key text unique,
  -- additive: true while stock for this order is decremented
  stock_reserved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_sub_kind check ((kind = 'subscription_delivery') = (subscription_id is not null))
);
create unique index if not exists orders_sub_date_uidx on public.orders (subscription_id, delivery_date)
  where subscription_id is not null;
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_delivery_idx on public.orders (delivery_date, slot_id);
create index if not exists orders_assigned_idx on public.orders (assigned_to, delivery_date) where assigned_to is not null;
create index if not exists orders_status_idx on public.orders (status, created_at);
create index if not exists orders_pending_idx on public.orders (created_at) where payment_status = 'pending';

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  variant_key text not null,
  name_snapshot text not null,
  unit_price_paise integer not null check (unit_price_paise >= 0),
  qty integer not null check (qty > 0),
  line_total_paise integer not null check (line_total_paise >= 0),
  created_at timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_id);

create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  note text,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events (order_id, created_at);

-- ---------------------------------------------------------------- payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  order_id uuid references public.orders (id) on delete restrict,
  subscription_id uuid references public.subscriptions (id) on delete restrict,
  provider text not null default 'razorpay',
  provider_order_id text not null unique,
  provider_payment_id text,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR',
  status public.pay_status not null default 'created',
  method text,
  error_code text,
  error_desc text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_one_target check (num_nonnulls(order_id, subscription_id) = 1)
);
create index if not exists payments_order_idx on public.payments (order_id);
create index if not exists payments_sub_idx on public.payments (subscription_id);
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);
create unique index if not exists payments_provider_payment_uidx on public.payments (provider_payment_id)
  where provider_payment_id is not null;

do $$ begin
  alter table public.subscriptions
    add constraint subscriptions_payment_fk foreign key (payment_id) references public.payments (id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  order_id uuid references public.orders (id) on delete set null,
  amount_paise integer not null check (amount_paise > 0),
  reason text,
  provider_refund_id text unique,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists refunds_payment_idx on public.refunds (payment_id);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.coupons (code) on update cascade on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  order_id uuid references public.orders (id) on delete restrict,
  -- additive: subscriptions have no order row at redemption time
  subscription_id uuid references public.subscriptions (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (code, order_id),
  unique (code, subscription_id),
  constraint coupon_redemptions_target check (num_nonnulls(order_id, subscription_id) = 1)
);
create index if not exists coupon_redemptions_user_idx on public.coupon_redemptions (user_id, code);

create table if not exists public.webhook_events (
  id text primary key,
  provider text not null default 'razorpay',
  type text,
  payload jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

-- ---------------------------------------------------------------- notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  -- additive: idempotent in-app notifications
  dedupe_key text unique,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  channel text not null check (channel in ('email', 'whatsapp', 'sms', 'push')),
  template text not null,
  to_address text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'dead')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  dedupe_key text unique,
  created_at timestamptz not null default now()
);
create index if not exists outbox_due_idx on public.notification_outbox (next_attempt_at)
  where status in ('queued', 'failed');

-- ---------------------------------------------------------------- engagement
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text check (char_length(body) <= 2000),
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (order_id, product_id, user_id)
);
create index if not exists reviews_product_idx on public.reviews (product_id) where approved;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  subject text not null check (char_length(subject) between 3 and 200),
  message text not null check (char_length(message) between 3 and 4000),
  status text not null default 'open' check (status in ('open', 'pending', 'closed')),
  assigned_to uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_user_idx on public.support_tickets (user_id, created_at desc);

-- ---------------------------------------------------------------- platform
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id, created_at desc);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

create table if not exists public.app_logs (
  id bigint generated always as identity primary key,
  level text not null default 'info' check (level in ('debug', 'info', 'warn', 'error')),
  source text not null,
  code text,
  message text,
  detail jsonb,
  actor text,
  url text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists app_logs_created_idx on public.app_logs (created_at desc);
create index if not exists app_logs_level_idx on public.app_logs (level, created_at desc);

create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (key, window_start)
);
create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

create table if not exists public.idempotency_keys (
  key text primary key,
  scope text not null,
  user_id uuid,
  response jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index if not exists idempotency_expires_idx on public.idempotency_keys (expires_at);

-- ---------------------------------------------------------------- RLS on everywhere
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.delivery_slots enable row level security;
alter table public.app_settings enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_stock enable row level security;
alter table public.plan_periods enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_skips enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.webhook_events enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.reviews enable row level security;
alter table public.support_tickets enable row level security;
alter table public.audit_log enable row level security;
alter table public.app_logs enable row level security;
alter table public.rate_limits enable row level security;
alter table public.idempotency_keys enable row level security;
