# Phool Ghar backend contract (Supabase)

This is the single source of truth that five parallel builders follow. If you need something
that is not here, pick the most conventional option, document it in your own notes file, and do
not edit files you do not own.

Project root: `/Users/bhags/Desktop/flower-ecommerce/web`  (Vite + React 19 + TS + Tailwind v4)
Stack: Supabase (Postgres + Auth + Edge Functions on Deno + Storage), Razorpay, Resend, Cloudflare Pages.
Everything runs on free tiers. Nothing is configured yet: write production-ready code that reads
config from env and fails with a clear message when env is missing. No secrets in code.

## Conventions

* Money is integer **paise** everywhere in the DB and APIs (`price_paise`). UI converts to rupees.
* Timezone `Asia/Kolkata`. Dates are `date`; timestamps are `timestamptz`.
* Day of week: `0 = Monday ... 6 = Sunday` (matches `WEEKDAYS` in `src/data/products.ts`).
* IDs are `uuid` unless stated. `slug` columns are unique text.
* Cut-off: `app_settings.cutoff_time = '21:00'`. Skip/pause/change for tomorrow must be requested
  before 21:00 IST today (enforced in SQL, not only in the UI).
* A skipped subscription day extends `end_date` by one delivery day (default policy).
* Error envelope for every Edge Function: `{ "error": { "code": "string", "message": "string" } }`
  with the right HTTP status. Success: `{ "data": ... }`.
* Edge Functions: Deno, `Deno.serve`, ES modules, shared code in `supabase/functions/_shared/`.
* No emoji in code, UI copy or docs.
* Do NOT run git commands. Do NOT edit `src/App.tsx`, `src/main.tsx`, `src/index.css`, `package.json`
  (the integrator wires routes). If you need an npm dependency, say so in your report.
* Do NOT read or copy `legopolis-secrets.txt` or any `.env` file from the old projects.

## Reference code you may copy and adapt (read only)

`/Users/bhags/Desktop/macbook-backup/legopolis/legopolis-site/supabase/`
  * `functions/_shared/`, `functions/razorpay-order`, `functions/razorpay-webhook`, `functions/team-admin`,
    `functions/payment-reminders`, `functions/notify-update`, `functions/error-digest`
  * `migrations/` (RLS, `security_hardening`, `profiles_privilege_lockdown`, `lead_rate_limit`,
    `app_logs`, `payment_credit_atomic`, `team_subadmins`, `notifications`, `staff_capabilities_rls`)
`/Users/bhags/Desktop/macbook-backup/Untethered/`
  * `api/_lib/{rateLimit,email,invoice,pricing,supabaseAdmin,sign,cors}.ts`, `api/checkout`, `api/coupon`,
    `api/pincode`, `supabase/migrations/`
Adapt, do not paste blindly: those were Vercel/law-firm specific.

## Roles

`create type app_role as enum ('customer','admin','staff','delivery');`
* `admin`: owner, everything. `staff`: sub-admin, only what `profiles.permissions` allows.
  `delivery`: sees and updates only orders assigned to them. `customer`: own data only.
* Permissions (text[]): `orders`, `products`, `stock`, `subscriptions`, `customers`, `coupons`,
  `reports`, `settings`, `team`. `admin` implicitly has all.
* Helper SQL functions: `public.app_role() returns app_role`, `public.has_perm(p text) returns boolean`
  (true for admin, or staff with p in permissions, active only), `public.is_staff() boolean` (admin|staff active).
* A user can never change their own `role`, `permissions` or `active` (column-level lockdown + trigger).

## Tables (schema `public`, all with RLS enabled)

