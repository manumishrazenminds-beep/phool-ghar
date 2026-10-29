# Notifications, scheduler, team accounts, invoices

Everything here runs on free tiers. Nothing sends until the env below is set.

## Flow

1. A DB RPC (or `daily-scheduler`, `team-admin`) calls `enqueue_notification(user, channel, template, to, payload, dedupe)`. One outbox row per channel. `dedupe_key` is unique, so retries and double runs never queue twice.
2. `notify-dispatch` runs every minute (pg_cron -> pg_net). It claims up to 25 rows with `claim_notification_batch` (`UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING`), so parallel runs never take the same row.
3. For each row: check `profiles.notify_prefs` (missing = defaults email/whatsapp on, sms/push off; `staff_invited` email always goes), write one in-app `notifications` row per event (not per channel), then send on the channel.
4. Mark `sent`, `failed` (retry later) or `dead`.

Email carries a Resend `Idempotency-Key` of `outbox-<row id>`, so a crash between sending and marking cannot double-send.

## Templates

Keys are in `supabase/functions/_shared/emailTemplates.ts` (`renderTemplate(key, payload, ctx)` returns email subject/html/text, WhatsApp text, in-app title/body).

| key | when | payload fields used |
|---|---|---|
| order_placed | checkout created | name, order_no, order_id, amount_paise, delivery_date, slot_label |
| payment_success | payment captured | same |
| payment_failed | payment failed | same + reason |
| order_confirmed | status confirmed | same |
| order_preparing | status preparing | same |
| order_out_for_delivery | status out_for_delivery | same + delivery_person |
| order_delivered | status delivered | same |
| order_cancelled | cancel | same + reason |
| refund_processed | refund done | amount_paise, order_no, order_id |
| subscription_started | plan active | product_name, plan_days, start_date, end_date, slot_label |
| delivery_reminder | evening before (scheduler) | product_name, delivery_date, slot_label, order_id |
| subscription_skipped | skip | product_name, skip_date, end_date |
| subscription_paused | pause | product_name, paused_from, paused_to |
| subscription_resumed | resume | product_name |
| subscription_cancelled | cancel | product_name, reason |
| plan_ending_soon | scheduler, end within 3 days | product_name, end_date, renew_url |
| plan_renewal_link | manual | product_name, renew_url |
| welcome | signup | name |
| staff_invited | team-admin | name, role, invite_url, invited_by, reset (true = password reset wording) |

`name` falls back to the first word of `profiles.full_name`. All payload text is HTML-escaped. Extra payload key `event_key` groups channels of one event into one in-app notification.

## Channels

* **email**: Resend over fetch (3 quick in-call retries on network/429/5xx).
* **whatsapp**: Cloud API only when `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_ID` are set. Otherwise the row is marked `sent` with `last_error = skipped:whatsapp_cloud_not_configured` and `payload.wa_link` / `payload.wa_text` are stored on the row. An admin tool can show these as a click-to-chat button (free tier, a human taps send). `buildWaLink(phone, text)` in `_shared/whatsapp.ts` builds `https://wa.me/<91...>?text=...`.
* **sms**: stub. With `SMS_ENABLED` unset the row is skipped. If set to `true` with no provider it fails permanently (DLT registration is paid and not wired).
* **push**: not implemented; skipped.

## Retry policy

`attempts` is incremented when a row is claimed. A retryable failure sets `status = failed` and `next_attempt_at = now + 30s * 2^(attempt-1)` (30s, 1m, 2m, 4m, 8m, capped at 1h, +/-20% jitter). After the 6th attempt, or on a permanent error (bad address, unknown template, rejected by provider with 4xx), the row becomes `dead`. A claimed row has a 5 minute lease (`next_attempt_at`); if the worker crashes the row is reclaimed after the lease, and dead-lettered if it already used 6 attempts. Check `status in ('failed','dead')` and `last_error` to debug. Batch failures are also written to `app_logs`.

## Scheduler

`daily-scheduler` (21:00 IST) calls `generate_subscription_orders(tomorrow IST)`, then enqueues `delivery_reminder` for tomorrow's subscription deliveries (dedupe `delivery_reminder:<order_id>:<channel>`) and `plan_ending_soon` for active plans ending within 3 days (dedupe `plan_ending_soon:<sub>:<end_date>:<channel>`). Running it twice adds nothing. Returns `{ date, orders_generated, reminders_enqueued, ending_enqueued, errors }`. Note the 21:00 cut-off has passed when the reminder goes out, so its copy points to later deliveries.

