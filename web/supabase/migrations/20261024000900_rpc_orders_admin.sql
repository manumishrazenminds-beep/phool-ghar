-- Phool Ghar: order management, delivery sheet and dashboard RPCs. Safe to re-run.

create or replace function public._order_transition_ok(p_from public.order_status, p_to public.order_status)
  returns boolean language sql immutable as $$
  select case p_from
    when 'placed' then p_to in ('confirmed', 'cancelled', 'failed')
    when 'confirmed' then p_to in ('preparing', 'out_for_delivery', 'cancelled', 'failed')
    when 'preparing' then p_to in ('out_for_delivery', 'cancelled', 'failed')
    when 'out_for_delivery' then p_to in ('delivered', 'failed', 'cancelled')
    when 'failed' then p_to in ('out_for_delivery', 'confirmed', 'cancelled')
    else false end
$$;

create or replace function public.cancel_order(p_order uuid, p_reason text) returns jsonb
  language plpgsql volatile security definer set search_path = public as $fn$
declare
  o public.orders%rowtype; v_staff boolean; pay public.payments%rowtype; v_refundable bigint; v_refund uuid;
begin
  if auth.uid() is null then perform public._fail('not_authenticated', 'Sign in first.', '42501'); end if;
  if p_order is null then perform public._fail('not_found', 'Order not found.'); end if;
  select * into o from public.orders where id = p_order for update;
  if not found then perform public._fail('not_found', 'Order not found.'); end if;
  v_staff := public.has_perm('orders');
  if o.user_id <> auth.uid() and not v_staff then perform public._fail('not_found', 'Order not found.'); end if;

  if o.status = 'cancelled' then
    return jsonb_build_object('ok', true, 'already', true, 'order_id', o.id);
  end if;
  if not v_staff then
    if o.kind <> 'one_time' then
      perform public._fail('use_skip', 'Skip the delivery from your subscription instead.');
    end if;
    if o.status not in ('placed', 'confirmed') then
      perform public._fail('too_late', 'This order is already being prepared and can no longer be cancelled.');
    end if;
  elsif o.status = 'delivered' then
    perform public._fail('invalid_state', 'A delivered order cannot be cancelled.');
  end if;

  perform set_config('app.status_note', left(coalesce(nullif(btrim(p_reason), ''), 'cancelled'), 300), true);
  update public.orders
     set status = 'cancelled', failure_reason = left(nullif(btrim(coalesce(p_reason, '')), ''), 300),
         payment_status = case when payment_status = 'pending' then 'failed'::public.payment_status else payment_status end
   where id = o.id;
  perform set_config('app.status_note', '', true);
  perform public._release_stock(o.id);

  -- refund request for money already captured (processed by the refund-create function)
  select * into pay from public.payments where order_id = o.id and status = 'captured' order by created_at desc limit 1;
  if found then
    select pay.amount_paise - coalesce(sum(r.amount_paise), 0) into v_refundable
      from public.refunds r where r.payment_id = pay.id and r.status <> 'failed';
    if v_refundable > 0 then
      insert into public.refunds (payment_id, order_id, amount_paise, reason, status, created_by)
      values (pay.id, o.id, v_refundable, 'order_cancelled', 'pending', auth.uid())
      returning id into v_refund;
    end if;
  end if;

  perform public._audit('cancel', 'orders', o.id::text,
    jsonb_build_object('reason', left(p_reason, 300), 'by_staff', v_staff, 'refund_id', v_refund));
  perform public._notify_user(o.user_id, 'order_cancelled', 'Order ' || o.order_no || ' cancelled',
    case when v_refund is not null then 'Your refund has been requested and will reach you in 5 to 7 working days.'
         else 'Your order has been cancelled.' end,
    jsonb_build_object('order_id', o.id, 'order_no', o.order_no, 'refund_id', v_refund),
    'order_cancelled:' || o.id);
  return jsonb_build_object('ok', true, 'order_id', o.id, 'refund_id', v_refund);
end $fn$;

create or replace function public.set_order_status(p_order uuid, p_status public.order_status, p_note text)
  returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare
  o public.orders%rowtype; v_staff boolean; v_delivery boolean; v_tpl text; v_title text;
