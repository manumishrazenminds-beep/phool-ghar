-- Phool Ghar: checkout and payment RPCs (service role only). Safe to re-run.
--
-- Errors raised by create_checkout: MESSAGE = 'code: human text', DETAIL = human text, HINT = code (snake_case).

create or replace function public.create_checkout(p_user uuid, p_payload jsonb, p_idem text)
  returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare
  pr public.profiles%rowtype;
  v_key text; v_resp jsonb;
  a public.addresses%rowtype;
  v_raw jsonb; v_rcp jsonb; v_name text; v_phone text; v_line1 text; v_pin text; v_city text;
  v_addr jsonb; v_instr text; v_gift text;
  v_payload jsonb; v_price jsonb; v_err jsonb;
  o public.orders%rowtype; s public.subscriptions%rowtype;
  v_coupon text; v_sub jsonb; v_days integer[];
  v_summary jsonb;
  v_ex_o public.orders%rowtype; v_ex_s public.subscriptions%rowtype;
begin
  if p_user is null then perform public._fail('invalid_user', 'User is required.'); end if;
  select * into pr from public.profiles where id = p_user and active;
  if not found then perform public._fail('invalid_user', 'Account not found or disabled.'); end if;
  if p_idem is null or p_idem !~ '^[A-Za-z0-9_.:-]{8,128}$' then
    perform public._fail('invalid_idempotency_key', 'Idempotency key must be 8 to 128 URL-safe characters.');
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    perform public._fail('invalid_payload', 'Request body is missing or malformed.');
  end if;

  v_key := 'checkout:' || p_user || ':' || p_idem;
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  -- replay
  select response into v_resp from public.idempotency_keys where key = v_key and expires_at > now();
  if found and v_resp is not null then
    return v_resp || jsonb_build_object('replayed', true);
  end if;
  select * into v_ex_o from public.orders where idempotency_key = v_key;
  if found then
    return jsonb_build_object('kind', 'one_time', 'order_id', v_ex_o.id, 'order_no', v_ex_o.order_no,
      'amount_paise', v_ex_o.total_paise, 'currency', 'INR', 'replayed', true);
  end if;
  select * into v_ex_s from public.subscriptions where idempotency_key = v_key;
  if found then
    return jsonb_build_object('kind', 'subscription', 'subscription_id', v_ex_s.id,
      'amount_paise', v_ex_s.total_paise, 'currency', 'INR', 'replayed', true);
  end if;

  if not public.rl_hit('checkout:' || p_user, 20, 60) then
    perform public._fail('rate_limited', 'Too many checkout attempts. Try again in a minute.');
  end if;

  -- ------------------------------------------------------------ address snapshot
  if nullif(p_payload ->> 'address_id', '') is not null then
    if (p_payload ->> 'address_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      perform public._fail('address_not_found', 'Saved address not found.');
    end if;
    select * into a from public.addresses where id = (p_payload ->> 'address_id')::uuid and user_id = p_user;
    if not found then perform public._fail('address_not_found', 'Saved address not found.'); end if;
    v_name := a.recipient_name; v_phone := a.recipient_phone; v_line1 := a.line1; v_pin := a.pincode;
    v_city := a.city; v_instr := a.instructions;
    v_addr := jsonb_build_object('recipient_name', a.recipient_name, 'recipient_phone', a.recipient_phone,
      'line1', a.line1, 'line2', a.line2, 'landmark', a.landmark, 'city', a.city, 'pincode', a.pincode);
  else
    v_raw := case when jsonb_typeof(p_payload -> 'address') = 'object' then p_payload -> 'address' else '{}'::jsonb end;
    v_rcp := case when jsonb_typeof(p_payload -> 'recipient') = 'object' then p_payload -> 'recipient' else '{}'::jsonb end;
    v_name := btrim(coalesce(v_raw ->> 'recipient_name', v_rcp ->> 'name', v_rcp ->> 'recipient_name', ''));
    v_phone := public._norm_phone(coalesce(v_raw ->> 'recipient_phone', v_rcp ->> 'phone', v_rcp ->> 'recipient_phone'));
    v_line1 := btrim(coalesce(v_raw ->> 'line1', ''));
    v_pin := btrim(coalesce(v_raw ->> 'pincode', ''));
    v_city := btrim(coalesce(v_raw ->> 'city', ''));
    v_instr := v_raw ->> 'instructions';
    if char_length(v_name) not between 2 and 100 then perform public._fail('address_invalid', 'Recipient name is required.'); end if;
    if v_phone is null then perform public._fail('address_invalid', 'Enter a valid 10 digit mobile number.'); end if;
    if char_length(v_line1) not between 3 and 200 then perform public._fail('address_invalid', 'Address line is required.'); end if;
    v_addr := jsonb_build_object('recipient_name', v_name, 'recipient_phone', v_phone, 'line1', v_line1,
      'line2', left(nullif(btrim(coalesce(v_raw ->> 'line2', '')), ''), 200),
      'landmark', left(nullif(btrim(coalesce(v_raw ->> 'landmark', '')), ''), 200),
      'city', v_city, 'pincode', v_pin);
  end if;
  v_instr := left(nullif(btrim(coalesce(p_payload ->> 'instructions', v_instr, '')), ''), 300);
  v_gift := left(nullif(btrim(coalesce(p_payload ->> 'gift_note', '')), ''), 300);

  -- ------------------------------------------------------------ serialise on the slot, then price
  perform 1 from public.delivery_slots where id = p_payload ->> 'slot_id' for update;

  v_payload := (p_payload - 'address' - 'recipient') || jsonb_build_object('pincode', v_addr ->> 'pincode');
  v_price := public._price(v_payload, p_user, true);
  if not (v_price ->> 'ok')::boolean then
    v_err := v_price -> 'errors' -> 0;
    perform public._fail(v_err ->> 'code', v_err ->> 'message');
  end if;
  if (v_price ->> 'total_paise')::bigint < 100 then
    perform public._fail('invalid_total', 'Order total is too low to charge.');
  end if;

  -- city falls back to the serviceable zone's city
  v_city := coalesce(nullif(v_city, ''), v_price -> 'zone' ->> 'city');
  v_addr := jsonb_set(v_addr, '{city}', to_jsonb(v_city)) || jsonb_build_object('instructions', v_instr);
  v_coupon := case when (v_price -> 'coupon' ->> 'valid')::boolean then v_price -> 'coupon' ->> 'code' end;

  -- ------------------------------------------------------------ one-time order
  if v_price ->> 'kind' = 'one_time' then
    insert into public.orders (user_id, kind, delivery_date, slot_id, status, payment_status, address, gift_note,
                               subtotal_paise, discount_paise, delivery_fee_paise, tax_paise, total_paise,
                               coupon_code, idempotency_key)
    values (p_user, 'one_time', (v_price ->> 'delivery_date')::date, v_price ->> 'slot_id', 'placed', 'pending', v_addr, v_gift,
            (v_price ->> 'subtotal_paise')::integer, (v_price ->> 'discount_paise')::integer,
            (v_price ->> 'delivery_fee_paise')::integer, (v_price ->> 'tax_paise')::integer,
            (v_price ->> 'total_paise')::integer, v_coupon, v_key)
    returning * into o;

    insert into public.order_items (order_id, product_id, variant_key, name_snapshot, unit_price_paise, qty, line_total_paise)
    select o.id, (l ->> 'product_id')::uuid, l ->> 'variant_key', (l ->> 'name') || ' (' || (l ->> 'variant_label') || ')',
           (l ->> 'unit_price_paise')::integer, (l ->> 'qty')::integer, (l ->> 'line_total_paise')::integer
      from jsonb_array_elements(v_price -> 'lines') l;

    perform public._reserve_stock(o.id, true);

    v_summary := jsonb_build_object(
      'lines', v_price -> 'lines', 'subtotal_paise', o.subtotal_paise, 'discount_paise', o.discount_paise,
      'delivery_fee_paise', o.delivery_fee_paise, 'tax_paise', o.tax_paise, 'total_paise', o.total_paise,
      'coupon_code', o.coupon_code, 'delivery_date', o.delivery_date, 'slot_id', o.slot_id);
    v_resp := jsonb_build_object('kind', 'one_time', 'order_id', o.id, 'order_no', o.order_no,
                                 'amount_paise', o.total_paise, 'currency', 'INR', 'summary', v_summary);
  else
    -- ---------------------------------------------------------- subscription
    v_sub := v_price -> 'subscription';
    v_days := array(select (x #>> '{}')::integer from jsonb_array_elements(v_sub -> 'delivery_days') x);
    insert into public.subscriptions (user_id, product_id, variant_key, plan_days, delivery_days, start_date, end_date,
                                      slot_id, address, status, per_day_paise, total_paise, delivery_count,
                                      subtotal_paise, discount_paise, delivery_fee_paise, tax_paise, coupon_code,
                                      idempotency_key)
    values (p_user, (v_price -> 'lines' -> 0 ->> 'product_id')::uuid, v_price -> 'lines' -> 0 ->> 'variant_key',
            (v_sub ->> 'plan_days')::integer, v_days, (v_sub ->> 'start_date')::date, (v_sub ->> 'end_date')::date,
            v_price ->> 'slot_id', v_addr, 'pending_payment', (v_sub ->> 'per_day_paise')::integer,
            (v_price ->> 'total_paise')::integer, (v_sub ->> 'delivery_count')::integer,
            (v_price ->> 'subtotal_paise')::integer, (v_price ->> 'discount_paise')::integer,
            (v_price ->> 'delivery_fee_paise')::integer, (v_price ->> 'tax_paise')::integer, v_coupon, v_key)
    returning * into s;

    v_summary := jsonb_build_object(
      'lines', v_price -> 'lines', 'subtotal_paise', s.subtotal_paise, 'discount_paise', s.discount_paise,
      'plan_discount_paise', (v_price ->> 'plan_discount_paise')::integer,
      'delivery_fee_paise', s.delivery_fee_paise, 'tax_paise', s.tax_paise, 'total_paise', s.total_paise,
      'coupon_code', s.coupon_code, 'slot_id', s.slot_id, 'subscription', v_sub);
    v_resp := jsonb_build_object('kind', 'subscription', 'subscription_id', s.id,
                                 'amount_paise', s.total_paise, 'currency', 'INR', 'summary', v_summary);
  end if;

  insert into public.idempotency_keys (key, scope, user_id, response)
  values (v_key, 'checkout', p_user, v_resp)
  on conflict (key) do nothing;
  return v_resp;
end $fn$;

-- ---------------------------------------------------------------- payment captured
create or replace function public.mark_payment_captured(
  p_provider_order_id text, p_provider_payment_id text, p_method text, p_raw jsonb)
  returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare
  pay public.payments%rowtype; o public.orders%rowtype; s public.subscriptions%rowtype;
  v_raw_amt bigint; v_first date; v_today date := public._ist_today(); v_new_start date; d date;
  v_dup boolean := false;
begin
  if coalesce(btrim(p_provider_order_id), '') = '' then
    perform public._fail('invalid_input', 'provider order id is required.');
  end if;

  -- The row lock makes concurrent verify + webhook calls serialise; the loser sees status = captured.
  select * into pay from public.payments where provider_order_id = p_provider_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'payment_not_found');
  end if;

  if pay.status in ('captured', 'refunded') then
    return jsonb_build_object('ok', true, 'already', true, 'status', pay.status::text, 'order_id', pay.order_id,
                              'subscription_id', pay.subscription_id, 'amount_paise', pay.amount_paise);
  end if;

  v_raw_amt := case when p_raw ->> 'amount' ~ '^\d{1,12}$' then (p_raw ->> 'amount')::bigint end;
  if v_raw_amt is not null and v_raw_amt <> pay.amount_paise then
    update public.payments set error_code = 'amount_mismatch',
           error_desc = 'provider amount ' || v_raw_amt || ' differs from expected ' || pay.amount_paise,
           raw = coalesce(p_raw, raw) where id = pay.id;
    insert into public.audit_log (action, entity, entity_id, detail)
    values ('amount_mismatch', 'payments', pay.id::text, jsonb_build_object('expected', pay.amount_paise, 'got', v_raw_amt));
    return jsonb_build_object('ok', false, 'code', 'amount_mismatch');
  end if;

  if pay.order_id is not null then
    -- ---------------------------------------------------------- order payment
    select * into o from public.orders where id = pay.order_id for update;
    if o.total_paise <> pay.amount_paise then
      insert into public.audit_log (action, entity, entity_id, detail)
      values ('amount_mismatch', 'orders', o.id::text, jsonb_build_object('order_total', o.total_paise, 'payment', pay.amount_paise));
      return jsonb_build_object('ok', false, 'code', 'amount_mismatch');
    end if;

    update public.payments
       set status = 'captured', provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
           method = coalesce(p_method, method), raw = coalesce(p_raw, raw), error_code = null, error_desc = null
     where id = pay.id;

    if o.payment_status in ('paid', 'partially_refunded', 'refunded') then
      -- a second, different payment for an already paid order: keep the money safe, queue a refund
      insert into public.refunds (payment_id, order_id, amount_paise, reason, status)
      values (pay.id, o.id, pay.amount_paise, 'duplicate_payment', 'pending');
      insert into public.audit_log (action, entity, entity_id, detail)
      values ('duplicate_payment', 'orders', o.id::text, jsonb_build_object('payment_id', pay.id));
      return jsonb_build_object('ok', true, 'already', false, 'warning', 'duplicate_payment', 'order_id', o.id,
                                'amount_paise', pay.amount_paise);
    end if;

    update public.orders
       set payment_status = 'paid',
           status = case when status in ('placed', 'cancelled', 'failed') then 'confirmed'::public.order_status else status end,
           failure_reason = null
     where id = o.id;
    if o.status in ('cancelled', 'failed') and not o.stock_reserved then
      perform public._reserve_stock(o.id, false);   -- late payment after expiry: best effort
    end if;
    perform public._redeem_coupon(o.coupon_code, o.user_id, o.id, null);

    perform public._notify_user(o.user_id, 'order_placed', 'Order ' || o.order_no || ' confirmed',
      'Thank you. We will deliver on ' || to_char(o.delivery_date, 'DD Mon YYYY') || '.',
      jsonb_build_object('order_id', o.id, 'order_no', o.order_no, 'total_paise', o.total_paise,
                         'delivery_date', o.delivery_date, 'slot_id', o.slot_id),
      'order_placed:' || o.id);
    perform public._notify_user(o.user_id, 'payment_success', 'Payment received',
      'We received Rs ' || (o.total_paise / 100.0)::numeric(12, 2) || ' for order ' || o.order_no || '.',
      jsonb_build_object('order_id', o.id, 'payment_id', pay.id, 'amount_paise', pay.amount_paise),
      'payment_success:' || pay.id, array['in_app']);

    return jsonb_build_object('ok', true, 'already', false, 'status', 'captured', 'kind', 'one_time',
                              'order_id', o.id, 'order_no', o.order_no, 'amount_paise', pay.amount_paise);
  end if;

  -- ------------------------------------------------------------ subscription payment
  select * into s from public.subscriptions where id = pay.subscription_id for update;
  if s.total_paise <> pay.amount_paise then
    insert into public.audit_log (action, entity, entity_id, detail)
    values ('amount_mismatch', 'subscriptions', s.id::text, jsonb_build_object('sub_total', s.total_paise, 'payment', pay.amount_paise));
    return jsonb_build_object('ok', false, 'code', 'amount_mismatch');
  end if;

  update public.payments
     set status = 'captured', provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
         method = coalesce(p_method, method), raw = coalesce(p_raw, raw), error_code = null, error_desc = null
   where id = pay.id;

  if s.payment_id is not null and s.payment_id <> pay.id and s.status in ('active', 'paused', 'completed') then
    insert into public.refunds (payment_id, amount_paise, reason, status)
    values (pay.id, pay.amount_paise, 'duplicate_payment', 'pending');
    insert into public.audit_log (action, entity, entity_id, detail)
    values ('duplicate_payment', 'subscriptions', s.id::text, jsonb_build_object('payment_id', pay.id));
    return jsonb_build_object('ok', true, 'already', false, 'warning', 'duplicate_payment', 'subscription_id', s.id,
                              'amount_paise', pay.amount_paise);
  end if;

  v_first := public._first_changeable_date();
  v_new_start := greatest(s.start_date, v_first);
  update public.subscriptions
     set status = 'active', payment_id = pay.id, start_date = v_new_start,
         end_date = greatest(end_date, v_new_start), cancelled_at = null, cancel_reason = null
   where id = s.id;
  perform public._recompute_sub(s.id);
  select * into s from public.subscriptions where id = s.id;

  -- materialise at most the next two delivery days; the scheduler does the rest
  for d in select g::date from generate_series(v_today + 1, v_today + 2, interval '1 day') g loop
    if d between s.start_date and s.end_date and public._dow(d) = any (s.delivery_days)
       and not exists (select 1 from public.subscription_skips k where k.subscription_id = s.id and k.skip_date = d) then
      perform public._gen_order_for_sub(s, d);
    end if;
  end loop;

  perform public._redeem_coupon(s.coupon_code, s.user_id, null, s.id);
  perform public._notify_user(s.user_id, 'subscription_started', 'Your daily flower plan is active',
    'First delivery on ' || to_char(s.start_date, 'DD Mon YYYY') || ', plan runs until ' || to_char(s.end_date, 'DD Mon YYYY') || '.',
    jsonb_build_object('subscription_id', s.id, 'start_date', s.start_date, 'end_date', s.end_date, 'total_paise', s.total_paise),
    'subscription_started:' || s.id);
  perform public._notify_user(s.user_id, 'payment_success', 'Payment received',
    'We received Rs ' || (s.total_paise / 100.0)::numeric(12, 2) || ' for your plan.',
    jsonb_build_object('subscription_id', s.id, 'payment_id', pay.id, 'amount_paise', pay.amount_paise),
    'payment_success:' || pay.id, array['in_app']);

  return jsonb_build_object('ok', true, 'already', false, 'status', 'captured', 'kind', 'subscription',
                            'subscription_id', s.id, 'amount_paise', pay.amount_paise,
                            'start_date', s.start_date, 'end_date', s.end_date);
end $fn$;

-- A failed attempt does not kill the order: Razorpay lets the customer retry on the same provider order.
create or replace function public.mark_payment_failed(p_provider_order_id text, p_code text, p_desc text, p_raw jsonb)
  returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare pay public.payments%rowtype;
begin
  if coalesce(btrim(p_provider_order_id), '') = '' then
    perform public._fail('invalid_input', 'provider order id is required.');
  end if;
  select * into pay from public.payments where provider_order_id = p_provider_order_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'payment_not_found'); end if;
  if pay.status in ('captured', 'refunded') then
    return jsonb_build_object('ok', true, 'ignored', true, 'status', pay.status::text);
  end if;

  update public.payments
     set status = 'failed', error_code = left(p_code, 100), error_desc = left(p_desc, 500), raw = coalesce(p_raw, raw)
   where id = pay.id;
  if pay.order_id is not null then
    update public.orders set failure_reason = left(coalesce(p_desc, p_code, 'payment_failed'), 300)
     where id = pay.order_id and payment_status = 'pending';
  end if;
  perform public._notify_user(pay.user_id, 'payment_failed', 'Payment did not go through',
    coalesce(nullif(left(p_desc, 200), ''), 'Your payment could not be completed. You can try again.'),
    jsonb_build_object('payment_id', pay.id, 'order_id', pay.order_id, 'subscription_id', pay.subscription_id),
    'payment_failed:' || pay.id || ':' || coalesce(p_code, ''));
  return jsonb_build_object('ok', true, 'status', 'failed', 'order_id', pay.order_id, 'subscription_id', pay.subscription_id);
end $fn$;

-- ---------------------------------------------------------------- refunds
create or replace function public.mark_refund(
  p_payment_id uuid, p_amount_paise integer, p_provider_refund_id text, p_status text)
  returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare
  pay public.payments%rowtype; r public.refunds%rowtype; v_other bigint; v_done bigint; v_pay_status public.pay_status;
  v_became_processed boolean := false; v_order_status public.payment_status;
begin
  if p_status is null or p_status not in ('pending', 'processed', 'failed') then
    perform public._fail('invalid_input', 'status must be pending, processed or failed.');
  end if;
  if p_amount_paise is null or p_amount_paise <= 0 then
    perform public._fail('invalid_input', 'amount must be positive.');
  end if;
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then perform public._fail('payment_not_found', 'Payment not found.'); end if;
  if pay.status not in ('captured', 'refunded') then
    perform public._fail('not_refundable', 'Only captured payments can be refunded.');
  end if;

  -- 1) same provider refund id: update in place (idempotent)
  if p_provider_refund_id is not null then
    select * into r from public.refunds where provider_refund_id = p_provider_refund_id for update;
  end if;
  -- 2) otherwise adopt the oldest queued request created by cancel_order
  if r.id is null then
    select * into r from public.refunds
     where payment_id = pay.id and provider_refund_id is null and status = 'pending' and amount_paise = p_amount_paise
     order by created_at limit 1 for update;
  end if;

  if r.id is null then
    select coalesce(sum(amount_paise), 0) into v_other from public.refunds where payment_id = pay.id and status <> 'failed';
    if v_other + p_amount_paise > pay.amount_paise then
      perform public._fail('refund_exceeds_payment', 'Refund would exceed the amount paid.');
    end if;
    insert into public.refunds (payment_id, order_id, amount_paise, reason, provider_refund_id, status, created_by)
    values (pay.id, pay.order_id, p_amount_paise, 'manual', p_provider_refund_id, p_status, auth.uid())
    returning * into r;
    v_became_processed := p_status = 'processed';
  else
    v_became_processed := p_status = 'processed' and r.status <> 'processed';
    update public.refunds
       set status = case when r.status = 'processed' and p_status <> 'processed' then r.status else p_status end,
           provider_refund_id = coalesce(provider_refund_id, p_provider_refund_id)
     where id = r.id returning * into r;
  end if;

  select coalesce(sum(amount_paise), 0) into v_done from public.refunds where payment_id = pay.id and status = 'processed';
  if v_done >= pay.amount_paise then
    update public.payments set status = 'refunded' where id = pay.id and status <> 'refunded';
  end if;
  -- a refund of a duplicate charge leaves the order's own (still valid) payment untouched
  if pay.order_id is not null and v_done > 0 and r.reason is distinct from 'duplicate_payment' then
    v_order_status := case when v_done >= pay.amount_paise then 'refunded' else 'partially_refunded' end;
    update public.orders set payment_status = v_order_status where id = pay.order_id;
  end if;
  select status into v_pay_status from public.payments where id = pay.id;

  if v_became_processed then
    perform public._notify_user(pay.user_id, 'refund_processed', 'Refund processed',
      'Rs ' || (r.amount_paise / 100.0)::numeric(12, 2) || ' is on its way back to your original payment method.',
      jsonb_build_object('refund_id', r.id, 'payment_id', pay.id, 'order_id', pay.order_id, 'amount_paise', r.amount_paise),
      'refund_processed:' || r.id);
  end if;
  return jsonb_build_object('ok', true, 'refund_id', r.id, 'status', r.status, 'refunded_paise', v_done,
                            'payment_status', v_pay_status::text);