## Cron setup

Migration `20261024990000_cron_schedules.sql` creates `invoke_edge_function`, `purge_housekeeping` and the three schedules; it only warns if pg_cron or pg_net is missing. After enabling the extensions (Dashboard > Database > Extensions) re-run it, then set:

```sql
insert into app_settings(key, value) values ('functions_base_url', to_jsonb('https://<ref>.supabase.co/functions/v1'::text))
  on conflict (key) do update set value = excluded.value;
insert into app_settings(key, value) values ('cron_secret', to_jsonb('<CRON_SECRET>'::text))
  on conflict (key) do update set value = excluded.value;
```

Make sure the `cron_secret` key is not exposed by `public_settings` or any anon-readable policy. Deploy the cron-called functions with JWT verification off (`supabase functions deploy notify-dispatch --no-verify-jwt`, same for `daily-scheduler`); they authenticate with `CRON_SECRET` themselves.

`20261024990100_outbox_claim.sql` adds `claim_notification_batch(p_limit, p_lease_seconds)` (service role only).

## Switch on WhatsApp Cloud API later

1. Meta Business account, WhatsApp app, add a number, get the permanent system-user token and the Phone number ID.
2. `supabase secrets set WHATSAPP_TOKEN=... WHATSAPP_PHONE_ID=...`. Plain text messages work only inside a customer-initiated 24h window.
3. For business-initiated messages create approved templates named `pg_<template key>` (for example `pg_order_confirmed`) with a single body variable `{{1}}`, then `supabase secrets set WHATSAPP_USE_TEMPLATES=true WHATSAPP_TEMPLATE_LANG=en`. The rendered WhatsApp text is passed as `{{1}}`.
4. Rows already marked skipped are not re-sent.

## Resend domain setup

1. Create a Resend account, add your domain, add the DNS records (SPF, DKIM, optional DMARC) and wait for verified.
2. Create an API key (sending access only).
3. `supabase secrets set RESEND_API_KEY=... EMAIL_FROM="Phool Ghar <orders@yourdomain.in>" EMAIL_REPLY_TO=support@yourdomain.in`.
Until the domain is verified Resend only sends from `onboarding@resend.dev` to your own address; rows fail with a 403 and retry, then go dead, so verify first.

## team-admin

POST `{ op, ... }`, admin JWT only. Ops: `list`, `create {email, full_name, phone?, role: staff|delivery, permissions[], password?}`, `update {id, full_name?, phone?, role?, permissions?, active?}`, `deactivate {id}`, `reactivate {id}`, `reset_password {id, password?}`. Without a password an invite/reset link (Supabase recovery link) is emailed through the outbox as `staff_invited`; the link sits in the outbox `payload` (service-role only table). Passwords are never returned. Admin accounts are untouchable unless the body has `allow_admin: true`; you cannot change your own role/active, and the last active admin cannot be demoted or deactivated. Deactivation also bans the auth user.

## order-invoice

GET `?order_id=<uuid>`; owner, admin, or staff with `orders`. Supabase serves `text/html` from the default functions domain as `text/plain`, so the frontend should call with `&format=json` and open `data.html` in a Blob URL or iframe. GST: uses `orders.tax_paise` when set, otherwise treats prices as GST-inclusive and derives tax from `app_settings.gst_percent`. CGST+SGST when intra-state, IGST when `app_settings.store_state` and the address `state` are both known and differ. Titled "Tax Invoice" only when `app_settings.gstin` is set.

Optional `app_settings` keys read: `store_name`, `gstin` (or `store_gstin`), `store_address`, `store_state`, `support_whatsapp`, `gst_percent`.

## Env list

| name | used by | notes |
|---|---|---|
| SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | all | injected by Supabase |
| CRON_SECRET | notify-dispatch, daily-scheduler | long random string, same value as `app_settings.cron_secret` |
| SITE_URL | emails, team-admin links | public site origin, no trailing slash |
| ALLOWED_ORIGINS | all | CORS list |
| RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO | email | reply-to optional |
| WHATSAPP_TOKEN, WHATSAPP_PHONE_ID | whatsapp | optional; also WHATSAPP_API_VERSION, WHATSAPP_USE_TEMPLATES, WHATSAPP_TEMPLATE_LANG |
| SMS_ENABLED | sms stub | leave unset |
| STORE_NAME | fallback store name | `app_settings.store_name` wins |