| table | columns (besides `created_at timestamptz default now()`) |
|---|---|
| `profiles` | `id uuid pk references auth.users`, `role app_role default 'customer'`, `full_name`, `phone`, `email`, `permissions text[] default '{}'`, `active bool default true`, `lang text default 'en'`, `notify_prefs jsonb default '{"email":true,"whatsapp":true,"sms":false,"push":false}'`. Row auto-created by trigger on `auth.users` insert. |
| `addresses` | `id`, `user_id`, `label` (Home/Office/Temple/Shop), `recipient_name`, `recipient_phone`, `line1`, `line2`, `landmark`, `city`, `pincode`, `instructions`, `is_default bool` |
| `delivery_zones` | `pincode text pk`, `city`, `area`, `fee_paise int default 0`, `active bool default true` |
| `delivery_slots` | `id text pk` (`early`,`morning`,`evening`), `label`, `start_time time`, `end_time time`, `capacity int`, `subscription_ok bool`, `active bool`, `sort int` |
| `app_settings` | `key text pk`, `value jsonb`, `updated_by uuid` (keys: `cutoff_time`, `free_delivery_for_subscription`, `min_order_paise`, `store_name`, `support_whatsapp`, `gst_percent`) |
| `categories` | `id`, `slug`, `name`, `blurb`, `image_url`, `sort int`, `active bool` |
| `products` | `id`, `slug`, `name`, `tagline`, `description`, `category_id`, `image_url`, `gallery jsonb default '[]'`, `price_paise int` (Regular, one-time), `per_day_paise int null` (null = not subscribable), `tag`, `care`, `active bool`, `sort int`, `updated_at` |
| `product_variants` | `id`, `product_id`, `variant_key text` (`small`,`regular`,`large`), `label`, `note`, `multiplier numeric(4,2)`; unique(product_id, variant_key) |
| `product_stock` | `product_id`, `stock_date date`, `qty int`, `unlimited bool default false`; pk(product_id, stock_date). Missing row = unlimited unless `products.track_stock` is true (add `track_stock bool default false`). |
| `plan_periods` | `days int pk` (7,15,30), `label`, `discount_pct numeric(5,2)`, `active bool` |
| `coupons` | `code text pk` (upper-case), `kind text` (`percent`,`flat`), `value int`, `min_order_paise int default 0`, `max_uses int null`, `used_count int default 0`, `per_user_limit int default 1`, `valid_from`, `valid_to`, `applies_to text default 'all'` (`all`,`one_time`,`subscription`), `active bool` |
| `coupon_redemptions` | `id`, `code`, `user_id`, `order_id`, unique(code, order_id) |
| `orders` | `id`, `order_no text unique` (e.g. `PG-26-000123`, from a sequence), `user_id`, `kind text` (`one_time`,`subscription_delivery`), `subscription_id null`, `delivery_date date`, `slot_id`, `status order_status`, `payment_status payment_status`, `address jsonb` (snapshot: recipient_name, recipient_phone, line1, line2, landmark, city, pincode, instructions), `gift_note`, `subtotal_paise`, `discount_paise`, `delivery_fee_paise`, `tax_paise`, `total_paise`, `coupon_code`, `assigned_to uuid null` (delivery staff), `failure_reason`, `delivered_at`, `idempotency_key text unique null`, `updated_at`. unique(subscription_id, delivery_date) where subscription_id is not null. |
| `order_items` | `id`, `order_id`, `product_id`, `variant_key`, `name_snapshot`, `unit_price_paise`, `qty`, `line_total_paise` |
| `order_events` | `id`, `order_id`, `status`, `note`, `actor_id`, `created_at` (customer-visible timeline; trigger on status change writes a row) |
| `subscriptions` | `id`, `user_id`, `product_id`, `variant_key`, `plan_days int`, `delivery_days int[]` (0..6), `start_date`, `end_date`, `slot_id`, `address jsonb`, `status sub_status`, `per_day_paise`, `total_paise`, `paid_through date`, `paused_from date null`, `paused_to date null`, `skipped_days int default 0`, `payment_id uuid null`, `cancelled_at`, `cancel_reason`, `idempotency_key text unique null` |
| `subscription_skips` | `subscription_id`, `skip_date date`, `created_by`, `created_at`; pk(subscription_id, skip_date) |
| `payments` | `id`, `user_id`, `order_id null`, `subscription_id null`, `provider text default 'razorpay'`, `provider_order_id text unique`, `provider_payment_id text null`, `amount_paise`, `currency default 'INR'`, `status pay_status`, `method text null`, `error_code`, `error_desc`, `raw jsonb`, `updated_at` |
| `refunds` | `id`, `payment_id`, `order_id null`, `amount_paise`, `reason`, `provider_refund_id text null`, `status text` (`pending`,`processed`,`failed`), `created_by` |
| `webhook_events` | `id text pk` (provider event id), `provider`, `type`, `payload jsonb`, `received_at`, `processed_at null`, `error text null` (idempotency + audit) |
| `notifications` | `id`, `user_id`, `type`, `title`, `body`, `data jsonb`, `read_at null` (in-app inbox, realtime enabled) |
| `notification_outbox` | `id`, `user_id null`, `channel` (`email`,`whatsapp`,`sms`,`push`), `template text`, `to_address text`, `payload jsonb`, `status` (`queued`,`sending`,`sent`,`failed`,`dead`), `attempts int default 0`, `next_attempt_at timestamptz default now()`, `last_error`, `sent_at`, `dedupe_key text unique null` |
| `reviews` | `id`, `product_id`, `user_id`, `order_id`, `rating int 1..5`, `body`, `approved bool default false` |
| `support_tickets` | `id`, `user_id`, `order_id null`, `subject`, `message`, `status` (`open`,`pending`,`closed`), `assigned_to null` |
| `audit_log` | `id`, `actor_id`, `action`, `entity`, `entity_id`, `detail jsonb` (insert via trigger or RPC only) |
| `app_logs` | as in Legopolis: `level`, `source`, `code`, `message`, `detail jsonb`, `actor`, `url`, `user_agent` |
| `rate_limits` | `key text`, `window_start timestamptz`, `hits int`; pk(key, window_start) |
| `idempotency_keys` | `key text pk`, `scope text`, `user_id null`, `response jsonb`, `expires_at timestamptz` |

