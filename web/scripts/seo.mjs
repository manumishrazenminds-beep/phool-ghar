// Post-build SEO step (run after `vite build`):
//  1. writes dist/sitemap.xml and points dist/robots.txt at it
//  2. prerenders per-route copies of the built index.html with the right <title>, description,
//     canonical, Open Graph / Twitter tags and JSON-LD, so crawlers and link previews see real tags without JS.
// The React app still boots on top of these files; they only change what is in <head> (plus a short noscript summary).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const SITE = (process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://www.example.com').replace(/\/+$/, '')
const NAME = 'Phool Ghar'
const { PRODUCTS, CATEGORIES } = await import(pathToFileURL(join(root, 'src/data/products.ts')).href)
const shop = PRODUCTS.filter((p) => p.category !== 'addon')

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const abs = (p) => (/^https?:\/\//.test(p) ? p : SITE + p)
const trim = (s, n = 200) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

const POLICIES = {
  privacy: ['Privacy', 'What we collect, why, and how you stay in control.'],
  refunds: ['Refunds and cancellations', 'When you can cancel and how refunds reach you.'],
  shipping: ['Shipping and delivery', 'Where, when and how we deliver.'],
  terms: ['Terms of use', 'The simple rules for using the shop.'],
}

/** Every indexable URL with its head data. `file` is the output path inside dist (query-string pages are sitemap-only). */
const pages = [
  { path: '/', file: 'index.html', title: 'Fresh flowers delivered daily in Pune and Mumbai', desc: 'Order fresh pooja flowers, hand-tied bouquets and cut flowers, or subscribe to daily flower delivery before 8 AM. Skip or pause any day.', prio: '1.0' },
  { path: '/shop', file: 'shop/index.html', title: 'Shop fresh flowers online', desc: 'Pooja flowers, bouquets and cut flowers, fresh every day. Buy once or subscribe for daily delivery.', prio: '0.9' },
  { path: '/shop?type=sub', title: 'Daily flower subscription in Pune and Mumbai', desc: 'Subscribe to fresh pooja flowers every morning. Choose your days, skip or pause any day, and save up to 10% on monthly plans.', prio: '0.9' },
  ...CATEGORIES.map((c) => ({ path: `/shop?c=${c.id}`, title: `${c.label} online`, desc: `${c.blurb} Fresh, hand-picked and delivered to your door.`, prio: '0.8' })),
  { path: '/help', file: 'help/index.html', title: 'Help centre', desc: 'Answers about delivery times, daily flower subscriptions, payments, refunds and flower care.', prio: '0.5' },
  ...Object.entries(POLICIES).map(([slug, [t, d]]) => ({ path: `/policy/${slug}`, file: `policy/${slug}/index.html`, title: t, desc: d, prio: '0.3' })),
  ...shop.map((p) => ({
    path: `/product/${p.slug}`, file: `product/${p.slug}/index.html`, title: p.name, desc: trim(`${p.tagline}. ${p.description}`), image: p.image, type: 'product', prio: '0.8',
    ld: [
      { '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.description, image: p.gallery.map(abs), sku: p.slug, brand: { '@type': 'Brand', name: NAME }, category: p.category,
        offers: { '@type': 'Offer', url: abs(`/product/${p.slug}`), priceCurrency: 'INR', price: String(p.price), availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition' } },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [['Home', '/'], ['Shop', '/shop'], [p.name, `/product/${p.slug}`]].map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })) },
    ],
  })),
]

// ---- sitemap + robots
const today = new Date().toISOString().slice(0, 10)
const urls = pages.map((p) => `  <url><loc>${esc(abs(p.path))}</loc><lastmod>${today}</lastmod><priority>${p.prio}</priority></url>`).join('\n')
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
const robotsPath = join(dist, 'robots.txt')
if (existsSync(robotsPath)) writeFileSync(robotsPath, readFileSync(robotsPath, 'utf8').replace(/^Sitemap:.*$/m, `Sitemap: ${SITE}/sitemap.xml`))

// ---- prerender
const template = readFileSync(join(dist, 'index.html'), 'utf8')
const setMeta = (html, attr, key, value) => {
  const re = new RegExp(`<meta ${attr}="${key}"[^>]*>`)
  const tag = `<meta ${attr}="${key}" content="${esc(value)}" />`
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `${tag}</head>`)
}
let written = 0
for (const p of pages) {
  if (!p.file) continue
  const title = p.title.includes(NAME) ? p.title : `${p.title} | ${NAME}`
  const url = abs(p.path)
  const image = abs(p.image ?? '/img/hero-marigold.jpg')
  let html = template.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`).replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(url)}" />`)
  for (const [attr, key, v] of [
    ['name', 'description', p.desc], ['property', 'og:title', title], ['property', 'og:description', p.desc], ['property', 'og:url', url], ['property', 'og:image', image], ['property', 'og:type', p.type ?? 'website'],
    ['name', 'twitter:title', title], ['name', 'twitter:description', p.desc], ['name', 'twitter:image', image],
  ]) html = setMeta(html, attr, key, v)
  if (p.ld) html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(p.ld)}</script></head>`)
  html = html.replace('<div id="root"></div>', `<div id="root"></div>\n    <noscript><h1>${esc(p.title)}</h1><p>${esc(p.desc)}</p></noscript>`)
  const out = join(dist, p.file)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, html)
  written++
}
console.log(`seo: sitemap with ${pages.length} URLs, ${written} prerendered pages, site ${SITE}`)
