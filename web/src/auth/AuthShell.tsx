import { Check } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { BackendOff, Eyebrow } from '../lib/ui'
import { useAuth } from './useAuth'

const PERKS = ['Track every delivery live', 'Pause, skip or change your daily plan', 'Reorder your favourites in a tap']

/** Shared frame for sign-in, sign-up and password pages: one rounded card, brand panel left, form right. */
export function AuthShell({ eyebrow, title, intro, children, footer }: { eyebrow: string; title: ReactNode; intro?: string; children: ReactNode; footer?: ReactNode }) {
  const { configured } = useAuth()
  return (
    <div className="px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-ink/10 bg-white shadow-[0_40px_90px_-40px_rgba(31,61,43,0.45)] lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="relative hidden overflow-hidden bg-leaf p-12 text-cream lg:flex lg:flex-col lg:justify-between">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-marigold/30 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 size-80 rounded-full bg-saffron/20 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute right-10 top-10 size-24 rounded-full border border-cream/15" />
          <div aria-hidden className="pointer-events-none absolute right-16 top-16 size-12 rounded-full border border-cream/20" />
          <div className="relative">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className="font-display mt-4 text-6xl leading-[1.02]">{title}</h1>
            {intro && <p className="mt-5 max-w-xs text-cream/75">{intro}</p>}
          </div>
          <ul className="relative mt-12 space-y-3 text-sm text-cream/85">
            {PERKS.map((p) => (
              <li key={p} className="flex items-center gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-marigold/90 text-white"><Check size={13} weight="bold" aria-hidden /></span>{p}</li>
            ))}
          </ul>
        </aside>
        <div className="p-6 sm:p-10 lg:p-12">
          <div className="lg:hidden">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className="font-display mt-2 text-5xl">{title}</h1>
            {intro && <p className="mt-3 text-ink-soft">{intro}</p>}
          </div>
          <div className="mt-8 lg:mt-0">
            {configured ? children : <BackendOff what="Signing in" />}
            {configured && footer && <div className="mt-8 text-center text-sm text-ink-soft">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 flex items-center gap-4 text-xs text-ink-soft" role="separator">
      <span className="h-px flex-1 bg-ink/10" />{children}<span className="h-px flex-1 bg-ink/10" />
    </div>
  )
}