Enums: `order_status ('placed','confirmed','preparing','out_for_delivery','delivered','cancelled','failed')`,
`payment_status ('pending','paid','failed','refunded','partially_refunded')`,
`sub_status ('pending_payment','active','paused','on_hold','cancelled','completed')`,
`pay_status ('created','authorized','captured','failed','refunded')`.

## RLS summary

* Customers: read/write own `profiles` (non-privileged columns), `addresses`, read own `orders`,
  `order_items`, `order_events`, `subscriptions`, `subscription_skips`, `payments`, `notifications`
  (update `read_at` only), create own `support_tickets` and `reviews`.
* Public (anon + authenticated) read: `categories`, `products` (active), `product_variants`,
  `plan_periods`, `delivery_zones` (active), `delivery_slots` (active), `app_settings` rows whitelisted via a view
  `public_settings`, approved `reviews`.
* Staff with the right permission: read/write the relevant tables (see `has_perm`). `delivery`: read orders
  where `assigned_to = auth.uid()` and update only status/failure_reason via RPC.
* Money-changing writes (orders, payments, subscriptions status, coupons usage) happen only through
  `security definer` RPCs or the service role in Edge Functions. Clients cannot insert into `orders` or `payments` directly.

## RPCs (all `security definer`, `set search_path = public`, validated inputs)

* `check_pincode(p_pincode text) returns table(ok bool, city text, area text, fee_paise int)` (anon allowed)
* `preview_pricing(p_payload jsonb) returns jsonb` (anon allowed): same maths as checkout, no writes.
* `create_checkout(p_user uuid, p_payload jsonb, p_idem text) returns jsonb` (service role only):
  validates lines, prices server-side from `products`/`product_variants`/`plan_periods`, zone, slot capacity,
  stock, cut-off, coupon; inserts `orders` (+items) as `payment_status='pending'` or a `subscriptions`
  row as `pending_payment`; returns `{ kind, order_id|subscription_id, amount_paise, currency, summary }`.
  Replays return the original result for the same idempotency key.
* `mark_payment_captured(p_provider_order_id text, p_provider_payment_id text, p_method text, p_raw jsonb) returns jsonb`
  (service role): idempotent. Sets payment `captured`; order `paid`/`confirmed`; or subscription `active`
  (computes `end_date`, materialises deliveries for the next 2 days at most, rest by scheduler); redeems coupon;
  enqueues notifications. Safe to call from both `payment-verify` and the webhook.
