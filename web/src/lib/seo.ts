import { useEffect } from 'react'

export const SITE_NAME = 'Phool Ghar'
/** Public origin used for canonical and Open Graph URLs. Set VITE_SITE_URL in production. */
export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://www.example.com').replace(/\/+$/, '')
export const DEFAULT_IMAGE = '/img/hero-marigold.jpg'
export const DEFAULT_DESCRIPTION = 'Fresh pooja flowers, bouquets and daily flower subscriptions in Pune and Mumbai, harvested before sunrise and at your door by 8 AM.'

/** Routes that must never be indexed: account, checkout, auth and back-office screens. */
export const PRIVATE_PREFIXES = ['/login', '/signup', '/forgot-password', '/reset-password', '/checkout', '/account', '/orders', '/order', '/admin', '/delivery', '/cart', '/__story']
export const isPrivatePath = (path: string) => PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))

export const abs = (pathOrUrl: string) => (/^https?:\/\//.test(pathOrUrl) ? pathOrUrl : SITE_URL + (pathOrUrl.startsWith('/') ? '' : '/') + pathOrUrl)

export interface SeoInput {
  title: string
  description?: string
  path: string
  image?: string
  type?: 'website' | 'product' | 'article'
  jsonLd?: object | object[]
}

function meta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function link(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/** Applies one page's title, description, canonical, social tags and structured data. Cleans up its JSON-LD on unmount. */
export function applySeo(s: SeoInput) {
  const title = s.title.includes(SITE_NAME) ? s.title : `${s.title} | ${SITE_NAME}`
  const desc = (s.description ?? DEFAULT_DESCRIPTION).slice(0, 300)
  const url = abs(s.path)
  const image = abs(s.image ?? DEFAULT_IMAGE)
  document.title = title
  meta('name', 'description', desc)
  link('canonical', url)
  meta('property', 'og:type', s.type ?? 'website')
  meta('property', 'og:site_name', SITE_NAME)
  meta('property', 'og:title', title)
  meta('property', 'og:description', desc)
  meta('property', 'og:url', url)
  meta('property', 'og:image', image)
  meta('name', 'twitter:card', 'summary_large_image')
  meta('name', 'twitter:title', title)
  meta('name', 'twitter:description', desc)
  meta('name', 'twitter:image', image)
}

export function useSeo(s: SeoInput) {
  const ld = s.jsonLd ? JSON.stringify(s.jsonLd) : ''
  useEffect(() => {
    applySeo(s)
    let script: HTMLScriptElement | null = null
    if (ld) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.dataset.seo = 'page'
      script.textContent = ld
      document.head.appendChild(script)
    }
    return () => { script?.remove() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.title, s.description, s.path, s.image, s.type, ld])
}

/** Keeps the robots meta in step with the route: private screens are noindex, everything else is indexable. */
export function applyRobots(path: string) {
  meta('name', 'robots', isPrivatePath(path) ? 'noindex, nofollow' : 'index, follow, max-image-preview:large')
}

export const breadcrumbLd = (items: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
})
