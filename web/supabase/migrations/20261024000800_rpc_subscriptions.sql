-- Phool Ghar: subscription RPCs. Safe to re-run.
-- Customers are bound by the cut-off (default 21:00 IST); staff with the 'subscriptions' permission
-- may act on any date from today onwards.
-- A skip or a pause inserts rows into subscription_skips; end_date is always recomputed as the date of
-- the Nth valid delivery (N = delivery_count), so skips and pauses extend the plan to the next valid weekday.

create or replace function public.generate_subscription_orders(p_for_date date) returns jsonb
  language plpgsql volatile security definer set search_path = public as $fn$
declare
  s public.subscriptions%rowtype; o record;
  v_created integer := 0; v_existing integer := 0; v_skipped integer := 0; v_completed integer := 0;
  v_reminders integer := 0; v_ending integer := 0; v_today date := public._ist_today();
begin
  if p_for_date is null or p_for_date < v_today - 1 or p_for_date > v_today + 31 then
    perform public._fail('invalid_date', 'p_for_date must be within a month of today.');
  end if;

  with x as (
    update public.subscriptions set status = 'completed'
     where status in ('active', 'paused') and end_date < p_for_date returning 1)
  select count(*) into v_completed from x;

  update public.subscriptions set status = 'active', paused_from = null, paused_to = null
   where status = 'paused' and paused_to is not null and paused_to < p_for_date;

  for s in
    select * from public.subscriptions
     where status in ('active', 'paused') and start_date <= p_for_date and end_date >= p_for_date
       and public._dow(p_for_date) = any (delivery_days)
     order by id
     for update
  loop
    if exists (select 1 from public.subscription_skips k where k.subscription_id = s.id and k.skip_date = p_for_date) then
      v_skipped := v_skipped + 1;
    elsif public._gen_order_for_sub(s, p_for_date) then
      v_created := v_created + 1;
    else
      v_existing := v_existing + 1;
    end if;
  end loop;

  -- reminders for every live delivery that day (dedupe keys make this safe to repeat)
  for o in
    select ord.id, ord.user_id, ord.subscription_id, ord.delivery_date, ord.slot_id
      from public.orders ord
     where ord.kind = 'subscription_delivery' and ord.delivery_date = p_for_date
       and ord.status in ('confirmed', 'placed', 'preparing')
  loop
    perform public._notify_user(o.user_id, 'delivery_reminder', 'Tomorrow''s flowers are on the way',
      'Your delivery is planned for ' || to_char(o.delivery_date, 'DD Mon') || '. Skip it before ' ||
      to_char(public._cutoff(), 'HH24:MI') || ' tonight if you do not need it.',
      jsonb_build_object('order_id', o.id, 'subscription_id', o.subscription_id, 'delivery_date', o.delivery_date,
                         'slot_id', o.slot_id, 'can_skip_until', public._cutoff()),
      'delivery_reminder:' || o.id);
    v_reminders := v_reminders + 1;
  end loop;

  for s in
    select * from public.subscriptions
     where status = 'active' and end_date between p_for_date and p_for_date + 2
  loop
    perform public._notify_user(s.user_id, 'plan_ending_soon', 'Your flower plan is ending soon',
      'Your plan ends on ' || to_char(s.end_date, 'DD Mon YYYY') || '. Renew to keep your daily flowers coming.',
      jsonb_build_object('subscription_id', s.id, 'end_date', s.end_date),
      'plan_ending:' || s.id || ':' || s.end_date);
    v_ending := v_ending + 1;
  end loop;

  return jsonb_build_object('for_date', p_for_date, 'created', v_created, 'existing', v_existing,
                            'skipped', v_skipped, 'completed', v_completed, 'reminders', v_reminders,
                            'ending_soon', v_ending);
end $fn$;

-- internal: authorisation shared by the customer-facing subscription RPCs
create or replace function public._sub_lock(p_sub uuid) returns public.subscriptions
  language plpgsql volatile security definer set search_path = public as $$
declare s public.subscriptions%rowtype;
begin
  if auth.uid() is null then perform public._fail('not_authenticated', 'Sign in first.', '42501'); end if;
  if p_sub is null then perform public._fail('not_found', 'Subscription not found.'); end if;
  select * into s from public.subscriptions where id = p_sub for update;
  if not found then perform public._fail('not_found', 'Subscription not found.'); end if;
  if s.user_id <> auth.uid() and not public.has_perm('subscriptions') then
    perform public._fail('not_found', 'Subscription not found.');   -- do not reveal existence
  end if;
  return s;
end $$;

create or replace function public.skip_subscription_day(p_sub uuid, p_date date) returns jsonb
  language plpgsql volatile security definer set search_path = public as $fn$