* `mark_payment_failed(p_provider_order_id text, p_code text, p_desc text, p_raw jsonb) returns jsonb` (service role)
* `mark_refund(p_payment_id uuid, p_amount_paise int, p_provider_refund_id text, p_status text) returns jsonb` (service role)
* `generate_subscription_orders(p_for_date date) returns jsonb` (service role / cron): for every active
  subscription whose `delivery_days` contains the weekday, not paused, not skipped, within range, insert one
  `orders` row (`kind='subscription_delivery'`, total 0, `payment_status='paid'`), complete subscriptions past
  `end_date`, enqueue "tomorrow's delivery" and "plan ending soon" notifications. Idempotent via the unique index.
* `skip_subscription_day(p_sub uuid, p_date date)`, `unskip_subscription_day(p_sub uuid, p_date date)`,
  `pause_subscription(p_sub uuid, p_from date, p_to date)`, `resume_subscription(p_sub uuid)`,
  `cancel_subscription(p_sub uuid, p_reason text)` (authenticated owner or staff with `subscriptions`): enforce cut-off,
  extend `end_date`, write `audit_log`, enqueue notification.
* `cancel_order(p_order uuid, p_reason text)`: owner before `preparing`, or staff with `orders`; triggers refund request row.
* `set_order_status(p_order uuid, p_status order_status, p_note text)`: staff with `orders`; `delivery` role only for
  `out_for_delivery`, `delivered`, `failed` on own assigned orders. Writes `order_events`, enqueues notification.
* `assign_order(p_order uuid, p_staff uuid)`, `bulk_assign_orders(p_date date, p_slot text, p_staff uuid)` (perm `orders`)
* `todays_delivery_list(p_date date) returns table(...)`: joined, grouped-ready rows for the admin delivery sheet.
* `apply_coupon_preview(p_code text, p_subtotal_paise int, p_kind text) returns jsonb`
* `rl_hit(p_key text, p_max int, p_window_seconds int) returns boolean` (service role): atomic fixed-window rate limit.
* `enqueue_notification(p_user uuid, p_channel text, p_template text, p_to text, p_payload jsonb, p_dedupe text) returns uuid`
* `admin_dashboard(p_from date, p_to date) returns jsonb` (orders, revenue, active subs, deliveries by slot, failed).

Cron (pg_cron + pg_net, in a late migration `20261024990000_cron_schedules.sql`):
* `21:00 IST (15:30 UTC)` daily: call function `daily-scheduler`
* every minute: call function `notify-dispatch`
* hourly: purge expired `idempotency_keys`, old `rate_limits`, old `app_logs`
Cron SQL must read the project URL and `CRON_SECRET` from `app_settings`/vault placeholders and be harmless when unset.

## Edge Functions (`supabase/functions/<name>/index.ts`)

All validate input, apply `rl_hit` rate limits (per user or per IP), log failures to `app_logs`, use the shared
`withRetry` for outbound calls, and return the standard envelope. CORS allow-list from `ALLOWED_ORIGINS`.

| function | auth | purpose |
|---|---|---|
| `checkout-create` | user JWT | body `{ lines[], address_id? , address?, recipient?, date, slot_id, gift_note?, instructions?, coupon_code?, subscription?: {plan_days, delivery_days[], start_date}, idempotency_key }` -> calls `create_checkout`, creates the Razorpay order (retry + idempotent), inserts `payments(status='created')`, returns `{ order_id|subscription_id, payment: { key_id, razorpay_order_id, amount_paise, currency, name, prefill } }` |
| `payment-verify` | user JWT | body `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` -> HMAC verify (timing-safe) -> `mark_payment_captured` |
| `razorpay-webhook` | none (signature) | verify `X-Razorpay-Signature`, dedupe on event id in `webhook_events`, handle `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`; always 200 once persisted |
| `refund-create` | staff `orders` perm | create Razorpay refund (idempotent), `mark_refund`, notify customer |
| `notify-dispatch` | `CRON_SECRET` or service role | claim a batch from `notification_outbox` with `for update skip locked`, send via channel adapters, exponential backoff, dead-letter after 6 attempts |
| `daily-scheduler` | `CRON_SECRET` | call `generate_subscription_orders(tomorrow)` then enqueue reminders; returns counts |
| `team-admin` | admin JWT | create/update/deactivate `staff` and `delivery` accounts, set permissions, reset password (adapted from Legopolis) |
| `order-invoice` | user JWT | GET `?order_id=` returns printable HTML invoice with GST lines |
| `health` | none | `{ ok, time, db: bool }` |

