# Phool Ghar database (Supabase Postgres)

All SQL lives in `supabase/migrations/`, plus `supabase/seed.sql`. Money is integer paise, dates use
`Asia/Kolkata`, weekdays are `0 = Monday ... 6 = Sunday`.

## ER overview

```
auth.users 1-1 profiles (role, permissions[], active)
profiles 1-* addresses
categories 1-* products 1-* product_variants        products 1-* product_stock (per date)
plan_periods, delivery_zones (pincode), delivery_slots, app_settings   (config)
profiles 1-* orders 1-* order_items, order_events
profiles 1-* subscriptions 1-* subscription_skips   subscriptions 1-* orders (kind = subscription_delivery)
orders|subscriptions 1-* payments 1-* refunds
coupons 1-* coupon_redemptions (order or subscription)
profiles 1-* notifications (in-app, realtime)   notification_outbox (email/whatsapp/sms/push queue)
reviews, support_tickets, audit_log, app_logs, webhook_events, rate_limits, idempotency_keys
```

Migrations (apply in this order; they are re-runnable):

| file | content |
|---|---|
| `20261024000100_extensions_enums` | pgcrypto, enums |
| `20261024000200_tables` | tables, indexes, `order_no_seq`, RLS enabled everywhere |
| `20261024000300_helpers_triggers` | `app_role`, `has_perm`, `is_staff`; auth.users to profiles trigger; profile privilege guard; order_events trigger; audit triggers |
| `20261024000400_rls_policies` | every RLS policy, `public_settings` view |
| `20261024000500_internal_functions` | underscore helpers (clock, cut-off, notify, stock, coupons, capacity) |
| `20261024000600_rpc_public_pricing` | `_price` engine, `check_pincode`, `preview_pricing`, `apply_coupon_preview` |
| `20261024000700_rpc_checkout_payments` | `create_checkout`, `mark_payment_captured/failed`, `mark_refund`, `expire_stale_orders` |
| `20261024000800_rpc_subscriptions` | `generate_subscription_orders`, skip/unskip/pause/resume/cancel |
| `20261024000900_rpc_orders_admin` | `cancel_order`, `set_order_status`, `assign_order`, `bulk_assign_orders`, `todays_delivery_list`, `admin_dashboard` |
| `20261024001000_infra_functions` | `rl_hit`, `idem_get/put`, `enqueue_notification`, `housekeeping_purge` |
| `20261024001100_storage_realtime` | realtime publication, buckets `product-images` (public read) and `invoices` (private) |
| `20261024001200_grants` | revokes defaults, grants exactly what each role needs |
| `20261024990000_cron_schedules` | owned by the notifications builder (pg_cron + pg_net) |

## How to apply

CLI: `supabase link --project-ref <ref>` then `supabase db push` (add `--include-seed` on recent CLI
versions, or run the seed in the SQL editor). Locally `supabase start` applies migrations and `seed.sql` on `supabase db reset`.

SQL editor (no CLI): paste each migration file in filename order, then `seed.sql`. Enable `pg_cron` and `pg_net`
(Database, Extensions) before the cron migration; every other file works without them.

## First admin

Sign up normally in the app, then in the SQL editor (runs as `postgres`, which the lockdown trigger allows):

```sql
update public.profiles set role = 'admin' where email = 'owner@example.com';
-- sub-admin with limited rights:
update public.profiles set role = 'staff', permissions = array['orders','stock'] where email = 'staff@example.com';
```

Permissions: `orders products stock subscriptions customers coupons reports settings team`. After that the
admin creates staff and delivery accounts from the app (`team-admin` function, service role).

## Security model

* No table grants for `anon`/`authenticated` beyond what is listed in the grants migration. RLS is the second layer.
* Clients can only read `orders`, `payments`, `subscriptions`, `refunds`, `order_items`, `order_events`. Every write is a
  `security definer` RPC (`set search_path = public`) or the service role.
* `profiles`: users can update only `full_name, phone, lang, notify_prefs`. `role, permissions, active, email` are blocked by
  column grants and by a trigger; metadata at signup can never pick a role. Only the service role or the SQL editor changes them.
* Service-role-only RPCs: `create_checkout, mark_payment_captured, mark_payment_failed, mark_refund,
  generate_subscription_orders, expire_stale_orders, rl_hit, idem_get, idem_put, enqueue_notification, housekeeping_purge`.
  (`execute` is revoked from public, anon and authenticated.)
* Authenticated RPCs check ownership or permission inside the function: skip/unskip/pause/resume/cancel_subscription,
  cancel_order, set_order_status, assign_order, bulk_assign_orders, todays_delivery_list, admin_dashboard,
  apply_coupon_preview. Anonymous: `check_pincode`, `preview_pricing` (coupons are evaluated for signed-in users only).
* `cron_secret` in `app_settings` is visible to admins only; `public_settings` exposes a fixed whitelist.
* `audit_log` is written by triggers and RPCs only; `app_settings` audit rows record the key, never the value.

## Behaviour worth knowing

* Pricing: `_price` reads only product ids/slugs, variant, quantity, date, slot, pincode and coupon code from the client.
  Unit price = `round(price_paise * variant multiplier)`. Prices are tax inclusive; `tax_paise` is the GST component of the
  total at `app_settings.gst_percent` (default 0, fresh flowers). Flat coupon `value` is in paise, percent is 1..100.
* Subscriptions: `plan_days` is a calendar period; the number of deliveries is the count of chosen weekdays in it
  (`delivery_count`). Total = per-day x deliveries, less the plan discount, less coupon. `end_date` is always the date of the Nth
  valid delivery, so a skip or pause (stored as rows in `subscription_skips`, kind `skip`/`pause`) extends it to the next valid weekday.
  `skipped_days` counts skip and pause rows up to `end_date`.
* Cut-off: `_first_changeable_date()` is tomorrow before 21:00 IST and the day after tomorrow afterwards. Customers can only
  change dates on or after it. Staff with `subscriptions` can act from tomorrow onward. Plans must start on or after it. One-time
  orders for tomorrow morning slots (start before 12:00) also close at the cut-off; same-day orders need `min_lead_minutes` (180) before the slot.
* Capacity counts live orders plus subscriptions not yet materialised for that date; pending unpaid orders hold a seat for 45 minutes.
  The slot row is locked while pricing, so two checkouts cannot overbook.
* Stock: only for `products.track_stock`; a missing `product_stock` row then means zero. Stock is reserved at checkout and released
  when an order is cancelled or expires. Call `expire_stale_orders()` every 15 minutes from cron (not scheduled by this layer).
* Payments: a failed attempt does not cancel the order (Razorpay allows retries). `mark_payment_captured` locks the payment row,
  checks the amount against the order/subscription, and queues a refund if a second payment arrives for something already paid.
* Coupons are redeemed at capture under a row lock (`used_count`, per-user limit, first-order rule). If limits were hit by
  concurrent open checkouts the order stands and an `audit_log` row `coupon_overrun` is written.

## Errors from RPCs

Raised exceptions use SQLSTATE `P0001` with `message = 'code: human text'` (for example `slot_full: That slot is fully booked...`),
`detail` = the human text and `hint` = the bare machine code (`slot_full`, `cutoff_passed`, `coupon_invalid`, `out_of_stock`,
`rate_limited`, `invalid_total`, ...). SQLSTATE `42501` means not allowed. `preview_pricing` never raises; it returns
`{ ok, errors: [{code, message}] }`.
