-- Phool Ghar: favourites, web push subscriptions, subscription schedule change, redelivery request.
-- Safe to re-run.

-- ---------------------------------------------------------------- favourites
create table if not exists public.wishlist (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.wishlist enable row level security;
drop policy if exists wishlist_own on public.wishlist;
create policy wishlist_own on public.wishlist for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.wishlist to authenticated;

-- ---------------------------------------------------------------- web push
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.push_subscriptions to authenticated;

-- ---------------------------------------------------------------- reviews: one rating summary per product
create or replace view public.product_ratings with (security_invoker = true) as
  select product_id, round(avg(rating)::numeric, 1) as avg_rating, count(*)::int as review_count
    from public.reviews where approved group by product_id;
grant select on public.product_ratings to anon, authenticated;

-- ---------------------------------------------------------------- change a running plan (F-32)
-- Applies from the first date still inside the cut-off. Days, slot and address are all optional.
create or replace function public.update_subscription_schedule(
  p_sub uuid, p_days integer[] default null, p_slot text default null, p_address jsonb default null)
  returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare s public.subscriptions%rowtype; v_from date; v_end date; v_days integer[];
begin
  s := public._sub_lock(p_sub);
  if s.status not in ('active', 'paused') then
    perform public._fail('invalid_state', 'Only a running plan can be changed.');
  end if;
  v_from := public._first_changeable_date();
  v_days := coalesce(p_days, s.delivery_days);
  if cardinality(v_days) not between 1 and 7 or not (v_days <@ array[0,1,2,3,4,5,6]) then
    perform public._fail('invalid_days', 'Choose between one and seven delivery days.');
  end if;
  if p_slot is not null and not exists (
       select 1 from public.delivery_slots where id = p_slot and active and subscription_ok) then
    perform public._fail('invalid_slot', 'That time slot is not available for daily plans.');
  end if;
  if p_address is not null and (p_address->>'line1' is null or p_address->>'pincode' is null) then
    perform public._fail('invalid_address', 'The address is incomplete.');
  end if;
  if p_address is not null and not coalesce((select c.ok from public.check_pincode(p_address->>'pincode') c limit 1), false) then
    perform public._fail('not_serviceable', 'We do not deliver to that pincode yet.');
  end if;

  update public.subscriptions
     set delivery_days = v_days,
         slot_id = coalesce(p_slot, slot_id),
         address = coalesce(p_address, address),
         updated_at = now()
   where id = s.id;

  -- upcoming orders that are not yet being prepared follow the new schedule
  update public.orders set slot_id = coalesce(p_slot, slot_id), address = coalesce(p_address, address)
   where subscription_id = s.id and delivery_date >= v_from and status in ('placed', 'confirmed');
  perform set_config('app.status_note', 'schedule changed by customer', true);
  update public.orders set status = 'cancelled', failure_reason = 'schedule_changed'
   where subscription_id = s.id and delivery_date >= v_from and status in ('placed', 'confirmed')
     and not (public._dow(delivery_date) = any (v_days));
  perform set_config('app.status_note', '', true);

  v_end := public._recompute_sub(s.id);
  perform public._audit('schedule_change', 'subscriptions', s.id::text,
    jsonb_build_object('days', v_days, 'slot', p_slot, 'effective_from', v_from, 'new_end_date', v_end));
  return jsonb_build_object('ok', true, 'subscription_id', s.id, 'effective_from', v_from, 'end_date', v_end);
end $fn$;

-- ---------------------------------------------------------------- failed delivery: ask for another attempt (F-40)
create or replace function public.request_redelivery(p_order uuid, p_date date, p_slot text, p_note text default null)
  returns jsonb language plpgsql volatile security definer set search_path = public as $fn$
declare o public.orders%rowtype; v_ticket uuid;
begin
  if auth.uid() is null then perform public._fail('not_authenticated', 'Sign in first.', '42501'); end if;
  select * into o from public.orders where id = p_order and user_id = auth.uid();
  if not found then perform public._fail('not_found', 'Order not found.'); end if;
  if o.status <> 'failed' then
    perform public._fail('invalid_state', 'Only a delivery that did not reach you can be re-attempted.');
  end if;
  if not public._can_change(p_date) then
    perform public._fail('cutoff_passed', 'Choose a date from ' || to_char(public._first_changeable_date(), 'DD Mon') || ' onwards.');
  end if;
  if not exists (select 1 from public.delivery_slots where id = p_slot and active) then
    perform public._fail('invalid_slot', 'Choose a time slot.');
  end if;
  insert into public.support_tickets (user_id, order_id, subject, message)
  values (auth.uid(), o.id, 'Redelivery request',
          'Please re-attempt delivery on ' || to_char(p_date, 'DD Mon YYYY') || ' in slot ' || p_slot ||
          coalesce('. Note: ' || nullif(btrim(p_note), ''), '.'))
  returning id into v_ticket;
  insert into public.order_events (order_id, status, note)
  values (o.id, o.status, 'Redelivery requested for ' || to_char(p_date, 'DD Mon') || ' (' || p_slot || ')');
  return jsonb_build_object('ok', true, 'ticket_id', v_ticket);
end $fn$;

grant execute on function public.update_subscription_schedule(uuid, integer[], text, jsonb) to authenticated;
grant execute on function public.request_redelivery(uuid, date, text, text) to authenticated;

-- ---------------------------------------------------------------- public review feed (first name only)
create or replace view public.public_reviews as
  select r.id, r.product_id, r.rating, r.body, r.created_at,
         coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'A customer') as reviewer
    from public.reviews r join public.profiles p on p.id = r.user_id
   where r.approved;
grant select on public.public_reviews to anon, authenticated;
