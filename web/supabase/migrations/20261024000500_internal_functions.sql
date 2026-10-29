-- Phool Ghar: internal helper functions (underscore prefix). Not callable by API roles; see grants migration.
-- Safe to re-run.

create or replace function public._try_date(p text) returns date
  language plpgsql immutable as $$
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return p::date;
exception when others then
  return null;
end $$;

create or replace function public._try_int(p text) returns integer
  language plpgsql immutable as $$
begin
  if p is null or p !~ '^-?\d{1,9}$' then return null; end if;
  return p::integer;
exception when others then
  return null;
end $$;

-- Single place that reads the clock for business rules (tests may replace this function).
create or replace function public._ist_now() returns timestamp
  language sql stable as $$ select now() at time zone 'Asia/Kolkata' $$;

create or replace function public._ist_today() returns date
  language sql stable as $$ select public._ist_now()::date $$;

-- 0 = Monday ... 6 = Sunday
create or replace function public._dow(d date) returns integer
  language sql immutable as $$ select extract(isodow from d)::integer - 1 $$;

create or replace function public._setting(p_key text) returns jsonb
  language sql stable set search_path = public as $$
  select value from public.app_settings where key = p_key
$$;

create or replace function public._setting_int(p_key text, p_default integer) returns integer
  language sql stable set search_path = public as $$
  select coalesce(public._try_int(public._setting(p_key) #>> '{}'), p_default)
$$;

create or replace function public._setting_bool(p_key text, p_default boolean) returns boolean
  language sql stable set search_path = public as $$
  select coalesce(case lower(public._setting(p_key) #>> '{}') when 'true' then true when 'false' then false end, p_default)
$$;

create or replace function public._cutoff() returns time
  language plpgsql stable set search_path = public as $$
declare v text := public._setting('cutoff_time') #>> '{}';
begin
  if v is null or v !~ '^\d{1,2}:\d{2}(:\d{2})?$' then return time '21:00'; end if;
  return v::time;
exception when others then
  return time '21:00';
end $$;

-- First delivery date that can still be changed (skip/pause/cancel/start of a plan).
create or replace function public._first_changeable_date() returns date
  language sql stable set search_path = public as $$
  select case when public._ist_now()::time < public._cutoff()
              then public._ist_today() + 1 else public._ist_today() + 2 end
$$;

create or replace function public._can_change(d date) returns boolean
  language sql stable set search_path = public as $$
  select d is not null and d >= public._first_changeable_date()
$$;

-- Normalises an Indian mobile number to 10 digits; null when invalid.
create or replace function public._norm_phone(p text) returns text
  language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if length(d) = 12 and left(d, 2) = '91' then d := right(d, 10);
  elsif length(d) = 11 and left(d, 1) = '0' then d := right(d, 10);
  end if;
  if d ~ '^[6-9][0-9]{9}$' then return d; end if;
  return null;
end $$;

create or replace function public._err(p_code text, p_message text) returns jsonb
  language sql immutable as $$ select jsonb_build_object('code', p_code, 'message', p_message) $$;

-- Raise "code: human text" as MESSAGE (what the Edge Functions surface), the human text as DETAIL, the code as HINT.
create or replace function public._fail(p_code text, p_message text, p_errcode text default 'P0001') returns void
  language plpgsql as $$
begin
  raise exception '%: %', p_code, p_message using errcode = p_errcode, detail = p_message, hint = p_code;
end $$;

-- ---------------------------------------------------------------- notifications
-- In-app row plus one outbox row per enabled channel. Idempotent per p_dedupe. Never throws.
create or replace function public._notify_user(
  p_user uuid, p_template text, p_title text, p_body text, p_data jsonb default '{}'::jsonb,
  p_dedupe text default null, p_channels text[] default array['in_app', 'email', 'whatsapp', 'push']
) returns void language plpgsql security definer set search_path = public as $$
declare pr public.profiles%rowtype; ch text; v_to text;
begin
  select * into pr from public.profiles where id = p_user;
  if not found then return; end if;
  begin
    if 'in_app' = any (p_channels) then
      insert into public.notifications (user_id, type, title, body, data, dedupe_key)
      values (p_user, p_template, p_title, p_body, coalesce(p_data, '{}'::jsonb),
              case when p_dedupe is null then null else p_dedupe || ':in_app' end)
      on conflict (dedupe_key) do nothing;
    end if;
    foreach ch in array array['email', 'whatsapp', 'sms', 'push'] loop
      continue when not (ch = any (p_channels));
      continue when coalesce(pr.notify_prefs ->> ch, 'false') <> 'true';
      v_to := case ch when 'email' then pr.email when 'push' then pr.id::text else pr.phone end;
      continue when v_to is null or v_to = '';
      insert into public.notification_outbox (user_id, channel, template, to_address, payload, dedupe_key)
      values (p_user, ch, p_template, v_to,
              coalesce(p_data, '{}'::jsonb) || jsonb_build_object('title', p_title, 'body', p_body, 'lang', pr.lang),
              case when p_dedupe is null then null else p_dedupe || ':' || ch end)
      on conflict (dedupe_key) do nothing;
    end loop;
  exception when others then
    insert into public.app_logs (level, source, code, message, detail)
    values ('error', 'db._notify_user', sqlstate, sqlerrm, jsonb_build_object('template', p_template, 'user', p_user));
  end;
end $$;

create or replace function public._audit(p_action text, p_entity text, p_entity_id text, p_detail jsonb default '{}'::jsonb)
  returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_detail, '{}'::jsonb))
$$;

-- ---------------------------------------------------------------- capacity / dates
-- Deliveries already committed to (date, slot): live orders plus subscriptions not yet materialised.
create or replace function public._slot_load(p_date date, p_slot text) returns integer
  language sql volatile security definer set search_path = public as $$
  select
    (select count(*) from public.orders o
      where o.delivery_date = p_date and o.slot_id = p_slot
        and o.status not in ('cancelled', 'failed')
        and (o.payment_status in ('paid', 'partially_refunded')
             or (o.payment_status = 'pending' and o.created_at > now() - interval '45 minutes')))::integer
    +
    (select count(*) from public.subscriptions s
      where s.status in ('active', 'paused') and s.slot_id = p_slot
        and p_date between s.start_date and s.end_date
        and public._dow(p_date) = any (s.delivery_days)
        and not exists (select 1 from public.subscription_skips k where k.subscription_id = s.id and k.skip_date = p_date)
        and not exists (select 1 from public.orders o2 where o2.subscription_id = s.id and o2.delivery_date = p_date))::integer
$$;

-- The date of the p_n-th valid delivery counting from p_start. Skipped dates (and pause dates) do not count,
-- which is exactly how a skip or pause extends end_date.
create or replace function public._sub_end_date(p_start date, p_days integer[], p_n integer, p_sub uuid default null)
  returns date language plpgsql stable security definer set search_path = public as $$
declare d date := p_start; c integer := 0; i integer := 0;
begin
  if p_n <= 0 then return p_start; end if;
  while i < 1500 loop
    if public._dow(d) = any (p_days)
       and (p_sub is null or not exists (select 1 from public.subscription_skips k
                                         where k.subscription_id = p_sub and k.skip_date = d)) then
      c := c + 1;
      if c = p_n then return d; end if;
    end if;
    d := d + 1; i := i + 1;
  end loop;
  return d;
end $$;

create or replace function public._recompute_sub(p_sub uuid) returns date
  language plpgsql security definer set search_path = public as $$
declare s public.subscriptions%rowtype; v_end date;
begin
  select * into s from public.subscriptions where id = p_sub for update;
  if not found then return null; end if;
  v_end := public._sub_end_date(s.start_date, s.delivery_days, s.delivery_count, s.id);
  update public.subscriptions
     set end_date = v_end,
         paid_through = case when payment_id is not null then v_end else paid_through end,
         skipped_days = (select count(*) from public.subscription_skips k
                          where k.subscription_id = s.id and k.skip_date between s.start_date and v_end)
   where id = s.id;
  return v_end;
end $$;

-- ---------------------------------------------------------------- coupons
create or replace function public._coupon_eval(p_code text, p_subtotal bigint, p_kind text, p_user uuid)
  returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare c public.coupons%rowtype; v_code text := upper(btrim(coalesce(p_code, ''))); v_disc bigint;
begin
  if v_code = '' then
    return jsonb_build_object('valid', false, 'code', null, 'discount_paise', 0, 'message', 'Enter a coupon code.');
  end if;
  select * into c from public.coupons where code = v_code;
  if not found or not c.active
     or (c.valid_from is not null and now() < c.valid_from)
     or (c.valid_to is not null and now() > c.valid_to) then
    return jsonb_build_object('valid', false, 'code', v_code, 'discount_paise', 0, 'message', 'This coupon is not valid.');
  end if;
  if c.applies_to <> 'all' and c.applies_to <> p_kind then
    return jsonb_build_object('valid', false, 'code', v_code, 'discount_paise', 0,
      'message', 'This coupon does not apply to this kind of purchase.');
  end if;
  if p_subtotal < c.min_order_paise then
    return jsonb_build_object('valid', false, 'code', v_code, 'discount_paise', 0,
      'message', 'Minimum order for this coupon is Rs ' || (c.min_order_paise / 100));
  end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then
    return jsonb_build_object('valid', false, 'code', v_code, 'discount_paise', 0, 'message', 'This coupon is fully redeemed.');
  end if;
  if p_user is not null then
    if (select count(*) from public.coupon_redemptions r where r.code = v_code and r.user_id = p_user) >= c.per_user_limit then
      return jsonb_build_object('valid', false, 'code', v_code, 'discount_paise', 0, 'message', 'You have already used this coupon.');
    end if;
    if c.first_order_only and (
         exists (select 1 from public.orders o where o.user_id = p_user and o.payment_status in ('paid', 'partially_refunded', 'refunded'))
         or exists (select 1 from public.subscriptions s where s.user_id = p_user and s.status in ('active', 'paused', 'completed', 'cancelled', 'on_hold') and s.payment_id is not null)) then
      return jsonb_build_object('valid', false, 'code', v_code, 'discount_paise', 0, 'message', 'This coupon is only valid on your first order.');
    end if;
  end if;
  v_disc := case c.kind when 'percent' then round(p_subtotal * c.value / 100.0) else c.value end;
  v_disc := least(v_disc, p_subtotal);
  return jsonb_build_object('valid', true, 'code', v_code, 'kind', c.kind, 'value', c.value,
                            'discount_paise', v_disc, 'message', 'Coupon applied.');
end $$;

-- Atomic redemption: row lock on the coupon, idempotent per (code, order|subscription).
create or replace function public._redeem_coupon(p_code text, p_user uuid, p_order uuid, p_sub uuid)
  returns boolean language plpgsql security definer set search_path = public as $$
declare c public.coupons%rowtype; v_rows integer; v_uses integer; v_over boolean := false;
begin
  if p_code is null then return false; end if;
  select * into c from public.coupons where code = p_code for update;
  if not found then return false; end if;
  select count(*) into v_uses from public.coupon_redemptions where code = p_code and user_id = p_user;
  v_over := (c.max_uses is not null and c.used_count >= c.max_uses) or v_uses >= c.per_user_limit;
  insert into public.coupon_redemptions (code, user_id, order_id, subscription_id)
  values (p_code, p_user, p_order, p_sub)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return false; end if;
  update public.coupons set used_count = used_count + 1 where code = p_code;
  if v_over then
    -- payment already captured at the discounted price; keep the order and flag it for review
    insert into public.audit_log (actor_id, action, entity, entity_id, detail)
    values (null, 'coupon_overrun', 'coupons', p_code,
            jsonb_build_object('user_id', p_user, 'order_id', p_order, 'subscription_id', p_sub));
  end if;
  return true;
end $$;

-- ---------------------------------------------------------------- stock
-- Reserve (decrement) stock for an order's items on its delivery date. Only products.track_stock.
create or replace function public._reserve_stock(p_order uuid, p_strict boolean)
  returns boolean language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; i record; st public.product_stock%rowtype;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or o.stock_reserved then return true; end if;
  for i in
    select it.product_id, sum(it.qty)::integer as qty, pr.name
      from public.order_items it join public.products pr on pr.id = it.product_id
     where it.order_id = p_order and pr.track_stock
     group by it.product_id, pr.name order by it.product_id
  loop
    select * into st from public.product_stock
     where product_id = i.product_id and stock_date = o.delivery_date for update;
    if found and st.unlimited then continue; end if;
    if not found or st.qty < i.qty then
      if p_strict then
        perform public._fail('out_of_stock', i.name || ' is not available in the requested quantity for that date.');
      end if;
      return false;
    end if;
  end loop;
  update public.product_stock ps
     set qty = ps.qty - x.qty
    from (select it.product_id, sum(it.qty)::integer as qty
            from public.order_items it join public.products pr on pr.id = it.product_id
           where it.order_id = p_order and pr.track_stock group by it.product_id) x
   where ps.product_id = x.product_id and ps.stock_date = o.delivery_date and not ps.unlimited;
  update public.orders set stock_reserved = true where id = p_order;
  return true;
end $$;

create or replace function public._release_stock(p_order uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or not o.stock_reserved then return; end if;
  update public.product_stock ps
     set qty = ps.qty + x.qty
    from (select it.product_id, sum(it.qty)::integer as qty
            from public.order_items it join public.products pr on pr.id = it.product_id
           where it.order_id = p_order and pr.track_stock group by it.product_id) x
   where ps.product_id = x.product_id and ps.stock_date = o.delivery_date and not ps.unlimited;
  update public.orders set stock_reserved = false where id = p_order;
end $$;

-- ---------------------------------------------------------------- subscription delivery rows
create or replace function public._gen_order_for_sub(s public.subscriptions, d date) returns boolean
  language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  insert into public.orders (user_id, kind, subscription_id, delivery_date, slot_id, status, payment_status, address,
                             subtotal_paise, discount_paise, delivery_fee_paise, tax_paise, total_paise)
  values (s.user_id, 'subscription_delivery', s.id, d, s.slot_id, 'confirmed', 'paid', s.address, 0, 0, 0, 0, 0)
  on conflict (subscription_id, delivery_date) where subscription_id is not null do nothing
  returning id into v_id;
  if v_id is null then return false; end if;
  select p.name || ' (' || coalesce(v.label, s.variant_key) || ')' into v_name
    from public.products p left join public.product_variants v on v.product_id = p.id and v.variant_key = s.variant_key
   where p.id = s.product_id;
  insert into public.order_items (order_id, product_id, variant_key, name_snapshot, unit_price_paise, qty, line_total_paise)
  values (v_id, s.product_id, s.variant_key, coalesce(v_name, 'Daily flowers'), 0, 1, 0);
  return true;
end $$;
