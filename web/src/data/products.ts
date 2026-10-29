export type Category = 'pooja' | 'bouquets' | 'cut' | 'addon'

export interface Variant {
  id: string
  label: string
  note: string
  multiplier: number
}

export interface Product {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  category: Category
  image: string
  gallery: string[]
  /** one-time price for the Regular variant, in rupees */
  price: number
  /** per-day price when subscribed (Regular variant); null = not subscribable */
  perDay: number | null
  tag?: string
  care: string
}

export const CATEGORIES: { id: Category; label: string; blurb: string; image: string }[] = [
  { id: 'pooja', label: 'Pooja Flowers', blurb: 'Marigold, jasmine, lotus and rose for the daily altar.', image: '/img/marigold-field.jpg' },
  { id: 'bouquets', label: 'Bouquets', blurb: 'Hand-tied for birthdays, anniversaries and thank-yous.', image: '/img/bouquet-peach.jpg' },
  { id: 'cut', label: 'Cut Flowers', blurb: 'Stems for your vase, table and reception counter.', image: '/img/roses-pink.jpg' },
]

export const VARIANTS: Variant[] = [
  { id: 'small', label: 'Small', note: 'Single altar', multiplier: 0.7 },
  { id: 'regular', label: 'Regular', note: 'Family altar', multiplier: 1 },
  { id: 'large', label: 'Large', note: 'Shop or office', multiplier: 1.6 },
]

