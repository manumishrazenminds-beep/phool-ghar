-- Phool Ghar: row level security policies. Grants live in 20261024001200_grants.sql.
-- RLS is the boundary; clients have no INSERT/UPDATE on orders, payments or subscriptions at all.
-- Safe to re-run.

do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- profiles
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_select_staff on public.profiles for select to authenticated
  using (public.has_perm('customers') or public.has_perm('team') or public.has_perm('orders'));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- addresses
create policy addresses_owner_all on public.addresses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy addresses_staff_read on public.addresses for select to authenticated
  using (public.has_perm('customers') or public.has_perm('orders'));

-- delivery zones / slots / settings
create policy zones_public_read on public.delivery_zones for select to anon, authenticated
  using (active or public.has_perm('settings'));
create policy zones_staff_write on public.delivery_zones for all to authenticated
  using (public.has_perm('settings')) with check (public.has_perm('settings'));
create policy slots_public_read on public.delivery_slots for select to anon, authenticated
  using (active or public.has_perm('settings'));
create policy slots_staff_write on public.delivery_slots for all to authenticated
  using (public.has_perm('settings')) with check (public.has_perm('settings'));
-- cron_secret (written by the cron migration's setup snippet) is readable and writable by the owner only
create policy settings_staff_all on public.app_settings for all to authenticated
  using (public.has_perm('settings') and (key <> 'cron_secret' or public.app_role() = 'admin'))
  with check (public.has_perm('settings') and (key <> 'cron_secret' or public.app_role() = 'admin'));

-- catalogue
create policy categories_public_read on public.categories for select to anon, authenticated
  using (active or public.has_perm('products'));
create policy categories_staff_write on public.categories for all to authenticated
  using (public.has_perm('products')) with check (public.has_perm('products'));
create policy products_public_read on public.products for select to anon, authenticated
  using (active or public.has_perm('products'));
create policy products_staff_write on public.products for all to authenticated
  using (public.has_perm('products')) with check (public.has_perm('products'));
create policy variants_public_read on public.product_variants for select to anon, authenticated using (true);
create policy variants_staff_write on public.product_variants for all to authenticated
  using (public.has_perm('products')) with check (public.has_perm('products'));
create policy stock_staff_all on public.product_stock for all to authenticated
  using (public.has_perm('stock') or public.has_perm('products'))
  with check (public.has_perm('stock') or public.has_perm('products'));
create policy plans_public_read on public.plan_periods for select to anon, authenticated
  using (active or public.has_perm('settings'));
create policy plans_staff_write on public.plan_periods for all to authenticated
  using (public.has_perm('settings')) with check (public.has_perm('settings'));

-- coupons: never public; customers use apply_coupon_preview
create policy coupons_staff_all on public.coupons for all to authenticated
  using (public.has_perm('coupons')) with check (public.has_perm('coupons'));
create policy redemptions_own_read on public.coupon_redemptions for select to authenticated
  using (user_id = auth.uid());
create policy redemptions_staff_read on public.coupon_redemptions for select to authenticated
  using (public.has_perm('coupons') or public.has_perm('reports'));

-- orders (read only for clients; writes via RPC)
create policy orders_own_read on public.orders for select to authenticated using (user_id = auth.uid());
create policy orders_staff_read on public.orders for select to authenticated
  using (public.has_perm('orders') or public.has_perm('reports'));
create policy orders_delivery_read on public.orders for select to authenticated
  using (public.app_role() = 'delivery' and assigned_to = auth.uid());

-- child tables inherit visibility from orders through the caller's own RLS
create policy order_items_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy order_events_read on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

-- subscriptions
create policy subs_own_read on public.subscriptions for select to authenticated using (user_id = auth.uid());
create policy subs_staff_read on public.subscriptions for select to authenticated
  using (public.has_perm('subscriptions') or public.has_perm('reports'));
create policy skips_read on public.subscription_skips for select to authenticated
  using (exists (select 1 from public.subscriptions s where s.id = subscription_id));

-- payments / refunds
create policy payments_own_read on public.payments for select to authenticated using (user_id = auth.uid());
create policy payments_staff_read on public.payments for select to authenticated
  using (public.has_perm('orders') or public.has_perm('reports'));
create policy refunds_own_read on public.refunds for select to authenticated
  using (exists (select 1 from public.payments p where p.id = payment_id and p.user_id = auth.uid()));
create policy refunds_staff_read on public.refunds for select to authenticated
  using (public.has_perm('orders') or public.has_perm('reports'));

-- notifications: own rows, may only flip read_at (column grant)
create policy notifications_own_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reviews
create policy reviews_public_read on public.reviews for select to anon, authenticated using (approved);
create policy reviews_own_read on public.reviews for select to authenticated using (user_id = auth.uid());
create policy reviews_staff_all on public.reviews for all to authenticated
  using (public.has_perm('products') or public.has_perm('customers'))
  with check (public.has_perm('products') or public.has_perm('customers'));
create policy reviews_own_insert on public.reviews for insert to authenticated
  with check (
    user_id = auth.uid() and approved = false and exists (
      select 1 from public.orders o join public.order_items i on i.order_id = o.id
      where o.id = order_id and o.user_id = auth.uid() and o.status = 'delivered' and i.product_id = reviews.product_id)
  );

-- support tickets
create policy tickets_own_read on public.support_tickets for select to authenticated using (user_id = auth.uid());
create policy tickets_own_insert on public.support_tickets for insert to authenticated
  with check (user_id = auth.uid() and status = 'open' and assigned_to is null
              and (order_id is null or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())));
create policy tickets_staff_all on public.support_tickets for all to authenticated
  using (public.has_perm('customers') or public.has_perm('orders'))
  with check (public.has_perm('customers') or public.has_perm('orders'));

-- platform tables: staff read only. webhook_events, notification_outbox, rate_limits, idempotency_keys
-- have RLS on and no policy: reachable by the service role only.
create policy audit_staff_read on public.audit_log for select to authenticated
  using (public.has_perm('team') or public.has_perm('reports'));
create policy app_logs_staff_read on public.app_logs for select to authenticated
  using (public.has_perm('settings'));

-- public whitelisted settings view (runs as owner, so RLS on app_settings does not apply)
create or replace view public.public_settings as
  select key, value from public.app_settings
  where key in ('cutoff_time', 'free_delivery_for_subscription', 'min_order_paise', 'store_name',
                'support_whatsapp', 'gst_percent');