begin
  if auth.uid() is null then perform public._fail('not_authenticated', 'Sign in first.', '42501'); end if;
  if p_order is null or p_status is null then perform public._fail('invalid_input', 'order and status are required.'); end if;
  select * into o from public.orders where id = p_order for update;
  if not found then perform public._fail('not_found', 'Order not found.'); end if;

  v_staff := public.has_perm('orders');
  v_delivery := not v_staff and public.app_role() = 'delivery' and o.assigned_to = auth.uid();
  if not v_staff and not v_delivery then perform public._fail('not_found', 'Order not found.'); end if;
  if v_delivery and p_status not in ('out_for_delivery', 'delivered', 'failed') then
    perform public._fail('forbidden', 'Delivery staff can only mark out for delivery, delivered or failed.', '42501');
  end if;

  if o.status = p_status then
    return jsonb_build_object('ok', true, 'already', true, 'order_id', o.id, 'status', o.status::text);
  end if;
  if p_status = 'cancelled' then
    return public.cancel_order(p_order, p_note);
  end if;
  if not public._order_transition_ok(o.status, p_status) then
    perform public._fail('invalid_transition', 'Cannot move an order from ' || o.status || ' to ' || p_status || '.');
  end if;
  if o.payment_status not in ('paid', 'partially_refunded') and p_status not in ('failed') then
    perform public._fail('payment_pending', 'The order has not been paid yet.');
  end if;

  perform set_config('app.status_note', left(coalesce(nullif(btrim(p_note), ''), ''), 300), true);
  update public.orders
     set status = p_status,
         delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
         failure_reason = case when p_status = 'failed' then left(coalesce(nullif(btrim(p_note), ''), 'delivery_failed'), 300)
                               when p_status in ('confirmed', 'out_for_delivery', 'delivered') then null
                               else failure_reason end
   where id = o.id;
  perform set_config('app.status_note', '', true);

  if p_status in ('delivered', 'failed') or o.kind = 'one_time' then
    perform public._audit('status', 'orders', o.id::text, jsonb_build_object('from', o.status, 'to', p_status));
  end if;

  v_tpl := case p_status when 'confirmed' then 'order_confirmed' when 'preparing' then 'order_preparing'
             when 'out_for_delivery' then 'order_out_for_delivery' when 'delivered' then 'order_delivered' end;
  v_title := case p_status when 'confirmed' then 'Order confirmed' when 'preparing' then 'We are preparing your flowers'
             when 'out_for_delivery' then 'Out for delivery' when 'delivered' then 'Delivered' end;
  if v_tpl is not null then
    perform public._notify_user(o.user_id, v_tpl, v_title || ' (' || o.order_no || ')', null,
      jsonb_build_object('order_id', o.id, 'order_no', o.order_no, 'status', p_status),
      v_tpl || ':' || o.id);
  end if;
  return jsonb_build_object('ok', true, 'order_id', o.id, 'status', p_status::text);
end $fn$;

create or replace function public.assign_order(p_order uuid, p_staff uuid) returns jsonb
  language plpgsql volatile security definer set search_path = public as $fn$
declare o public.orders%rowtype; t public.profiles%rowtype;
begin
  if not public.has_perm('orders') then perform public._fail('forbidden', 'Not allowed.', '42501'); end if;
  select * into o from public.orders where id = p_order for update;
  if not found then perform public._fail('not_found', 'Order not found.'); end if;
  if o.status in ('delivered', 'cancelled') then perform public._fail('invalid_state', 'Order is closed.'); end if;
  if p_staff is not null then
    select * into t from public.profiles where id = p_staff and active and role in ('delivery', 'staff', 'admin');
    if not found then perform public._fail('invalid_assignee', 'Assignee must be an active delivery or staff account.'); end if;
  end if;
  update public.orders set assigned_to = p_staff where id = o.id;
  perform public._audit('assign', 'orders', o.id::text, jsonb_build_object('assigned_to', p_staff, 'previous', o.assigned_to));
  if p_staff is not null and p_staff is distinct from o.assigned_to then
    perform public._notify_user(p_staff, 'order_assigned', 'New delivery assigned: ' || o.order_no, null,
      jsonb_build_object('order_id', o.id, 'order_no', o.order_no, 'delivery_date', o.delivery_date, 'slot_id', o.slot_id),
      'order_assigned:' || o.id || ':' || p_staff, array['in_app']);
  end if;
  return jsonb_build_object('ok', true, 'order_id', o.id, 'assigned_to', p_staff);
end $fn$;

create or replace function public.bulk_assign_orders(p_date date, p_slot text, p_staff uuid) returns jsonb
  language plpgsql volatile security definer set search_path = public as $fn$
declare v_n integer;
begin
  if not public.has_perm('orders') then perform public._fail('forbidden', 'Not allowed.', '42501'); end if;
  if p_date is null then perform public._fail('invalid_date', 'Choose a date.'); end if;
  if p_staff is not null and not exists (
       select 1 from public.profiles where id = p_staff and active and role in ('delivery', 'staff', 'admin')) then
    perform public._fail('invalid_assignee', 'Assignee must be an active delivery or staff account.');
  end if;
  update public.orders
     set assigned_to = p_staff
   where delivery_date = p_date and (p_slot is null or slot_id = p_slot)
     and payment_status in ('paid', 'partially_refunded') and status in ('placed', 'confirmed', 'preparing');
  get diagnostics v_n = row_count;
  perform public._audit('bulk_assign', 'orders', p_date::text,
    jsonb_build_object('slot', p_slot, 'assigned_to', p_staff, 'count', v_n));
  if p_staff is not null and v_n > 0 then
    perform public._notify_user(p_staff, 'order_assigned', v_n || ' deliveries assigned for ' || to_char(p_date, 'DD Mon'), null,
      jsonb_build_object('delivery_date', p_date, 'slot_id', p_slot, 'count', v_n),
      'order_assigned_bulk:' || p_date || ':' || coalesce(p_slot, 'all') || ':' || p_staff || ':' || v_n, array['in_app']);
  end if;
  return jsonb_build_object('ok', true, 'assigned', v_n);
