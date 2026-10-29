import { Heart } from '@phosphor-icons/react'
import type { MouseEvent } from 'react'
import { useWishlist } from '../lib/wishlist'

export function HeartButton({ slug, name, className = '' }: { slug: string; name: string; className?: string }) {
  const { has, toggle } = useWishlist()
  const on = has(slug)
  const click = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggle(slug)
  }
  return (
    <button onClick={click} aria-pressed={on} aria-label={on ? `Remove ${name} from favourites` : `Save ${name} to favourites`}
      className={`grid h-11 w-11 place-items-center rounded-full bg-cream/90 backdrop-blur transition hover:scale-105 ${on ? 'text-rose' : 'text-ink'} ${className}`}>
      <Heart size={19} weight={on ? 'fill' : 'regular'} />
    </button>
  )
}