declare s public.subscriptions%rowtype; v_staff boolean; v_rows integer; v_end date;
begin
  s := public._sub_lock(p_sub);
  v_staff := s.user_id <> auth.uid();
  if p_date is null then perform public._fail('invalid_date', 'Choose a date.'); end if;
  if s.status not in ('active', 'paused') then
    perform public._fail('invalid_state', 'Only a running plan can be changed.');
  end if;
  if p_date < s.start_date or p_date > s.end_date then
    perform public._fail('out_of_range', 'That date is outside your plan.');
  end if;
  if not (public._dow(p_date) = any (s.delivery_days)) then
    perform public._fail('not_a_delivery_day', 'You do not receive a delivery on that day.');
  end if;
  if (v_staff and p_date < public._ist_today()) or (not v_staff and not public._can_change(p_date)) then
    perform public._fail('cutoff_passed',
      'Changes for that day closed at ' || to_char(public._cutoff(), 'HH24:MI') || ' IST the day before.');
  end if;

  insert into public.subscription_skips (subscription_id, skip_date, created_by, kind)
  values (s.id, p_date, auth.uid(), 'skip')
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return jsonb_build_object('ok', true, 'already', true, 'subscription_id', s.id, 'skipped_date', p_date, 'end_date', s.end_date);
  end if;

  perform set_config('app.status_note', 'skipped by ' || case when v_staff then 'staff' else 'customer' end, true);
  update public.orders set status = 'cancelled', failure_reason = 'skipped'
   where subscription_id = s.id and delivery_date = p_date and status in ('placed', 'confirmed', 'preparing');
  perform set_config('app.status_note', '', true);

  v_end := public._recompute_sub(s.id);
  perform public._audit('skip', 'subscriptions', s.id::text, jsonb_build_object('date', p_date, 'new_end_date', v_end));
  perform public._notify_user(s.user_id, 'subscription_skipped', 'Delivery skipped',
    'We will not deliver on ' || to_char(p_date, 'DD Mon') || '. Your plan now ends on ' || to_char(v_end, 'DD Mon YYYY') || '.',
    jsonb_build_object('subscription_id', s.id, 'skipped_date', p_date, 'end_date', v_end),
    'subscription_skipped:' || s.id || ':' || p_date);
  return jsonb_build_object('ok', true, 'subscription_id', s.id, 'skipped_date', p_date, 'end_date', v_end);
end $fn$;

create or replace function public.unskip_subscription_day(p_sub uuid, p_date date) returns jsonb
  language plpgsql volatile security definer set search_path = public as $fn$
declare s public.subscriptions%rowtype; v_staff boolean; v_rows integer; v_end date;
begin
  s := public._sub_lock(p_sub);
  v_staff := s.user_id <> auth.uid();
  if p_date is null then perform public._fail('invalid_date', 'Choose a date.'); end if;
  if s.status not in ('active', 'paused') then
    perform public._fail('invalid_state', 'Only a running plan can be changed.');
  end if;
  if (v_staff and p_date < public._ist_today()) or (not v_staff and not public._can_change(p_date)) then
    perform public._fail('cutoff_passed',
      'Changes for that day closed at ' || to_char(public._cutoff(), 'HH24:MI') || ' IST the day before.');
  end if;
  delete from public.subscription_skips where subscription_id = s.id and skip_date = p_date and kind = 'skip';
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    perform public._fail('not_skipped', 'That day is not skipped (pause days are cleared by resuming).');
  end if;
  update public.orders set status = 'confirmed', failure_reason = null
   where subscription_id = s.id and delivery_date = p_date and status = 'cancelled' and failure_reason = 'skipped';
  v_end := public._recompute_sub(s.id);
  perform public._audit('unskip', 'subscriptions', s.id::text, jsonb_build_object('date', p_date, 'new_end_date', v_end));
  return jsonb_build_object('ok', true, 'subscription_id', s.id, 'date', p_date, 'end_date', v_end);
end $fn$;

create or replace function public.pause_subscription(p_sub uuid, p_from date, p_to date) returns jsonb
  language plpgsql volatile security definer set search_path = public as $fn$
declare s public.subscriptions%rowtype; v_staff boolean; v_end date; v_days integer;
begin
  s := public._sub_lock(p_sub);
  v_staff := s.user_id <> auth.uid();
  if p_from is null or p_to is null or p_to < p_from then
    perform public._fail('invalid_date', 'Choose a valid pause window.');
  end if;
  if p_to - p_from > 60 then perform public._fail('invalid_date', 'A pause can last at most 60 days.'); end if;
  if s.status <> 'active' then
    perform public._fail('invalid_state', 'Only an active plan can be paused.');
  end if;
  if (v_staff and p_from < public._ist_today()) or (not v_staff and not public._can_change(p_from)) then
    perform public._fail('cutoff_passed',
      'A pause must start from ' || to_char(public._first_changeable_date(), 'DD Mon') || ' or later.');
  end if;

  insert into public.subscription_skips (subscription_id, skip_date, created_by, kind)
  select s.id, g::date, auth.uid(), 'pause'
    from generate_series(p_from, p_to, interval '1 day') g
   where public._dow(g::date) = any (s.delivery_days)
  on conflict do nothing;

  perform set_config('app.status_note', 'paused', true);
  update public.orders set status = 'cancelled', failure_reason = 'paused'
   where subscription_id = s.id and delivery_date between p_from and p_to
     and status in ('placed', 'confirmed', 'preparing');
  perform set_config('app.status_note', '', true);

  update public.subscriptions set status = 'paused', paused_from = p_from, paused_to = p_to where id = s.id;
  v_end := public._recompute_sub(s.id);
  perform public._audit('pause', 'subscriptions', s.id::text, jsonb_build_object('from', p_from, 'to', p_to, 'new_end_date', v_end));
  perform public._notify_user(s.user_id, 'subscription_paused', 'Plan paused',
    'Deliveries are paused from ' || to_char(p_from, 'DD Mon') || ' to ' || to_char(p_to, 'DD Mon') ||
    '. Your plan now ends on ' || to_char(v_end, 'DD Mon YYYY') || '.',
    jsonb_build_object('subscription_id', s.id, 'paused_from', p_from, 'paused_to', p_to, 'end_date', v_end),
    'subscription_paused:' || s.id || ':' || p_from);
  return jsonb_build_object('ok', true, 'subscription_id', s.id, 'paused_from', p_from, 'paused_to', p_to, 'end_date', v_end);
