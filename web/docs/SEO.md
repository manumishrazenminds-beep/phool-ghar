# SEO

## What is in place
- `index.html`: title, description, canonical, robots, Open Graph, Twitter card, manifest, JSON-LD (`Florist` + `WebSite`). `%VITE_SITE_URL%` is filled at build time by `vite.config.ts`.
- `src/lib/seo.ts`: `useSeo()` sets title, description, canonical, social tags and page JSON-LD per route; `applyRobots()` (called in `App.tsx`) marks account, checkout, auth, admin and delivery routes `noindex, nofollow`.
- Structured data: `Product` + `BreadcrumbList` on product pages, `FAQPage` on `/help`. No ratings are published (no fabricated `aggregateRating`).
- `public/robots.txt`, `public/manifest.webmanifest`, and `scripts/seo.mjs` (runs after `vite build`): writes `dist/sitemap.xml` and prerenders `dist/shop`, `dist/help`, `dist/policy/*`, `dist/product/*` with the right head tags, a `noscript` summary and product JSON-LD.

## Before launch
1. Set `VITE_SITE_URL` (for example `https://www.phoolghar.in`) in the build environment. The default is a placeholder.
2. Host so `/product/<slug>` serves `dist/product/<slug>/index.html` (Cloudflare Pages and Netlify do) with `index.html` as the fallback for other routes.
3. Submit `/sitemap.xml` in Google Search Console and Bing Webmaster Tools; claim a Google Business Profile for the Pune and Mumbai service area.
4. Replace the placeholder address, add a real logo/OG image (1200x630), and replace the Unsplash photos with your own.

## Honest limits
- This is a client-rendered React app. Google renders JavaScript, so the in-app tags work for it. Social and chat link previews do not run JS, so they only see the prerendered files above; routes without a prerendered file (for example `/shop?c=pooja`, which shares `/shop`) show the generic shop preview.
- The prerender changes the head only; page body content is still drawn by React. For the strongest ranking on content-heavy pages, move to SSR/SSG later (for example Astro or a React framework).
- Rankings depend on content, backlinks and local signals more than tags: keep adding original copy (flower care guides, festival pages), reviews, and links from local listings.
- Sitemap `lastmod` is the build date, not a per-page edit date.