export const PRODUCTS: Product[] = [
  {
    id: 'p1', slug: 'pooja-mix', name: 'Pooja Mix', tagline: 'Marigold, rose petals and tulsi-ready sprigs',
    description: 'The all-rounder altar pack. A fresh mix of marigold, rose petals and seasonal blooms, picked the evening before and packed in breathable paper.',
    category: 'pooja', image: '/img/marigold-field.jpg', gallery: ['/img/marigold-field.jpg', '/img/marigold-garden.jpg', '/img/marigold-bloom.jpg'],
    price: 149, perDay: 60, tag: 'Best seller', care: 'Sprinkle with water and keep in a cool corner. Best used the same morning.',
  },
  {
    id: 'p2', slug: 'marigold-orange', name: 'Marigold Orange', tagline: 'Full, deep-orange genda blooms',
    description: 'Dense, fragrant orange marigolds from Maharashtra farms. Ideal for garlands, toran and the morning pooja.',
    category: 'pooja', image: '/img/hero-marigold.jpg', gallery: ['/img/hero-marigold.jpg', '/img/marigold-garden.jpg'],
    price: 129, perDay: 54, care: 'Keep stems loose, not pressed. Store away from direct sun.',
  },
  {
    id: 'p3', slug: 'marigold-yellow', name: 'Marigold Yellow', tagline: 'Bright yellow, lightly scented',
    description: 'Golden yellow marigolds, hand-sorted for even petals. A staple for festivals and shop-front offerings.',
    category: 'pooja', image: '/img/yellow-bloom.jpg', gallery: ['/img/yellow-bloom.jpg', '/img/marigold-bloom.jpg'],
    price: 129, perDay: 54, care: 'Lasts a full day at room temperature when kept dry.',
  },
  {
    id: 'p4', slug: 'jasmine-mogra', name: 'Mogra Strings', tagline: 'Hand-strung jasmine, still in bud',
    description: 'Fragrant mogra buds strung by hand the same morning. They open on the altar through the day.',
    category: 'pooja', image: '/img/jasmine-hands.jpg', gallery: ['/img/jasmine-hands.jpg'],
    price: 119, perDay: 49, tag: 'Fragrant', care: 'Keep the string slightly damp in a steel box lined with a cloth.',
  },
  {
    id: 'p5', slug: 'lotus-offering', name: 'Lotus Offering Set', tagline: 'Fresh lotus buds and petals',
    description: 'A temple-grade set of lotus buds and loose petals, ready for abhishek and special occasions.',
    category: 'pooja', image: '/img/lotus-petals.jpg', gallery: ['/img/lotus-petals.jpg', '/img/lotus-buds.jpg'],
    price: 249, perDay: null, tag: 'Festival', care: 'Keep buds in shallow water and use within a day.',
  },
  {
    id: 'p6', slug: 'rose-petal-pooja', name: 'Rose Petal Pooja Pack', tagline: 'Soft pink petals, no stems',
    description: 'Loose, freshly plucked rose petals for offerings, rangoli and decorations.',
    category: 'pooja', image: '/img/roses-soft.jpg', gallery: ['/img/roses-soft.jpg', '/img/roses-pink.jpg'],
    price: 159, perDay: 59, care: 'Spread in a shallow tray and mist lightly.',
  },
  {
    id: 'p7', slug: 'peach-garden-bouquet', name: 'Peach Garden Bouquet', tagline: 'Garden roses, waxflower and foliage',
    description: 'A loose, romantic bouquet of peach garden roses with wild fillers, hand-tied and wrapped in recycled paper.',
    category: 'bouquets', image: '/img/bouquet-peach.jpg', gallery: ['/img/bouquet-peach.jpg', '/img/roses-cream.jpg'],
    price: 1499, perDay: null, tag: 'Gift favourite', care: 'Trim stems at an angle and change the water every second day.',
  },
  {
    id: 'p8', slug: 'blush-rose-wrap', name: 'Blush Rose Wrap', tagline: 'Pink roses in a paper wrap',
    description: 'A generous wrap of pink roses and soft fillers. Arrives ready to gift.',
    category: 'bouquets', image: '/img/bouquet-pink.jpg', gallery: ['/img/bouquet-pink.jpg', '/img/roses-pink.jpg'],
    price: 1299, perDay: null, care: 'Keep in cool water, away from fruit and direct sun.',
  },
  {
    id: 'p9', slug: 'cream-rose-vase', name: 'Cream Rose Bunch', tagline: 'Ten cream roses for a vase',
    description: 'Ten long-stemmed cream roses, a clean look for a table or reception desk. Also available as a weekly office plan.',
    category: 'cut', image: '/img/roses-cream.jpg', gallery: ['/img/roses-cream.jpg', '/img/roses-soft.jpg'],
    price: 1099, perDay: 80, tag: 'Office plan', care: 'Re-cut stems every two days; add flower food to the water.',
  },
  {
    id: 'p10', slug: 'pink-rose-bunch', name: 'Pink Rose Bunch', tagline: 'Full-blown pink garden roses',
    description: 'Lush, full pink roses for a statement vase. Bought by the bunch, delivered fresh.',
    category: 'cut', image: '/img/roses-pink.jpg', gallery: ['/img/roses-pink.jpg', '/img/roses-soft.jpg'],
    price: 899, perDay: null, care: 'Remove lower leaves and keep the vase out of draughts.',
  },
  {
    id: 'p11', slug: 'shevanti-mix', name: 'Shevanti Mix', tagline: 'White, yellow and purple shevanti',
    description: 'Layered shevanti blooms in soft whites, yellows and purples. Long-lasting and lightly scented, a favourite for daily pooja.',
    category: 'pooja', image: '/img/marigold-bloom.jpg', gallery: ['/img/marigold-bloom.jpg', '/img/yellow-bloom.jpg'],
    price: 169, perDay: 70, care: 'Keep dry and cool. Lasts well through the day.',
  },
  {
    id: 'p12', slug: 'red-rose-buds', name: 'Red Rose Buds', tagline: 'Fresh rose buds for the altar',
    description: 'Tight red rose buds that open slowly on the altar. Picked the evening before and packed in breathable paper.',
    category: 'pooja', image: '/img/roses-soft.jpg', gallery: ['/img/roses-soft.jpg', '/img/roses-pink.jpg'],
    price: 179, perDay: 70, care: 'Mist lightly and keep out of direct sun.',
  },
  {
    id: 'p13', slug: 'festival-garland', name: 'Marigold Garland', tagline: 'Hand-strung, three lengths',
    description: 'A full marigold garland, strung by hand the night before. Ideal for torans, deities, vehicles and celebrations.',
    category: 'pooja', image: '/img/marigold-garden.jpg', gallery: ['/img/marigold-garden.jpg', '/img/hero-marigold.jpg'],
    price: 349, perDay: null, tag: 'Festival', care: 'Hang in a shaded spot and sprinkle with water in the morning.',
  },
  {
    id: 'p14', slug: 'lotus-bud-bunch', name: 'Lotus Bud Bunch', tagline: 'Ten fresh lotus buds',
    description: 'A bunch of ten lotus buds with long stems, ready for pooja, decor or gifting.',
    category: 'cut', image: '/img/lotus-buds.jpg', gallery: ['/img/lotus-buds.jpg', '/img/lotus-petals.jpg'],
    price: 399, perDay: null, care: 'Stand the stems in shallow water and use within a day.',
  },
  {
    id: 'a1', slug: 'greeting-card', name: 'Handwritten Greeting Card', tagline: 'Your message, written by hand',
    description: 'A textured card with your message handwritten by our team and tucked into the wrap.',
    category: 'addon', image: '/img/roses-soft.jpg', gallery: ['/img/roses-soft.jpg'],
    price: 49, perDay: null, care: 'Delivered with your order.',
  },
  {
    id: 'a2', slug: 'ceramic-vase', name: 'Ceramic Bud Vase', tagline: 'A small matte vase for table or desk',
    description: 'A hand-glazed ceramic bud vase, sized for a bunch of cut flowers or a few roses.',
    category: 'addon', image: '/img/roses-cream.jpg', gallery: ['/img/roses-cream.jpg'],
    price: 399, perDay: null, care: 'Wipe clean with a soft cloth.',
  },
  {
    id: 'a3', slug: 'mithai-box', name: 'Mithai Box (250 g)', tagline: 'Fresh sweets from a local halwai',
    description: 'A 250 g box of assorted sweets, packed the same morning for gifting with flowers.',
    category: 'addon', image: '/img/marigold-bloom.jpg', gallery: ['/img/marigold-bloom.jpg'],
    price: 299, perDay: null, care: 'Best eaten within two days.',
  },
  {
    id: 'a4', slug: 'scented-candle', name: 'Jasmine Soy Candle', tagline: 'A small hand-poured soy candle',
    description: 'A small hand-poured soy candle with a soft jasmine scent. Burns for about twenty hours.',
    category: 'addon', image: '/img/jasmine-hands.jpg', gallery: ['/img/jasmine-hands.jpg'],
    price: 349, perDay: null, care: 'Trim the wick to 5 mm before each burn.',
  },
]

/** Everything a customer can browse: add-ons live in PRODUCTS so the cart and checkout price them like any item. */
export const SHOP_PRODUCTS = PRODUCTS.filter((p) => p.category !== 'addon')
export const ADDONS = PRODUCTS.filter((p) => p.category === 'addon')

export const PLAN_PERIODS = [
  { days: 7, discount: 0, label: 'Weekly', blurb: 'Try it for a week' },
  { days: 15, discount: 0.05, label: 'Fortnight', blurb: 'Save 5%' },
  { days: 30, discount: 0.1, label: 'Monthly', blurb: 'Save 10%, most popular' },
]

export const SLOTS = [
  { id: 'early', label: '5:00 to 6:30 AM', note: 'Early morning' },
  { id: 'morning', label: '6:30 to 8:00 AM', note: 'Morning' },
  { id: 'evening', label: '5:00 to 7:00 PM', note: 'Evening (one-time only)' },
]

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

export const findProduct = (slug: string) => PRODUCTS.find((p) => p.slug === slug)
