# Payments and platform reliability

Edge Functions: `checkout-create`, `payment-verify`, `razorpay-webhook`, `refund-create`, `health`.
Shared code: `supabase/functions/_shared/`. Money is integer paise everywhere.

## Flow

1. Browser calls `checkout-create` with a client-generated `idempotency_key`.
   The function authenticates the JWT, rate-limits, validates the body, claims the idempotency key,
   calls `create_checkout` (prices come from the database, never the client), creates the Razorpay order,
   inserts `payments(status='created')` and returns the Razorpay Checkout options.
2. Razorpay Checkout runs in the browser. On success the browser calls `payment-verify`.
3. Razorpay independently posts `payment.captured` (and others) to `razorpay-webhook`.
4. Both paths end in `mark_payment_captured`, which is idempotent in SQL, so whichever lands first wins and the
   other is a no-op.

## Hard cases and how they are handled

| Case | Handling |
|---|---|
| Double click / network retry on checkout | `idempotency_keys` claim (60 s lease, 24 h replay). Same key returns the stored response with `Idempotent-Replay: true`. A concurrent duplicate gets 409 `request_in_progress` + `Retry-After: 2`. `create_checkout` is also idempotent on `p_idem`, and an existing `created` payment row for the order is reused, so no second Razorpay order. A failed attempt releases the key so a retry works. |
| Webhook before client verify | Both call `mark_payment_captured`. `payment-verify` returns success (`already: true`) when the row is already captured. |
| Webhook replay | `webhook_events.id` (Razorpay `X-Razorpay-Event-Id`, or a body hash fallback) is the primary key. Duplicate and already processed returns 200 `duplicate`. A duplicate whose first run crashed is processed again. |
| `payment.failed` after `payment.captured` | Never downgrades: failed events for a captured or refunded payment are ignored and logged. The reverse (failed, then a successful retry on the same Razorpay order) works because `mark_payment_captured` accepts a failed row. |
| Amount or currency mismatch | `amountMatches` compares our `payments` row with Razorpay. On mismatch: no capture, `app_logs` error `amount_mismatch`, `payment-verify` returns 409, webhook records the event with error and returns 200 (retrying cannot fix it). Check `app_logs` for this code. |
| Razorpay outage | `withRetry`: 8 s timeout per attempt, up to 3 retries, exponential backoff with full jitter, honours `Retry-After`. After that, or when the in-memory circuit breaker is open (5 consecutive failures, 30 s cooldown), the client gets 503 `payment_provider_unavailable` with `Retry-After`. `payment-verify` continues on the HMAC alone if only the confirmation fetch is down. |
| Oversized or malformed bodies | Content-Length check plus streaming byte cap (16 KB checkout, 4 KB verify/refund, 512 KB webhook), JSON and content-type checks, hand-written field validation. |
| Abuse | `rl_hit` per user and per IP (checkout 10/min user, 30/min IP; verify 20 and 60; refund 10 and 30; webhook 600/min IP). The limiter fails open if it errors, because blocking paying customers is worse than briefly missing a limit. |
| Orphan Razorpay order (payment row insert failed) | Capture events for an unknown order are retried (HTTP 500) for 15 minutes, then logged `webhook_unknown_order` and acknowledged. |
| Transient DB error in webhook | Responds 500 and keeps the row unprocessed; Razorpay retries for about 24 hours. This is a deliberate deviation from "always 200 once persisted", because 200 would lose the event. Permanent conditions (unknown order after grace, amount mismatch, ignored types) return 200. |

Signatures: checkout = `HMAC_SHA256(order_id|payment_id, key_secret)`; webhook = `HMAC_SHA256(raw body, webhook_secret)`.
Both use WebCrypto and a constant-time compare. The webhook hashes the raw text, never re-serialised JSON.

## Load handling on the free tier

* **Idempotent endpoints**: every retry (user, browser, Razorpay, our own retry) is safe, so retries cost one cheap
  lookup rather than duplicate work or duplicate rows.
* **Outbox queueing**: functions never send email or WhatsApp inline. They call `enqueue_notification` (dedupe key
  per event) and `notify-dispatch` drains `notification_outbox` in small batches every minute. A traffic spike makes
  the queue longer, not the payment path slower. Notification failures never fail a payment.
* **Rate limits**: fixed-window counters in Postgres (`rl_hit`), keyed per user and per IP, shed abusive load before
  any Razorpay call or heavy RPC. The hourly cron purges old rows.
* **Retries with jitter**: full-jitter backoff avoids synchronised retry storms; the circuit breaker stops
  hammering Razorpay (and burning invocations) while it is down.
* **Small invocations**: no polling inside functions, one RPC per business step, `health` is cached for 5 s.
* **Connection pooling**: the functions use supabase-js, which talks to PostgREST over HTTP, so they do not hold
  Postgres connections. Anything that connects with raw SQL (migrations tooling, a future worker, reporting scripts)
  should use the Supavisor **transaction mode** string (port 6543, `?pgbouncer=true`-style prepared-statement off),
  and keep `max` pool size small (3 to 5). Use the direct or session-mode string only for migrations.
