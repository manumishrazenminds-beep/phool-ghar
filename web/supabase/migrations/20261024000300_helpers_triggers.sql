-- Phool Ghar: role helpers, triggers (profiles bootstrap, privilege lockdown, order events, audit).
-- Safe to re-run.

-- ---------------------------------------------------------------- role helpers
-- An inactive account is treated as a plain customer everywhere.
create or replace function public.app_role() returns public.app_role
  language sql stable security definer set search_path = public as $$
  select case when pr.active then pr.role else 'customer'::public.app_role end
  from public.profiles pr where pr.id = auth.uid()
$$;

create or replace function public.has_perm(p text) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((
    select pr.active and (pr.role = 'admin' or (pr.role = 'staff' and p = any (pr.permissions)))
    from public.profiles pr where pr.id = auth.uid()
  ), false)
$$;

create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((
    select pr.active and pr.role in ('admin', 'staff')
    from public.profiles pr where pr.id = auth.uid()
  ), false)
$$;

-- ---------------------------------------------------------------- generic updated_at
create or replace function public.touch_updated_at() returns trigger
  language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','products','app_settings','subscriptions','orders','payments','refunds','support_tickets']
  loop
    execute format('drop trigger if exists trg_touch_updated_at on public.%I', t);
    execute format('create trigger trg_touch_updated_at before update on public.%I
                    for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- auth.users -> profiles
-- Always creates a plain customer. Metadata supplied at signup can never choose a role.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.profiles (id, role, full_name, phone, email)
  values (
    new.id, 'customer',
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), 100), ''),
    nullif(left(btrim(coalesce(new.phone, new.raw_user_meta_data ->> 'phone', '')), 20), ''),
    new.email
  )
  on conflict (id) do nothing;

  -- welcome email; must never break signup
  begin
    if new.email is not null then
      insert into public.notification_outbox (user_id, channel, template, to_address, payload, dedupe_key)
      values (new.id, 'email', 'welcome', new.email,
              jsonb_build_object('full_name', new.raw_user_meta_data ->> 'full_name'), 'welcome:' || new.id)
      on conflict (dedupe_key) do nothing;
    end if;
  exception when others then
    null;
  end;
  return new;
end $$;

create or replace function public.sync_user_contact() returns trigger
  language plpgsql security definer set search_path = public, auth as $$
begin
  update public.profiles
     set email = coalesce(new.email, email),
         phone = coalesce(nullif(new.phone, ''), phone)
   where id = new.id
     and (email is distinct from coalesce(new.email, email)
          or phone is distinct from coalesce(nullif(new.phone, ''), phone));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_contact_changed on auth.users;
create trigger on_auth_user_contact_changed after update of email, phone on auth.users
  for each row execute function public.sync_user_contact();

-- ---------------------------------------------------------------- privilege lockdown
-- Belt and braces on top of column grants: API roles can never alter role/permissions/active/id.
-- Provisioning goes through the service role (team-admin function) or the SQL editor.
create or replace function public.guard_profile_privileged() returns trigger
  language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.permissions is distinct from old.permissions
       or new.active is distinct from old.active
       or new.email is distinct from old.email then
      raise exception 'insufficient_privilege' using errcode = '42501',
        detail = 'role, permissions, active and email are managed by the system';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_profile_privileged on public.profiles;
create trigger trg_guard_profile_privileged before update on public.profiles
  for each row execute function public.guard_profile_privileged();

-- ---------------------------------------------------------------- order events
create or replace function public.log_order_event() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_note text := nullif(current_setting('app.status_note', true), '');
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, status, note, actor_id)
    values (new.id, new.status, v_note, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.order_events (order_id, status, note, actor_id)
    values (new.id, new.status, v_note, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists trg_order_events_ins on public.orders;
create trigger trg_order_events_ins after insert on public.orders
  for each row execute function public.log_order_event();
drop trigger if exists trg_order_events_upd on public.orders;
create trigger trg_order_events_upd after update of status on public.orders
  for each row when (old.status is distinct from new.status)
  execute function public.log_order_event();

-- ---------------------------------------------------------------- audit
create or replace function public.audit_row() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_row jsonb; v_id text; v_detail jsonb;
begin
  v_old := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row := coalesce(v_new, v_old);
  v_id := coalesce(v_row ->> 'id', v_row ->> 'code', v_row ->> 'key', v_row ->> 'pincode', v_row ->> 'days');

  if tg_table_name = 'app_settings' then
    -- values may hold operational secrets; log only the key
    v_detail := jsonb_build_object('key', v_row ->> 'key');
  elsif tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(n.key, jsonb_build_object('old', v_old -> n.key, 'new', n.value)), '{}'::jsonb)
      into v_detail
      from jsonb_each(v_new) n
     where n.key not in ('updated_at') and v_old -> n.key is distinct from n.value;
    if v_detail = '{}'::jsonb then return new; end if;
  elsif tg_op = 'INSERT' then
    v_detail := v_new;
  else
    v_detail := v_old;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), lower(tg_op), tg_table_name, v_id, v_detail);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['products','product_variants','categories','coupons','delivery_zones','delivery_slots','plan_periods','app_settings']
  loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format('create trigger trg_audit after insert or update or delete on public.%I
                    for each row execute function public.audit_row()', t);
  end loop;
end $$;

drop trigger if exists trg_audit on public.profiles;
create trigger trg_audit after update on public.profiles
  for each row when (old.role is distinct from new.role or old.permissions is distinct from new.permissions
                     or old.active is distinct from new.active)
  execute function public.audit_row();
