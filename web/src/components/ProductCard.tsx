import { Plus, Repeat } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { inr, type Product } from '../data/products'
import { useCart } from '../lib/cart'
import { HeartButton } from './HeartButton'

const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10)

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { add } = useCart()
  const second = product.gallery[1]

  const quickAdd = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    add({ productId: product.id, variantId: 'regular', mode: 'once', qty: 1, date: tomorrow(), slot: 'early' })
  }

  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, delay: (index % 4) * 0.08, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link to={`/product/${product.slug}`} className="group flex h-full flex-col">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-cream-2">
          <img src={product.image} alt={product.name} width={400} height={500} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-[var(--ease-out-expo)] group-hover:scale-110" />
          {second && (
            <img src={second} alt="" loading="lazy" className="absolute inset-0 h-full w-full scale-105 object-cover opacity-0 transition-all duration-700 ease-[var(--ease-out-expo)] group-hover:scale-100 group-hover:opacity-100" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/40 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
          {product.tag && <span className="absolute left-3 top-3 rounded-full bg-cream/90 px-3 py-1 text-xs font-medium backdrop-blur">{product.tag}</span>}
          {product.perDay && (
            <span className="absolute left-3 top-12 flex items-center gap-1.5 rounded-full bg-leaf px-3 py-1.5 text-xs font-medium text-cream">
              <Repeat size={13} /> {inr(product.perDay)}/day
            </span>
          )}
          <HeartButton slug={product.slug} name={product.name} className="absolute right-3 top-3" />
          <button
            onClick={quickAdd}
            aria-label={`Quick add ${product.name} to basket`}
            className="absolute inset-x-3 bottom-3 flex translate-y-4 items-center justify-center gap-2 rounded-full bg-cream/90 py-3 text-sm font-medium opacity-0 backdrop-blur-md transition duration-500 hover:bg-marigold hover:text-white group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100 max-md:translate-y-0 max-md:opacity-100"
          >
            <Plus size={16} weight="bold" /> Quick add
          </button>
        </div>
        <div className="mt-4 flex flex-1 items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <h3 className="font-display line-clamp-2 text-xl leading-tight sm:line-clamp-1 sm:text-2xl">{product.name}</h3>
            <p className="mt-1 line-clamp-2 min-h-[2.6rem] text-sm leading-snug text-ink-soft">{product.tagline}</p>
          </div>
          <p className="whitespace-nowrap pt-1 font-medium">{inr(product.price)}</p>
        </div>
      </Link>
    </motion.div>
  )
}
