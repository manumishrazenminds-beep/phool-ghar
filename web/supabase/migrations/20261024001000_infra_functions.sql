-- Phool Ghar: rate limiting, idempotency helpers, notification enqueue, housekeeping. Safe to re-run.

-- Atomic fixed-window limiter. true = allowed, false = limit reached.
create or replace function public.rl_hit(p_key text, p_max integer, p_window_seconds integer) returns boolean
  language plpgsql volatile security definer set search_path = public as $$
declare v_start timestamptz; v_hits integer;
begin
  if p_key is null or btrim(p_key) = '' or char_length(p_key) > 200
     or p_max is null or p_max < 1 or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    perform public._fail('invalid_input', 'rl_hit: bad arguments.');
  end if;
  v_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits as r (key, window_start, hits) values (p_key, v_start, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  return v_hits <= p_max;
end $$;

create or replace function public.idem_get(p_key text) returns jsonb
  language sql stable security definer set search_path = public as $$
  select response from public.idempotency_keys where key = p_key and expires_at > now()
$$;

-- First writer wins; returns the stored response (the caller's own when it won).
create or replace function public.idem_put(p_key text, p_scope text, p_user uuid, p_response jsonb, p_ttl_seconds integer default 604800)
  returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_resp jsonb;
begin
  if p_key is null or char_length(p_key) > 300 then perform public._fail('invalid_input', 'bad idempotency key'); end if;
  insert into public.idempotency_keys (key, scope, user_id, response, expires_at)
  values (p_key, coalesce(p_scope, 'default'), p_user, p_response, now() + make_interval(secs => greatest(coalesce(p_ttl_seconds, 604800), 60)))
  on conflict (key) do update set
    response = case when public.idempotency_keys.expires_at <= now() then excluded.response else public.idempotency_keys.response end,
    expires_at = case when public.idempotency_keys.expires_at <= now() then excluded.expires_at else public.idempotency_keys.expires_at end
  returning response into v_resp;
  return v_resp;
end $$;

create or replace function public.enqueue_notification(
  p_user uuid, p_channel text, p_template text, p_to text, p_payload jsonb, p_dedupe text) returns uuid
  language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_channel is null or p_channel not in ('email', 'whatsapp', 'sms', 'push') then
    perform public._fail('invalid_input', 'channel must be email, whatsapp, sms or push.');
  end if;
  if coalesce(btrim(p_template), '') = '' or coalesce(btrim(p_to), '') = '' then
    perform public._fail('invalid_input', 'template and to are required.');
  end if;
  insert into public.notification_outbox (user_id, channel, template, to_address, payload, dedupe_key)
  values (p_user, p_channel, p_template, p_to, coalesce(p_payload, '{}'::jsonb), p_dedupe)
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  if v_id is null and p_dedupe is not null then
    select id into v_id from public.notification_outbox where dedupe_key = p_dedupe;
  end if;
  return v_id;
end $$;

-- Hourly cleanup, called from the cron migration.
create or replace function public.housekeeping_purge() returns jsonb
  language plpgsql volatile security definer set search_path = public as $$
declare a integer; b integer; c integer; d integer;
begin
  delete from public.idempotency_keys where expires_at < now(); get diagnostics a = row_count;
  delete from public.rate_limits where window_start < now() - interval '1 day'; get diagnostics b = row_count;
  delete from public.app_logs where created_at < now() - interval '30 days'; get diagnostics c = row_count;
  delete from public.notification_outbox where status in ('sent', 'dead') and created_at < now() - interval '60 days';
  get diagnostics d = row_count;
  return jsonb_build_object('idempotency_keys', a, 'rate_limits', b, 'app_logs', c, 'outbox', d);
end $$;
