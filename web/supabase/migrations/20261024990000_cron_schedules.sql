-- Cron schedules (Builder C). Safe on a project where pg_cron / pg_net are not enabled yet and when
-- app_settings has no functions_base_url / cron_secret: every step is guarded and the callers no-op.
--
--   daily-scheduler : 21:00 IST (15:30 UTC) every day
--   notify-dispatch : every minute
--   housekeeping    : hourly purge of idempotency_keys, rate_limits, app_logs
--
-- Configure later (SQL editor, service role):
--   insert into app_settings(key, value) values ('functions_base_url', to_jsonb('https://<ref>.supabase.co/functions/v1'::text))
--     on conflict (key) do update set value = excluded.value;
--   insert into app_settings(key, value) values ('cron_secret', to_jsonb('<same value as the CRON_SECRET function secret>'::text))
--     on conflict (key) do update set value = excluded.value;
-- app_settings must not be publicly readable for cron_secret: the public_settings view whitelists keys, so it is not exposed.
-- Re-running this file is safe (schedules are upserted by name).

-- 1) Try to enable the extensions; ignore failure (e.g. not permitted on this plan yet).
do $$ begin
  begin create extension if not exists pg_cron; exception when others then raise notice 'pg_cron not enabled: %', sqlerrm; end;
  begin create extension if not exists pg_net with schema extensions; exception when others then raise notice 'pg_net not enabled: %', sqlerrm; end;
end $$;

-- 2) Caller: POSTs to <functions_base_url>/<name> with the cron secret. No-op when unset or pg_net missing.
create or replace function public.invoke_edge_function(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base   text;
  v_secret text;
begin
  if p_name !~ '^[a-z0-9-]{1,64}$' then
    raise exception 'invalid function name';
  end if;
  if to_regclass('public.app_settings') is null then return; end if;
  select value #>> '{}' into v_base   from public.app_settings where key = 'functions_base_url';
  select value #>> '{}' into v_secret from public.app_settings where key = 'cron_secret';
  if coalesce(v_base, '') = '' or coalesce(v_secret, '') = '' then return; end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise notice 'pg_net not available; skipping call to %', p_name;
    return;
  end if;
  execute 'select net.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := $4)'
    using rtrim(v_base, '/') || '/' || p_name,
          jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
          '{}'::jsonb,
          20000;
exception when others then
  raise notice 'invoke_edge_function(%) failed: %', p_name, sqlerrm;
end $$;

-- 3) Hourly housekeeping; each table is optional.
create or replace function public.purge_housekeeping()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.idempotency_keys') is not null then
    delete from public.idempotency_keys where expires_at < now();
  end if;
  if to_regclass('public.rate_limits') is not null then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  if to_regclass('public.app_logs') is not null then
    delete from public.app_logs where created_at < now() - interval '30 days';
  end if;
  if to_regclass('public.notification_outbox') is not null then
    delete from public.notification_outbox where status in ('sent', 'dead') and created_at < now() - interval '60 days';
  end if;
exception when others then
  raise notice 'purge_housekeeping failed: %', sqlerrm;
end $$;

revoke all on function public.invoke_edge_function(text) from public, anon, authenticated;
revoke all on function public.purge_housekeeping() from public, anon, authenticated;
grant execute on function public.invoke_edge_function(text) to service_role;
grant execute on function public.purge_housekeeping() to service_role;

-- 4) Schedules (upsert by job name). Skipped entirely if pg_cron is not enabled.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron is not enabled; schedules were not created. Enable it (Database > Extensions) and re-run this migration.';
    return;
  end if;
  execute $c$select cron.schedule('phoolghar-daily-scheduler', '30 15 * * *', $j$select public.invoke_edge_function('daily-scheduler')$j$)$c$;
  execute $c$select cron.schedule('phoolghar-notify-dispatch', '* * * * *', $j$select public.invoke_edge_function('notify-dispatch')$j$)$c$;
  execute $c$select cron.schedule('phoolghar-housekeeping', '7 * * * *', $j$select public.purge_housekeeping()$j$)$c$;
  -- release stock held by unpaid orders (function from the checkout migrations)
  execute $c$select cron.schedule('phoolghar-expire-stale-orders', '*/15 * * * *', $j$select public.expire_stale_orders(30)$j$)$c$;
exception when others then
  raise notice 'could not create cron schedules: %', sqlerrm;
end $$;
