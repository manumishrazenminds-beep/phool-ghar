import { Envelope, InstagramLogo, Phone, WhatsappLogo } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Logo } from './Logo'

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-leaf text-cream">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-10 pt-20 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-cream/70">Farm-fresh pooja flowers, bouquets and daily plans, harvested before sunrise and at your door by 8 AM.</p>
          <div className="mt-6 flex gap-3">
            {[InstagramLogo, WhatsappLogo, Envelope, Phone].map((Icon, i) => (
              <a key={i} href="#" aria-label="Social link" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-marigold">
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>
        {[
          { h: 'Shop', l: [['Pooja flowers', '/shop?c=pooja'], ['Bouquets', '/shop?c=bouquets'], ['Cut flowers', '/shop?c=cut'], ['Daily plans', '/shop?type=sub']] },
          { h: 'Help', l: [['How subscription works', '/#story'], ['Delivery areas', '/#area'], ['Help centre', '/help'], ['Contact us', '/help']] },
          { h: 'Policies', l: [['Privacy', '/policy/privacy'], ['Refunds', '/policy/refunds'], ['Shipping', '/policy/shipping'], ['Terms', '/policy/terms'], ['Team login', '/admin']] },
        ].map((c) => (
          <div key={c.h}>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-saffron">{c.h}</p>
            <ul className="mt-5 space-y-3 text-sm text-cream/80">
              {c.l.map(([t, to]) => (
                <li key={t}><Link to={to} className="transition hover:text-white">{t}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="select-none whitespace-nowrap text-center font-display text-[18vw] font-semibold leading-[0.8] tracking-tighter text-white/[0.04]">Phool Ghar</p>
      <div className="relative border-t border-white/10 px-6 py-6 text-center text-xs text-cream/50">
        &copy; 2026 Phool Ghar. Photography via Unsplash contributors.
      </div>
    </footer>
  )
}