end $fn$;

-- ---------------------------------------------------------------- housekeeping for unpaid carts
-- Schedule from the cron migration (every 15 minutes is plenty).
create or replace function public.expire_stale_orders(p_minutes integer default 60) returns jsonb
  language plpgsql volatile security definer set search_path = public as $fn$
declare r record; v_orders integer := 0; v_subs integer := 0;
begin
  if p_minutes is null or p_minutes < 10 then p_minutes := 60; end if;
  for r in
    select o.id from public.orders o
     where o.payment_status = 'pending' and o.status = 'placed' and o.kind = 'one_time'
       and o.created_at < now() - make_interval(mins => p_minutes)
       and not exists (select 1 from public.payments p where p.order_id = o.id and p.status in ('captured', 'authorized'))
     for update skip locked
  loop
    perform set_config('app.status_note', 'payment_timeout', true);
    update public.orders set status = 'cancelled', payment_status = 'failed', failure_reason = 'payment_timeout' where id = r.id;
    perform public._release_stock(r.id);
    v_orders := v_orders + 1;
  end loop;
  perform set_config('app.status_note', '', true);

  with x as (
    update public.subscriptions s set status = 'cancelled', cancelled_at = now(), cancel_reason = 'payment_timeout'
     where s.status = 'pending_payment' and s.created_at < now() - make_interval(mins => p_minutes)
       and not exists (select 1 from public.payments p where p.subscription_id = s.id and p.status in ('captured', 'authorized'))
    returning 1)
  select count(*) into v_subs from x;
  return jsonb_build_object('orders_expired', v_orders, 'subscriptions_expired', v_subs);
end $fn$;