end $fn$;

create or replace function public.resume_subscription(p_sub uuid) returns jsonb
  language plpgsql volatile security definer set search_path = public as $fn$
declare s public.subscriptions%rowtype; v_staff boolean; v_from date; v_end date;
begin
  s := public._sub_lock(p_sub);
  v_staff := s.user_id <> auth.uid();
  if s.status <> 'paused' then perform public._fail('invalid_state', 'This plan is not paused.'); end if;
  v_from := case when v_staff then public._ist_today() + 1 else public._first_changeable_date() end;

  delete from public.subscription_skips where subscription_id = s.id and kind = 'pause' and skip_date >= v_from;
  update public.orders set status = 'confirmed', failure_reason = null
   where subscription_id = s.id and delivery_date >= v_from and status = 'cancelled' and failure_reason = 'paused';
  update public.subscriptions set status = 'active', paused_from = null, paused_to = null where id = s.id;
  v_end := public._recompute_sub(s.id);
  perform public._audit('resume', 'subscriptions', s.id::text, jsonb_build_object('from', v_from, 'new_end_date', v_end));
  perform public._notify_user(s.user_id, 'subscription_resumed', 'Plan resumed',
    'Deliveries resume from ' || to_char(v_from, 'DD Mon') || '. Your plan ends on ' || to_char(v_end, 'DD Mon YYYY') || '.',
    jsonb_build_object('subscription_id', s.id, 'resume_from', v_from, 'end_date', v_end),
    'subscription_resumed:' || s.id || ':' || v_from);
  return jsonb_build_object('ok', true, 'subscription_id', s.id, 'resume_from', v_from, 'end_date', v_end);
end $fn$;

create or replace function public.cancel_subscription(p_sub uuid, p_reason text) returns jsonb
  language plpgsql volatile security definer set search_path = public as $fn$
declare s public.subscriptions%rowtype; v_staff boolean; v_from date; v_remaining integer;
begin
  s := public._sub_lock(p_sub);
  v_staff := s.user_id <> auth.uid();
  if s.status not in ('pending_payment', 'active', 'paused', 'on_hold') then
    perform public._fail('invalid_state', 'This plan cannot be cancelled.');
  end if;
  v_from := case when v_staff then public._ist_today() + 1 else public._first_changeable_date() end;

  select count(*)::integer into v_remaining
    from generate_series(greatest(v_from, s.start_date), s.end_date, interval '1 day') g
   where public._dow(g::date) = any (s.delivery_days)
     and not exists (select 1 from public.subscription_skips k where k.subscription_id = s.id and k.skip_date = g::date);

  perform set_config('app.status_note', 'subscription cancelled', true);
  update public.orders set status = 'cancelled', failure_reason = 'subscription_cancelled'
   where subscription_id = s.id and delivery_date >= v_from and status in ('placed', 'confirmed');
  perform set_config('app.status_note', '', true);

  update public.subscriptions
     set status = 'cancelled', cancelled_at = now(), cancel_reason = left(nullif(btrim(coalesce(p_reason, '')), ''), 300),
         paused_from = null, paused_to = null
   where id = s.id;
  perform public._audit('cancel', 'subscriptions', s.id::text,
    jsonb_build_object('reason', left(p_reason, 300), 'remaining_deliveries', v_remaining, 'effective_from', v_from));
  perform public._notify_user(s.user_id, 'subscription_cancelled', 'Plan cancelled',
    'Your plan has been cancelled. Deliveries stop from ' || to_char(v_from, 'DD Mon') || '.',
    jsonb_build_object('subscription_id', s.id, 'effective_from', v_from, 'remaining_deliveries', v_remaining),
    'subscription_cancelled:' || s.id);
  return jsonb_build_object('ok', true, 'subscription_id', s.id, 'effective_from', v_from,
                            'remaining_deliveries', v_remaining, 'per_day_paise', s.per_day_paise);
end $fn$;
