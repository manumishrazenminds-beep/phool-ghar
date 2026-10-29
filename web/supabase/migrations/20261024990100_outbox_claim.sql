-- Atomic claim of notification_outbox rows for notify-dispatch (Builder C). Idempotent: safe to re-run.
-- A claimed row becomes status='sending' with next_attempt_at = lease expiry, so a crashed worker's rows
-- are reclaimed automatically once the lease passes. attempts is incremented at claim time.
-- Rows whose lease expired after the 6th attempt are dead-lettered instead of retried.

do $migration$
begin
  if to_regclass('public.notification_outbox') is null then
    raise notice 'notification_outbox not found; skipping claim_notification_batch (apply the schema migrations first)';
    return;
  end if;

  execute $fn$
    create or replace function public.claim_notification_batch(p_limit int default 25, p_lease_seconds int default 300)
    returns setof public.notification_outbox
    language plpgsql
    security definer
    set search_path = public
    as $body$
    begin
      update public.notification_outbox
         set status = 'dead',
             last_error = coalesce(last_error, 'lease expired after max attempts')
       where status = 'sending'
         and next_attempt_at <= now()
         and attempts >= 6;

      return query
      update public.notification_outbox o
         set status = 'sending',
             attempts = o.attempts + 1,
             next_attempt_at = now() + make_interval(secs => greatest(p_lease_seconds, 30))
       where o.id in (
         select q.id
           from public.notification_outbox q
          where q.status in ('queued', 'failed', 'sending')
            and q.next_attempt_at <= now()
            and q.attempts < 6
          order by q.next_attempt_at, q.created_at
          limit least(greatest(p_limit, 1), 100)
            for update skip locked
       )
      returning o.*;
    end;
    $body$;
  $fn$;

  execute 'revoke all on function public.claim_notification_batch(int, int) from public, anon, authenticated';
  execute 'grant execute on function public.claim_notification_batch(int, int) to service_role';
end
$migration$;
