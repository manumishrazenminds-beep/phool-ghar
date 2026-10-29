import { backendConfigured } from '../lib/env'
import { useAdminMode } from './mode'
import type { Role } from './types'

/** Always-visible strip while demo mode is on. */
export function DemoBar() {
  const { demo, setDemo, demoRole, setDemoRole } = useAdminMode()
  if (!demo) return null
  if (!backendConfigured) return <div className="admin-chrome bg-marigold px-4 py-1.5 text-center font-mono text-xs uppercase tracking-[0.14em] text-white">Demo workspace: sample data, nothing is saved or sent</div>
  return (
    <div className="admin-chrome flex flex-wrap items-center justify-between gap-2 bg-marigold px-4 py-1.5 text-xs font-medium text-white">
      <span className="font-mono uppercase tracking-[0.14em]">Demo mode: invented sample data, nothing is saved or sent</span>
      <span className="flex items-center gap-3">
        <label className="flex items-center gap-1.5">
          <span>Viewing as</span>
          <select value={demoRole} onChange={(e) => setDemoRole(e.target.value as Role)} className="rounded bg-white/95 px-1.5 py-1 text-ink">
            <option value="admin">Owner (admin)</option>
            <option value="staff">Staff (orders, customers, subscriptions)</option>
            <option value="delivery">Delivery staff</option>
          </select>
        </label>
        <button type="button" onClick={() => setDemo(false)} className="min-h-8 rounded bg-white/20 px-2.5 hover:bg-white/30">Exit demo</button>
      </span>
    </div>
  )
}
