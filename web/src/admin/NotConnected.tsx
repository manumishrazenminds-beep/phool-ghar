import { PlugsConnected } from '@phosphor-icons/react'
import { Button } from './ui'
import { useAdminMode } from './mode'

const STEPS = [
  'Create a Supabase project (free tier is enough) and run the migrations in supabase/migrations.',
  'Deploy the Edge Functions: team-admin, refund-create, order-invoice (supabase functions deploy).',
  'Create a public storage bucket named product-images.',
  'In web/.env.local set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY and VITE_DATA_PROVIDER=supabase, then restart npm run dev.',
  'Create the owner account, then set its profiles.role to admin in the Supabase table editor (one time).',
]

export function NotConnected() {
  const { setDemo } = useAdminMode()
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <div className="rounded-2xl border border-ink/10 bg-white p-6 sm:p-8">
        <PlugsConnected size={34} weight="duotone" className="text-marigold-deep" aria-hidden />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-marigold-deep">Admin</p>
        <h1 className="mt-1 font-display text-5xl">Backend not connected</h1>
        <p className="mt-3 text-ink-soft">
          The admin panel reads and writes orders, products and customers in Supabase, and no Supabase project is configured for this build yet.
          Nothing is broken; the screens simply have nothing to talk to.
        </p>
        <h2 className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">Next steps</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
          {STEPS.map((s) => <li key={s}>{s}</li>)}
        </ol>
        <div className="mt-7 rounded-xl bg-saffron/20 p-4">
          <p className="text-sm font-medium">Want to see the panels first?</p>
          <p className="mt-1 text-sm text-ink-soft">Demo mode fills every screen with invented sample data stored only in this browser tab. Nothing is sent anywhere.</p>
          <Button variant="primary" className="mt-3" onClick={() => setDemo(true)}>Open the admin in demo mode</Button>
        </div>
      </div>
    </div>
  )
}
