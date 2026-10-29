import { Heart } from '@phosphor-icons/react'
import { ProductCard } from '../components/ProductCard'
import { PRODUCTS } from '../data/products'
import { EmptyState, LinkButton } from '../lib/ui'
import { useWishlist } from '../lib/wishlist'

export function Favourites() {
  const { slugs } = useWishlist()
  const items = PRODUCTS.filter((p) => slugs.includes(p.slug))
  return (
    <div>
      <h2 className="font-display text-3xl">Favourites</h2>
      {items.length === 0 ? (
        <div className="mt-6"><EmptyState title="Nothing saved yet" body="Tap the heart on any flower to keep it here." action={<LinkButton to="/shop"><Heart size={16} className="mr-2" />Browse flowers</LinkButton>} /></div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
          {items.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      )}
    </div>
  )
}
