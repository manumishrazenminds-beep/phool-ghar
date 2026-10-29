-- Phool Ghar: privilege lockdown. Safe to re-run; this is the LAST migration of the database layer.
--
-- PostgREST authorises in two layers: SQL privileges first, RLS second. Start from nothing for the API
-- roles and grant exactly what each role needs. service_role (Edge Functions) keeps full access.

grant usage on schema public to anon, authenticated, service_role;

-- future objects created by this role are private by default
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
do $$ begin
  alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
  alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
  alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
exception when others then null; end $$;

-- wipe what Supabase's defaults (or an earlier run) may have granted
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- ---------------------------------------------------------------- public (anon + authenticated) reads
grant select on public.categories, public.products, public.product_variants, public.plan_periods,
                public.delivery_zones, public.delivery_slots, public.reviews, public.public_settings
  to anon, authenticated;

-- ---------------------------------------------------------------- authenticated
grant select on public.profiles to authenticated;
grant update (full_name, phone, lang, notify_prefs) on public.profiles to authenticated;   -- never role/permissions/active/email

grant select, insert, update, delete on public.addresses to authenticated;

-- staff-managed tables: RLS policies check has_perm(...)
grant insert, update, delete on public.categories, public.products, public.product_variants, public.plan_periods,
                                public.delivery_zones, public.delivery_slots to authenticated;
grant select, insert, update, delete on public.product_stock, public.coupons, public.app_settings to authenticated;
grant select, update, delete, insert on public.reviews to authenticated;
grant select, insert, update on public.support_tickets to authenticated;

-- read-only for clients: orders, payments and subscriptions change only through security definer RPCs
grant select on public.orders, public.order_items, public.order_events,
                public.subscriptions, public.subscription_skips,
                public.payments, public.refunds, public.coupon_redemptions,
                public.audit_log, public.app_logs to authenticated;

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- webhook_events, notification_outbox, rate_limits, idempotency_keys: service_role only (nothing granted)

-- ---------------------------------------------------------------- functions
grant execute on function public.app_role(), public.has_perm(text), public.is_staff() to anon, authenticated;
grant execute on function public.check_pincode(text) to anon, authenticated;
grant execute on function public.preview_pricing(jsonb) to anon, authenticated;

grant execute on function
  public.apply_coupon_preview(text, integer, text),
  public.skip_subscription_day(uuid, date),
  public.unskip_subscription_day(uuid, date),
  public.pause_subscription(uuid, date, date),
  public.resume_subscription(uuid),
  public.cancel_subscription(uuid, text),
  public.cancel_order(uuid, text),
  public.set_order_status(uuid, public.order_status, text),
  public.assign_order(uuid, uuid),
  public.bulk_assign_orders(date, text, uuid),
  public.todays_delivery_list(date),
  public.admin_dashboard(date, date)
  to authenticated;

-- service role only (already covered by "grant all ... to service_role" above, listed for the record):
--   create_checkout, mark_payment_captured, mark_payment_failed, mark_refund, generate_subscription_orders,
--   expire_stale_orders, rl_hit, idem_get, idem_put, enqueue_notification, housekeeping_purge
