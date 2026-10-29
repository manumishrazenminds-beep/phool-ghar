import { Check, Plus } from '@phosphor-icons/react'
import { ADDONS, inr } from '../data/products'
import { useCart } from '../lib/cart'

/** Cards, vases and small gifts. They are ordinary one-time cart lines that ride along with the flowers' date and slot. */
export function AddOns({ date, slot, compact = false }: { date: string; slot: string; compact?: boolean }) {
  const { lines, add, setQty } = useCart()
  const inCart = (id: string) => lines.find((l) => l.productId === id && l.mode === 'once' && l.date === date && l.slot === slot)
  const oneTimeSlot = slot === 'evening' ? 'evening' : slot

  return (
    <div>
      <p className="mb-3 text-sm font-semibold">Make it a gift <span className="font-normal text-ink-soft">(optional)</span></p>
      <ul className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {ADDONS.map((a) => {
          const line = inCart(a.id)
          return (
            <li key={a.id} className={`flex items-center gap-3 rounded-2xl border p-2.5 transition ${line ? 'border-leaf bg-leaf-soft/50' : 'border-ink/10 bg-white'}`}>
              <img src={a.image} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{a.name}</p>
                <p className="text-xs text-ink-soft">{inr(a.price)}</p>
              </div>
              {line ? (
                <button onClick={() => setQty(line.key, 0)} aria-label={`Remove ${a.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-leaf text-cream"><Check size={16} weight="bold" /></button>
              ) : (
                <button onClick={() => add({ productId: a.id, variantId: 'regular', mode: 'once', qty: 1, date, slot: oneTimeSlot })} aria-label={`Add ${a.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/15 hover:bg-marigold hover:text-white"><Plus size={16} /></button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
