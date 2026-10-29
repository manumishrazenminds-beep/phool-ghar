-- Phool Ghar: server-side pricing engine and the public/pricing RPCs. Safe to re-run.
--
-- Payload accepted by _price / preview_pricing / create_checkout:
--   { lines: [{ product_id (uuid or slug) | slug, variant_key, qty }],
--     date, slot_id, coupon_code, pincode | address.pincode,
--     subscription: { plan_days, delivery_days: [0..6], start_date } }
-- Client supplied prices are never read.

create or replace function public._price(p_payload jsonb, p_user uuid, p_strict boolean default false)
  returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare
  v_errs jsonb := '[]'::jsonb;
  v_kind text;
  v_sub jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_raw text; v_vkey text; v_qty integer;
  v_prod public.products%rowtype;
  v_var public.product_variants%rowtype;
  v_unit integer;
  v_subtotal bigint := 0;
  v_slot public.delivery_slots%rowtype;
  v_slot_id text;
  v_date date; v_start date; v_end date; v_first date;
  v_pin text; v_zone public.delivery_zones%rowtype; v_zone_found boolean := false;
  v_fee bigint := 0; v_total bigint; v_tax bigint := 0; v_disc bigint := 0; v_plan_disc bigint := 0;
  v_gst numeric; v_lead integer; v_min integer;
  v_coupon jsonb := null; v_code text;
  v_days integer[]; v_plan public.plan_periods%rowtype; v_cnt integer := 0; v_perday integer := 0;
  v_gross bigint := 0; v_net bigint := 0;
  v_now timestamp := public._ist_now();
  v_today date := public._ist_now()::date;
  v_stock public.product_stock%rowtype;
  v_arr jsonb;
  e jsonb;
  v_has_lines boolean := false;
  v_maxq integer;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'errors', jsonb_build_array(public._err('invalid_payload', 'Request body is missing or malformed.')));
  end if;

  v_sub := p_payload -> 'subscription';
  v_kind := case when jsonb_typeof(v_sub) = 'object' then 'subscription' else 'one_time' end;
  v_maxq := case when jsonb_typeof(v_sub) = 'object' then 1 else 50 end;
  v_slot_id := nullif(btrim(p_payload ->> 'slot_id'), '');
  v_pin := nullif(btrim(coalesce(p_payload ->> 'pincode', p_payload -> 'address' ->> 'pincode', '')), '');
  v_code := nullif(upper(btrim(coalesce(p_payload ->> 'coupon_code', ''))), '');
  v_gst := coalesce(public._try_int(public._setting('gst_percent') #>> '{}'), 0);
  v_lead := public._setting_int('min_lead_minutes', 180);
  v_min := public._setting_int('min_order_paise', 0);

  -- ------------------------------------------------------------ lines
  v_arr := p_payload -> 'lines';
  if coalesce(jsonb_typeof(v_arr), '') <> 'array' or jsonb_array_length(v_arr) = 0 then
    v_errs := v_errs || public._err('invalid_lines', 'Add at least one item.');
  elsif jsonb_array_length(v_arr) > 20 then
    v_errs := v_errs || public._err('invalid_lines', 'Too many items in one order.');
  elsif v_kind = 'subscription' and jsonb_array_length(v_arr) <> 1 then
    v_errs := v_errs || public._err('invalid_lines', 'A subscription covers exactly one product.');
  else
    v_has_lines := true;
    for v_line in select value from jsonb_array_elements(v_arr) loop
      if jsonb_typeof(v_line) <> 'object' then
        v_errs := v_errs || public._err('invalid_lines', 'Malformed item.'); continue;
      end if;
      v_raw := nullif(btrim(coalesce(v_line ->> 'product_id', v_line ->> 'product_slug', v_line ->> 'slug', v_line ->> 'product', '')), '');
      v_vkey := lower(coalesce(nullif(btrim(coalesce(v_line ->> 'variant_key', v_line ->> 'variant', '')), ''), 'regular'));
      if v_line ? 'qty' or v_line ? 'quantity' then
        v_qty := public._try_int(coalesce(v_line ->> 'qty', v_line ->> 'quantity'));
      else
        v_qty := 1;
      end if;
      if v_qty is null or v_qty < 1 or v_qty > v_maxq then
        v_errs := v_errs || public._err('bad_quantity', 'Quantity is not valid.'); continue;
      end if;
      if v_raw is null then
        v_errs := v_errs || public._err('product_not_found', 'Item is missing a product.'); continue;
      end if;
      if v_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        select * into v_prod from public.products where id = v_raw::uuid and active;
      else
        select * into v_prod from public.products where slug = lower(v_raw) and active;
      end if;
      if not found then
        v_errs := v_errs || public._err('product_not_found', 'A product in your cart is no longer available.'); continue;
      end if;
      select * into v_var from public.product_variants where product_id = v_prod.id and variant_key = v_vkey;
      if not found then
        v_errs := v_errs || public._err('variant_not_found', v_prod.name || ' is not available in that size.'); continue;
      end if;
      if v_kind = 'subscription' then
        if v_prod.per_day_paise is null then
          v_errs := v_errs || public._err('not_subscribable', v_prod.name || ' is not available as a daily plan.'); continue;
        end if;
        v_perday := round(v_prod.per_day_paise * v_var.multiplier)::integer;
        v_unit := v_perday;
      else
        v_unit := round(v_prod.price_paise * v_var.multiplier)::integer;
      end if;
      v_lines := v_lines || jsonb_build_object(
        'product_id', v_prod.id, 'slug', v_prod.slug, 'name', v_prod.name, 'variant_key', v_vkey,
        'variant_label', v_var.label, 'qty', v_qty, 'unit_price_paise', v_unit,
        'line_total_paise', v_unit::bigint * v_qty, 'track_stock', v_prod.track_stock);
      v_subtotal := v_subtotal + v_unit::bigint * v_qty;
    end loop;
  end if;

  -- ------------------------------------------------------------ zone
  if v_pin is not null then
    if v_pin !~ '^[1-9][0-9]{5}$' then
      v_errs := v_errs || public._err('pincode_invalid', 'Enter a valid 6 digit pincode.');
    else
      select * into v_zone from public.delivery_zones where pincode = v_pin and active;
      v_zone_found := found;
      if not v_zone_found then
        v_errs := v_errs || public._err('pincode_unserviceable', 'We do not deliver to ' || v_pin || ' yet.');
      end if;
    end if;
  end if;

  -- ------------------------------------------------------------ slot
  if v_slot_id is not null then
    select * into v_slot from public.delivery_slots where id = v_slot_id and active;
    if not found then
      v_errs := v_errs || public._err('slot_unavailable', 'That delivery slot is not available.');
      v_slot_id := null;
    elsif v_kind = 'subscription' and not v_slot.subscription_ok then
      v_errs := v_errs || public._err('slot_unavailable', 'That slot is not available for daily plans.');
    end if;
  else
    v_errs := v_errs || public._err('slot_required', 'Choose a delivery slot.');
  end if;

  if v_kind = 'one_time' then
    -- ---------------------------------------------------------- one-time date rules
    v_date := public._try_date(p_payload ->> 'date');
    if v_date is null then
      v_errs := v_errs || public._err('invalid_date', 'Choose a delivery date.');
    elsif v_date < v_today or v_date > v_today + 60 then
      v_errs := v_errs || public._err('invalid_date', 'Delivery date must be within the next 60 days.');
    elsif v_slot_id is not null then
      if v_date = v_today and (v_slot.start_time - v_now::time) < make_interval(mins => v_lead) then
        v_errs := v_errs || public._err('slot_unavailable', 'That slot is too soon for same-day delivery.');
      elsif v_date = v_today + 1 and v_now::time >= public._cutoff() and v_slot.start_time < time '12:00' then
        v_errs := v_errs || public._err('cutoff_passed',
          'Orders for tomorrow morning close at ' || to_char(public._cutoff(), 'HH24:MI') || '. Pick a later date or the evening slot.');
      elsif public._slot_load(v_date, v_slot_id) >= v_slot.capacity then
        v_errs := v_errs || public._err('slot_full', 'That slot is fully booked for the selected date.');
      end if;
    end if;

    if v_has_lines and v_date is not null then
      for v_line in select value from jsonb_array_elements(v_lines) loop
        continue when not (v_line ->> 'track_stock')::boolean;
        select * into v_stock from public.product_stock
         where product_id = (v_line ->> 'product_id')::uuid and stock_date = v_date;
        if not found or (not v_stock.unlimited and v_stock.qty < (v_line ->> 'qty')::integer) then
          v_errs := v_errs || public._err('out_of_stock', (v_line ->> 'name') || ' is sold out for that date.');
        end if;
      end loop;
    end if;

    if v_has_lines and v_subtotal < v_min then
      v_errs := v_errs || public._err('min_order', 'Minimum order is Rs ' || (v_min / 100) || '.');
    end if;

    if v_zone_found then v_fee := v_zone.fee_paise; end if;

    if v_code is not null then
      if p_user is null then
        v_coupon := jsonb_build_object('valid', false, 'code', v_code, 'discount_paise', 0, 'message', 'Sign in to apply a coupon.');
      else
        v_coupon := public._coupon_eval(v_code, v_subtotal, 'one_time', p_user);
      end if;
      if (v_coupon ->> 'valid')::boolean then
        v_disc := (v_coupon ->> 'discount_paise')::bigint;
      elsif p_strict then
        v_errs := v_errs || public._err('coupon_invalid', v_coupon ->> 'message');
      end if;
    end if;

    v_total := greatest(v_subtotal - v_disc + v_fee, 0);
    v_tax := round(v_total * v_gst / (100 + v_gst));

    return jsonb_build_object(
      'ok', jsonb_array_length(v_errs) = 0, 'kind', 'one_time', 'errors', v_errs, 'lines', v_lines,
      'subtotal_paise', v_subtotal, 'discount_paise', v_disc, 'delivery_fee_paise', v_fee,
      'tax_paise', v_tax, 'total_paise', v_total, 'gst_percent', v_gst, 'coupon', v_coupon,
      'delivery_date', v_date, 'slot_id', v_slot_id, 'pincode', v_pin,
      'delivery_fee_known', v_zone_found,
      'zone', case when v_zone_found then jsonb_build_object('city', v_zone.city, 'area', v_zone.area, 'fee_paise', v_zone.fee_paise) end);
  end if;

  -- -------------------------------------------------------------- subscription
  select * into v_plan from public.plan_periods where days = public._try_int(v_sub ->> 'plan_days') and active;
  if not found then
    v_errs := v_errs || public._err('invalid_plan', 'Choose a valid plan length.');
  end if;

  if coalesce(jsonb_typeof(v_sub -> 'delivery_days'), '') <> 'array' or jsonb_array_length(v_sub -> 'delivery_days') = 0 then
    v_errs := v_errs || public._err('invalid_delivery_days', 'Choose at least one delivery day.');
  else
    select array_agg(distinct d order by d) into v_days
      from (select public._try_int(x #>> '{}') as d from jsonb_array_elements(v_sub -> 'delivery_days') x) q
     where d between 0 and 6;
    if v_days is null or cardinality(v_days) <> (select count(distinct x #>> '{}') from jsonb_array_elements(v_sub -> 'delivery_days') x) then
      v_errs := v_errs || public._err('invalid_delivery_days', 'Delivery days must be numbers from 0 (Mon) to 6 (Sun).');
      v_days := null;
    end if;
  end if;

  v_start := public._try_date(v_sub ->> 'start_date');
  v_first := public._first_changeable_date();
  if v_start is null then
    v_errs := v_errs || public._err('invalid_date', 'Choose a start date.');
  elsif v_start < v_first then
    v_errs := v_errs || public._err('cutoff_passed',
      'Plans must start on or after ' || to_char(v_first, 'DD Mon') || ' (orders for tomorrow close at '
      || to_char(public._cutoff(), 'HH24:MI') || ').');
  elsif v_start > v_today + 60 then
    v_errs := v_errs || public._err('invalid_date', 'Start date must be within the next 60 days.');
  end if;

  if v_plan.days is not null and v_days is not null and v_start is not null and v_start >= v_first then
    select count(*)::integer into v_cnt
      from generate_series(v_start, v_start + v_plan.days - 1, interval '1 day') g(d)
     where public._dow(g.d::date) = any (v_days);
    if v_cnt < 1 then
      v_errs := v_errs || public._err('invalid_delivery_days', 'No deliveries fall inside that plan period.');
    else
      v_end := public._sub_end_date(v_start, v_days, v_cnt, null);
      if v_slot_id is not null then
        -- capacity is checked on the first delivery
        declare v_d1 date := public._sub_end_date(v_start, v_days, 1, null);
        begin
          if public._slot_load(v_d1, v_slot_id) >= v_slot.capacity then
            v_errs := v_errs || public._err('slot_full', 'That slot is fully booked for the start date.');
          end if;
        end;
      end if;
    end if;
  end if;

  v_gross := v_perday::bigint * v_cnt;
  if v_plan.days is not null then
    v_plan_disc := round(v_gross * v_plan.discount_pct / 100.0);
  end if;
  v_net := v_gross - v_plan_disc;

  if v_zone_found and not public._setting_bool('free_delivery_for_subscription', true) then
    v_fee := v_zone.fee_paise::bigint * v_cnt;
  end if;

  if v_code is not null then
    if p_user is null then
      v_coupon := jsonb_build_object('valid', false, 'code', v_code, 'discount_paise', 0, 'message', 'Sign in to apply a coupon.');
    else
      v_coupon := public._coupon_eval(v_code, v_net, 'subscription', p_user);
    end if;
    if (v_coupon ->> 'valid')::boolean then
      v_disc := (v_coupon ->> 'discount_paise')::bigint;
    elsif p_strict then
      v_errs := v_errs || public._err('coupon_invalid', v_coupon ->> 'message');
    end if;
  end if;

  v_total := greatest(v_net - v_disc + v_fee, 0);
  v_tax := round(v_total * v_gst / (100 + v_gst));

  return jsonb_build_object(
    'ok', jsonb_array_length(v_errs) = 0, 'kind', 'subscription', 'errors', v_errs, 'lines', v_lines,
    'subtotal_paise', v_gross, 'plan_discount_paise', v_plan_disc,
    'discount_paise', v_plan_disc + v_disc, 'coupon_discount_paise', v_disc,
    'delivery_fee_paise', v_fee, 'tax_paise', v_tax, 'total_paise', v_total, 'gst_percent', v_gst, 'coupon', v_coupon,
    'slot_id', v_slot_id, 'pincode', v_pin, 'delivery_fee_known', v_zone_found,
    'zone', case when v_zone_found then jsonb_build_object('city', v_zone.city, 'area', v_zone.area, 'fee_paise', v_zone.fee_paise) end,
    'subscription', jsonb_build_object(
      'plan_days', v_plan.days, 'plan_label', v_plan.label, 'discount_pct', v_plan.discount_pct,
      'delivery_days', to_jsonb(v_days), 'start_date', v_start, 'end_date', v_end,
      'delivery_count', v_cnt, 'per_day_paise', v_perday));
end $fn$;

-- ---------------------------------------------------------------- public RPCs
create or replace function public.check_pincode(p_pincode text)
  returns table (ok boolean, city text, area text, fee_paise integer)
  language plpgsql stable security definer set search_path = public as $$
declare v text := btrim(coalesce(p_pincode, ''));
begin
  if v !~ '^[1-9][0-9]{5}$' then
    return query select false, null::text, null::text, 0;
    return;
  end if;
  return query
    select true, z.city, z.area, z.fee_paise from public.delivery_zones z where z.pincode = v and z.active;
  if not found then
    return query select false, null::text, null::text, 0;
  end if;
end $$;

-- Same maths as create_checkout, no writes. Coupons are evaluated only for signed-in callers
-- (stops anonymous coupon-code guessing).
create or replace function public.preview_pricing(p_payload jsonb) returns jsonb
  language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is not null and not public.rl_hit('preview:' || v_uid, 120, 60) then
    return jsonb_build_object('ok', false, 'errors', jsonb_build_array(public._err('rate_limited', 'Too many requests. Try again in a minute.')));
  end if;
  return public._price(p_payload, v_uid, false);
end $$;

create or replace function public.apply_coupon_preview(p_code text, p_subtotal_paise integer, p_kind text)
  returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('valid', false, 'discount_paise', 0, 'message', 'Sign in to apply a coupon.');
  end if;
  if p_kind is null or p_kind not in ('one_time', 'subscription') then
    return jsonb_build_object('valid', false, 'discount_paise', 0, 'message', 'Unknown purchase type.');
  end if;
  if p_subtotal_paise is null or p_subtotal_paise < 0 then
    return jsonb_build_object('valid', false, 'discount_paise', 0, 'message', 'Invalid amount.');
  end if;
  if not public.rl_hit('coupon:' || v_uid, 30, 60) then
    return jsonb_build_object('valid', false, 'discount_paise', 0, 'message', 'Too many attempts. Try again in a minute.');
  end if;
  return public._coupon_eval(p_code, p_subtotal_paise, p_kind, v_uid);
end $$;