end $fn$;

create or replace function public.todays_delivery_list(p_date date)
  returns table (
    order_id uuid, order_no text, delivery_date date, slot_id text, slot_label text, slot_start time,
    status text, kind text, customer_name text, customer_phone text, recipient_name text, recipient_phone text,
    address_line text, landmark text, city text, pincode text, instructions text, gift_note text,
    items text, item_count integer, total_paise integer, payment_status text,
    assigned_to uuid, assigned_name text, subscription_id uuid)
  language sql stable security definer set search_path = public as $$
  select o.id, o.order_no, o.delivery_date, o.slot_id, sl.label, sl.start_time, o.status::text, o.kind,
         cu.full_name, cu.phone,
         o.address ->> 'recipient_name', o.address ->> 'recipient_phone',
         concat_ws(', ', o.address ->> 'line1', nullif(o.address ->> 'line2', '')),
         o.address ->> 'landmark', o.address ->> 'city', o.address ->> 'pincode', o.address ->> 'instructions',
         o.gift_note,
         (select string_agg(i.name_snapshot || ' x' || i.qty, ', ' order by i.name_snapshot)
            from public.order_items i where i.order_id = o.id),
         coalesce((select sum(i.qty)::integer from public.order_items i where i.order_id = o.id), 0),
         o.total_paise, o.payment_status::text, o.assigned_to, ap.full_name, o.subscription_id
    from public.orders o
    join public.delivery_slots sl on sl.id = o.slot_id
    left join public.profiles cu on cu.id = o.user_id
    left join public.profiles ap on ap.id = o.assigned_to
   where p_date is not null
     and o.delivery_date = p_date
     and o.status <> 'cancelled'
     and o.payment_status <> 'pending'
     and (public.has_perm('orders') or (public.app_role() = 'delivery' and o.assigned_to = auth.uid()))
   order by sl.sort, sl.start_time, o.address ->> 'pincode', o.order_no
$$;

create or replace function public.admin_dashboard(p_from date, p_to date) returns jsonb
  language plpgsql stable security definer set search_path = public as $fn$
declare
  v_by_status jsonb; v_by_slot jsonb; v_gross bigint; v_refunded bigint; v_orders integer; v_subs integer;
  v_failed integer; v_new integer; v_deliveries integer;
begin
  if not public.has_perm('reports') then perform public._fail('forbidden', 'Not allowed.', '42501'); end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    perform public._fail('invalid_date', 'Choose a valid date range (at most one year).');
  end if;

  select coalesce(jsonb_object_agg(s, n), '{}'::jsonb) into v_by_status
    from (select status::text as s, count(*)::integer as n from public.orders
           where delivery_date between p_from and p_to group by status) q;
  select count(*)::integer into v_orders from public.orders
   where delivery_date between p_from and p_to and kind = 'one_time';
  select coalesce(jsonb_agg(jsonb_build_object('slot_id', slot_id, 'count', n) order by slot_id), '[]'::jsonb)
    into v_by_slot
    from (select slot_id, count(*)::integer as n from public.orders
           where delivery_date between p_from and p_to and status not in ('cancelled', 'failed') group by slot_id) q;
  select coalesce(sum(amount_paise), 0) into v_gross from public.payments
   where status in ('captured', 'refunded') and (created_at at time zone 'Asia/Kolkata')::date between p_from and p_to;
  select coalesce(sum(amount_paise), 0) into v_refunded from public.refunds
   where status = 'processed' and (created_at at time zone 'Asia/Kolkata')::date between p_from and p_to;
  select count(*)::integer into v_subs from public.subscriptions where status in ('active', 'paused');
  select count(*)::integer into v_failed from public.orders
   where delivery_date between p_from and p_to and status = 'failed';
  select count(*)::integer into v_new from public.profiles
   where role = 'customer' and (created_at at time zone 'Asia/Kolkata')::date between p_from and p_to;
  select count(*)::integer into v_deliveries from public.orders
   where delivery_date between p_from and p_to and status = 'delivered';

  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'orders_one_time', v_orders, 'orders_by_status', v_by_status,
    'deliveries_done', v_deliveries, 'failed_orders', v_failed,
    'revenue_gross_paise', v_gross, 'refunded_paise', v_refunded, 'revenue_net_paise', v_gross - v_refunded,
    'active_subscriptions', v_subs, 'deliveries_by_slot', v_by_slot, 'new_customers', v_new);
end $fn$;
