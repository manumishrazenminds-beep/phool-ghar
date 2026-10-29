# Admin and delivery app (Builder E)

Routes: `/admin/*` (owner and sub-admins) and `/delivery/*` (delivery staff). Exported from `src/routes.admin.tsx` as
`adminRoutes`. Each element is lazy-loaded, brings its own providers (demo mode, toasts) and renders a fixed full-screen
surface (`z-[100]`), so it sits above the storefront Navbar/Footer even if the integrator does not special-case the path.

## Wiring (integrator)

In `src/App.tsx` add, inside `<Routes>`:

    {adminRoutes.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}

(`import { adminRoutes } from './routes.admin'`). Cleaner option: when `location.pathname` starts with `/admin` or
`/delivery`, return only that `<Routes>` before the storefront shell renders, so Navbar, Footer, Lenis and the grain overlay
are not mounted behind it. The admin root carries `data-lenis-prevent` so Lenis does not hijack its scrolling either way.

## Modes

* Live: `backendConfigured` true. Reads use `supabase.from(...)` under RLS, writes go through the contract RPCs and Edge Functions.
* Not connected: `backendConfigured` false and demo off. Every admin and delivery route shows "Backend not connected" with next steps and a button to turn demo on.
* Demo: toggle stored in `localStorage` (`pg_admin_demo`). `src/admin/demo.ts` answers the same `Api` interface from invented in-memory
  data (about 90 orders across 9 days, 12 subscriptions, 16 customers, team, coupons, outbox). Nothing touches the network.
  An orange bar is always shown, with a role picker (owner, staff, delivery) to preview permission gating. Edits persist until reload.

## Layout

* `src/admin/api.ts`: `Api` interface (`select`, `upsert`, `update`, `remove`, `rpc`, `fn`, `invoice`, `uploadImage`) and `liveApi`.
* `src/admin/demo.ts`: `demoApi`, same interface.
* `src/admin/mode.tsx`, `useProfile.ts`, `useQuery.ts`, `lookups.ts`, `settings.ts`, `format.ts` (rupees, IST dates, CSV, wa.me/tel/maps links, readable Postgres errors).
* `src/admin/ui/`: Button, Table, Drawer, StatCard, StatusBadge, EmptyState, ConfirmDialog, Field (TextField, SelectField, TextArea, Toggle, SearchBox), Toolbar, Page (PageHeader, Panel, ErrorBanner, Skeleton, Tabs), Toast.
* `src/admin/pages/*`: one file per module. `OrderDrawer.tsx` is shared by Dashboard, Orders and Customers.
* `src/delivery/`: `DeliveryApp.tsx` and `queue.ts` (offline retry queue).

## Role gating

`profiles.role` and `profiles.permissions` drive the sidebar and each route. admin: everything. staff: sections whose permission they hold
(Dashboard is open to all staff). Team is admin only. delivery: redirected to `/delivery`. customer or missing profile: redirected to `/`.
Inactive accounts see "Account deactivated". Gating in the UI is convenience only; RLS is the real control.

| Section | Permission |
|---|---|
| Today's deliveries, Orders, Notifications | orders |
| Subscriptions | subscriptions |
| Customers | customers |
| Products, Categories, Plans | products |
| Stock | stock |
| Delivery settings, Settings | settings |
| Coupons | coupons |
| Reports | reports |
| Team | admin only |

## Backend names used

Tables read or written: profiles, addresses, orders, order_items, order_events, payments, refunds, subscriptions, subscription_skips,
categories, products, product_variants, product_stock, plan_periods, delivery_zones, delivery_slots, app_settings, coupons, notification_outbox.
RPCs: `set_order_status(p_order,p_status,p_note)`, `assign_order(p_order,p_staff)`, `bulk_assign_orders(p_date,p_slot,p_staff)`,
`todays_delivery_list(p_date)`, `admin_dashboard(p_from,p_to)`, `skip_subscription_day`, `unskip_subscription_day`, `pause_subscription(p_sub,p_from,p_to)`,
`resume_subscription(p_sub)`, `cancel_subscription(p_sub,p_reason)`, `cancel_order(p_order,p_reason)`.
Functions: `team-admin` (`{op: list|create|update|deactivate|reactivate|reset_password}`), `refund-create`
(`{payment_id, amount_paise, reason, idempotency_key}`), `order-invoice` (GET `?order_id=&format=json`, called via `supabase.functions.invoke` with `method: 'GET'` because `callFn` is POST only).
Storage: public bucket `product-images`, objects under `products/`.

## Assumptions to confirm against the database migrations

* `todays_delivery_list` columns: `order_id, order_no, kind, slot_id, status, payment_status, assigned_to, assigned_name, recipient_name, recipient_phone, line1, line2, landmark, city, area, pincode, instructions, gift_note, items_summary, total_paise`.
  The reader also accepts an embedded `address` jsonb and `id` for `order_id`; unknown columns are ignored.
* `admin_dashboard` keys: `orders_today, orders_tomorrow, revenue_paise, active_subscriptions, paused_subscriptions, deliveries_by_slot` (array of `{slot_id,count}` or an object). Failed payments and failed deliveries are queried directly.
* Coupon `value` is a whole percent for `percent` and paise for `flat`.
* Notification retry is a direct `update` of `notification_outbox` (status `queued`, `next_attempt_at` now) and needs a staff UPDATE policy on that table.
* Delivery staff need SELECT on `orders` (assigned to them) and, for the item list, `order_items`; the item list degrades silently if RLS blocks it.
* Plan period `days`, slot `id` and zone `pincode` are primary keys and are not editable after creation.

## Delivery app

Mobile first. Stops for today assigned to the signed-in user, grouped by slot. Per stop: address, landmark, instructions, items, Call, WhatsApp,
Maps (Google Maps search URL), and Out for delivery, Delivered, Failed (with a reason list). Updates are optimistic and stored in
`localStorage` key `pg_delivery_queue_v1` first; the queue flushes in order, retries on reconnect and every 20 s, and keeps entries on network
errors. A server rejection removes the entry, shows the message and reloads the real state. Refresh button in the bottom bar.

## Print and export

Today's deliveries has CSV export and a print stylesheet (browser Print): sidebar, filters and buttons are hidden, riders printed as text. Orders and Reports also export CSV.

## Known limits

* Customers and the customer name lookup load up to 2000 profiles; add server-side search if the base grows beyond that.
* Reports aggregate in the browser over at most 5000 rows per query.
* The team-admin function never returns passwords; invite and reset go by email link through the outbox, or an owner-typed password.
* No realtime; screens refresh on action or via Retry/Refresh.
