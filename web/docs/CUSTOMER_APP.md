# Customer app (Builder D)

## Wiring (integrator)
1. `src/main.tsx` or `App.tsx`: wrap the tree (inside `BrowserRouter` and `CartProvider`, above `Navbar`) with `<CustomerProviders>` from `src/routes.customer.tsx`.
2. In `App.tsx` `<Routes>`: `{customerRoutes.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}` before the `*` route.
3. `CartDrawer`: turn the Checkout button into `onClick={() => { setOpen(false); navigate('/checkout') }}` (or a `Link`). Remove the "connected in the next phase" line.
4. `Navbar`: add a user link: `useAuth()` gives `session`, `profile`, `role`; link to `/account` (or `/login`). `useNotifications().unread` gives the bell badge count.

## Modes
- `backendConfigured === false`: every auth, checkout and account page renders the friendly "not connected" panel (`BackendOff`). Catalog helpers return the static data.
- `true`: Supabase auth, RPCs, Edge Functions and realtime are used.

## Routes
`/login /signup /forgot-password /reset-password /checkout /order/success?order=ID|sub=ID /orders/:id /account /account/:tab`
Tabs: `orders subscriptions addresses notifications profile support`. `RequireAuth` redirects to `/login?next=...`; staff roles land on `/admin` or `/delivery` after sign-in.

## Assumptions beyond the contract
- `checkout-create` `lines[]` item: `{ product_slug, variant_key, qty, mode: 'once'|'sub' }`. Cart line product ids are the static ids (`p1`), resolved to a slug, so the server must price by slug.
- One-time lines are paid together; each subscription line is its own payment (checkout-create takes one `subscription`). Body also carries `recipient: { name, phone }`.
- `preview_pricing(p_payload)` receives `{ lines, pincode, slot_id, date, coupon_code }` and should return `{ subtotal_paise, discount_paise, delivery_fee_paise, tax_paise?, total_paise, slots?: [{ id, remaining?, available? }] }`. `slots` drives the "Only N left" hint. If the call fails, local display maths is used.
- `apply_coupon_preview` returns `{ ok, discount_paise, message?, code? }`; `p_kind` is `one_time | subscription`.
- `payment-verify` returns `{ order_id?|subscription_id? }`; envelope `{ data }` is unwrapped, errors use `{ error: { code, message } }`.
- Reads use a `public_settings` view (`key`, `value`) for `cutoff_time`, `free_delivery_for_subscription`, `min_order_paise`, `support_whatsapp`.
- Invoice: `GET /functions/v1/order-invoice?order_id=` with the user JWT and `apikey` header; opened in a new tab via a blob URL.
- Notification `data` may include `order_id` / `subscription_id` for deep links.
- Realtime must be enabled on `notifications`.

## Payment safety
Idempotency key = per-payload UUID in `sessionStorage` (same payload gives the same key). The created Razorpay order is reused when reopening the popup after dismissal or failure. Verify auto-retries on network errors and offers a manual "Check status". A synchronous lock prevents double submit.

## Env
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_DATA_PROVIDER=supabase`, `VITE_RAZORPAY_KEY_ID` (fallback; the key normally comes from checkout-create), `VITE_WHATSAPP_NUMBER`, optional `VITE_PHONE_AUTH_ENABLED=true` (phone OTP, needs paid SMS), `VITE_GOOGLE_AUTH_ENABLED=false` to hide Google. Supabase dashboard: enable Email, Google, and add redirect URLs for `/account` and `/reset-password`.

## Files
`src/lib/{api,catalog,pricing,razorpay,dates,settings,flags}.ts`, `src/lib/ui.tsx`, `src/auth/*`, `src/account/*`, `src/checkout/*`, pages `Login Signup Forgot Reset Checkout OrderSuccess OrderDetail Account`.