Shared modules in `_shared/`: `cors.ts`, `http.ts` (envelope, `ok()/fail()`), `auth.ts` (`requireUser`, `requireRole`, `requirePerm`),
`supabase.ts` (service client), `retry.ts` (`withRetry`, jittered backoff, timeout, simple circuit breaker),
`ratelimit.ts` (`rl_hit` wrapper), `idempotency.ts`, `razorpay.ts` (create order, verify signature, refund, fetch payment),
`logger.ts` (structured logs to `app_logs`), `email.ts` + `emailTemplates.ts`, `whatsapp.ts`, `money.ts`, `env.ts` (typed, lazy, descriptive errors).

## Notification templates (channel, template key)

`order_placed`, `payment_success`, `payment_failed`, `order_confirmed`, `order_preparing`, `order_out_for_delivery`,
`order_delivered`, `order_cancelled`, `refund_processed`, `subscription_started`, `delivery_reminder` (evening before, with Skip),
`subscription_skipped`, `subscription_paused`, `subscription_resumed`, `subscription_cancelled`, `plan_ending_soon`,
`plan_renewal_link`, `welcome`, `staff_invited`. Each has an email body, a WhatsApp text (also exposed as a `wa.me`
click-to-chat link for the free tier), and an in-app `notifications` row. SMS is a stub behind `SMS_ENABLED` (DLT is paid).

## Frontend ownership

* `src/lib/env.ts`, `src/lib/supabase.ts` already exist (do not rewrite; extend via new files).
* Builder D (customer app): `src/lib/**` (new files only), `src/auth/**`, `src/account/**`, `src/checkout/**`,
  `src/pages/Login.tsx`, `Signup.tsx`, `Forgot.tsx`, `Reset.tsx`, `Checkout.tsx`, `OrderSuccess.tsx`, `OrderDetail.tsx`,
  `Account.tsx`; exports route elements from `src/routes.customer.tsx` (an array of `{ path, element }` plus `RequireAuth`).
* Builder E (admin + delivery): `src/admin/**`, `src/delivery/**`; exports `src/routes.admin.tsx`
  (an array of `{ path, element }` for `/admin/*` and `/delivery/*`). Uses `supabase` from `src/lib/supabase.ts` and its own
  `src/admin/useProfile.ts` for role/permission gating. Must show a clear "Backend not configured" panel when `backendConfigured` is false.
* Design: reuse the site's tokens (cream, ink, marigold, leaf, rose), Instrument Serif for headings via `font-display`,
  Inter body, JetBrains Mono eyebrow labels, Phosphor icons, `motion/react`. Customer pages match the storefront; admin is calmer and denser.
* Frontend must degrade gracefully with no env: login pages explain the backend is not connected; the storefront keeps using static data.

## Files owned by each builder (never write outside your set)

* A (database): `supabase/config.toml`, `supabase/migrations/2026102400*.sql`, `supabase/seed.sql`, `docs/DB.md`
* B (payments and platform): `supabase/functions/_shared/**` (except `email*.ts`, `whatsapp.ts`),
  `supabase/functions/{checkout-create,payment-verify,razorpay-webhook,refund-create,health}/**`, `docs/PAYMENTS.md`
* C (notifications, scheduler, team): `supabase/functions/_shared/{email,emailTemplates,whatsapp}.ts`,
  `supabase/functions/{notify-dispatch,daily-scheduler,team-admin,order-invoice}/**`,
  `supabase/migrations/20261024990000_cron_schedules.sql`, `docs/NOTIFICATIONS.md`
* D: customer frontend set above, `docs/CUSTOMER_APP.md`
* E: `src/admin/**`, `src/delivery/**`, `src/routes.admin.tsx`, `docs/ADMIN_APP.md`

## Report back

When done, reply with: files created, public interfaces other builders depend on, deviations from this contract,
anything you could not verify (and why), and the exact env/secrets your code expects. Keep it under 400 words.
