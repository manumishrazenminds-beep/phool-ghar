# Phool Ghar (flower store) setup

Working name "Phool Ghar" is a placeholder brand. Search and replace it once the client confirms a name.

## Run (Mac and Windows)

Requires Node 20 or newer.

```
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## Stack

React 19, Vite, TypeScript, Tailwind CSS v4, motion (Framer Motion), Lenis smooth scroll,
Phosphor icons, Fraunces (display) + Inter (body), optional Spline hero layer.

## Optional Spline 3D hero

1. Build or remix a scene in spline.design.
2. Export, Code, React, copy the scene URL.
3. Put it in `.env.local` as `VITE_SPLINE_SCENE=<url>`.

The hero renders a CSS/motion version when it is unset. The Spline runtime is code-split.

## Photos

Unsplash photos (free licence), already resized to `public/img/`. Originals are in `_raw-images/`
(git-ignored). Swap in client photography before launch.

## Status

Every PRD web feature is built except SMS (paid DLT, left as a stub). Customer site, account, checkout, admin and
delivery apps are code complete; the backend runs once Supabase and Razorpay are configured (see `docs/`).

Added last: add-ons, favourites, reviews (with admin moderation), price/availability filters, change-schedule and
renew for daily plans, redelivery requests, help centre and policy pages, web push, and nightly backups.

Extra setup for the last items:
- Apply `supabase/migrations/20261024001300_engagement_features.sql` (after the earlier ones) and re-run `supabase/seed.sql`.
- Web push (optional): `npx web-push generate-vapid-keys`; put the public key in `VITE_VAPID_PUBLIC_KEY`, and set
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` with `supabase secrets set`. Without them the option is hidden.
- Backups: add the repo secret `SUPABASE_DB_URL` (keep the repo private). `.github/workflows/db-backup.yml` runs nightly;
  `web/ops/backup.sh` does the same by hand.
- Policies in `src/pages/Policy.tsx` and the help answers in `src/pages/Help.tsx` are drafts: have the business review them.
- Add-on photos reuse flower images: replace them with real card, vase, sweets and candle photos.