* **Capacity guardrails**: the free tier has limited function invocations, DB egress and a small Postgres. Watch the
  items below and move to the Pro plan before a campaign, not during it.

### What to monitor

* `app_logs` where `level in ('warn','error')`: codes `amount_mismatch`, `bad_signature`, `webhook_bad_signature`,
  `webhook_unknown_order`, `webhook_handler_failed`, `razorpay_order_rejected`, `mark_refund_failed`,
  `verify_signature_only`, `ratelimit_error`.
* `webhook_events` where `processed_at is null and received_at < now() - interval '10 minutes'` (stuck events) and
  rows with `error` set.
* `payments` stuck in `created` for more than 30 minutes (abandoned checkouts) or `authorized` (auto-capture off?).
* `notification_outbox` rows in `failed` or `dead`, and queued rows with `next_attempt_at` in the past.
* `rate_limits` top keys (abuse), Supabase dashboard function error rate and p95 latency, DB size and egress.
* Uptime monitor on `GET /functions/v1/health` (returns 503 with `db:false` when the database is unreachable).

## Razorpay dashboard setup (later, when you have an account)

1. Create the account, complete KYC, then use **Test Mode** first (toggle top of the dashboard).
2. Dashboard > Account & Settings > API Keys > Generate Test Key. Save the Key Id and Key Secret.
3. Payments settings: keep **auto-capture** on (Settings > Payment Capture). The code expects captured payments;
   `authorized` payments are answered with 202 `processing` until captured.
4. Webhook: Settings > Webhooks > Add New Webhook.
   * URL: `https://<project-ref>.supabase.co/functions/v1/razorpay-webhook`
   * Secret: a long random string you generate; the same value goes into `RAZORPAY_WEBHOOK_SECRET`.
   * Active events: `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`.
     (`payment.authorized` is optional and ignored.)
5. Deploy the webhook function without JWT verification, because Razorpay cannot send a Supabase JWT:
   `supabase functions deploy razorpay-webhook --no-verify-jwt`. Authentication is the signature check.
   Deploy `health` with `--no-verify-jwt` too. The other three keep JWT verification on (they also verify it themselves).
6. Set secrets (below), then send a test webhook from the dashboard and confirm a row in `webhook_events`.
7. For live: repeat with Live keys, update the three secrets, create a second webhook for live mode, and re-run one
   small real payment and refund.

## Test mode values

* Cards (any future expiry, any CVV, any name; OTP/3DS page: click Success):
  * Mastercard `5267 3181 8797 5449`, Visa `4111 1111 1111 1111` (success)
  * Failure test: use the checkout "Fail" button on the bank page, or an international card test number from the
    Razorpay docs for the failure scenario you need.
* UPI: `success@razorpay` (succeeds), `failure@razorpay` (fails).
* Netbanking: pick any bank, then choose Success or Failure on the mock page.
* Wallet: pick any wallet, then Success or Failure.
* Refunds in test mode complete immediately or within minutes; `refund.processed` should arrive at the webhook.

Test values change occasionally; treat the Razorpay docs ("Test Card Details", "Test UPI details") as authoritative.

Local webhook testing: `supabase functions serve --no-verify-jwt --env-file <your local env file>` and a tunnel such
as `cloudflared tunnel --url http://localhost:54321`, then point a test-mode webhook at the tunnel URL.

## Env and secrets

Injected automatically on hosted Edge Functions: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Set with `supabase secrets set NAME=value`:

| Name | Needed by | Notes |
|---|---|---|
| `RAZORPAY_KEY_ID` | checkout-create, payment-verify, refund-create | public key id, returned to the browser |
| `RAZORPAY_KEY_SECRET` | same | never sent to the browser |
| `RAZORPAY_WEBHOOK_SECRET` | razorpay-webhook | must equal the secret typed in the dashboard |
| `ALLOWED_ORIGINS` | all | comma separated, e.g. `https://phoolghar.com,https://*.phoolghar.pages.dev`. If unset, only localhost dev origins are allowed |
| `STORE_NAME` | checkout-create | optional, default `Phool Ghar` (shown in Razorpay Checkout) |
| `LOG_LEVEL` | all | optional: `debug`, `info` (default), `warn`, `error`. Only warn and above are written to `app_logs` |

Every variable is read lazily. With nothing configured the functions still boot; `health` answers
`{ ok:false, db:false }` and business endpoints answer 503 `not_configured`.

## Contract assumptions worth confirming with the database owner

* `rl_hit` returns `true` when the request is allowed and `false` when the limit is exceeded.
* `create_checkout` reports business errors (bad pincode, stock, coupon) as SQLSTATE `P0001` (or class 22/23); these
  become HTTP 422 `checkout_rejected` with the message text. Anything else becomes 503.
* `mark_payment_captured` accepts a payment in `failed` state (retry inside the same Razorpay order) and is a no-op
  when already captured. `mark_refund` is idempotent on `p_provider_refund_id`.
* `payments.created_at` exists (used to pick the newest `created` row when reusing an order).
* `idempotency_keys.response` is nullable (used as the in-flight lease marker).
