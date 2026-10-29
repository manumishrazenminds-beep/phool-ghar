# Local end-to-end tests (real Supabase stack, fake Razorpay)

Needs Docker and Node 22. Local-only keys: these are the public Supabase CLI demo keys, and `functions.test.env`
holds fake Razorpay secrets. `RAZORPAY_API_BASE` is honoured only with an `rzp_test_` key and a localhost URL.

```
npx supabase start -x vector,logflare,imgproxy,studio     # applies migrations + seed
node scripts/e2e/fake-razorpay.mjs &                       # fake Razorpay on :9099
npx supabase functions serve --env-file scripts/e2e/functions.test.env &
node scripts/e2e/auth-rls.mjs        # sign-up, role escalation, RLS, grants        (15 checks)
node scripts/e2e/money-path.mjs      # checkout, verify, webhook, idempotency, plans (19 checks)
node scripts/e2e/regressions.mjs     # coupon, addresses, duplicate refund, 202, inbox (9 checks)
npx supabase stop --no-backup
```

The first request to each function is slow (cold start). Warm them with a curl if a run times out.
