import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { createTicket, friendlyError, listOrders, listTickets, type OrderRow, type TicketRow } from '../lib/api'
import { fmtDate } from '../lib/dates'
import { env } from '../lib/env'
import { Alert, Button, Field, Select, TextArea } from '../lib/ui'

export function Support() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [tickets, setTickets] = useState<TicketRow[] | null>(null)
  const [f, setF] = useState({ subject: '', message: '', order_id: '' })
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const load = useCallback(() => { listTickets().then(setTickets).catch(() => setTickets([])) }, [])
  useEffect(() => { load(); listOrders().then(setOrders).catch(() => {}) }, [load])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !user) return
    const v: Record<string, string> = {}
    if (f.subject.trim().length < 3) v.subject = 'Please add a short subject.'
    if (f.message.trim().length < 10) v.message = 'Tell us a little more so we can help.'
    setErrs(v)
    if (Object.keys(v).length) return
    setBusy(true); setErr(null)
    try { await createTicket(user.id, { subject: f.subject.trim(), message: f.message.trim(), order_id: f.order_id || null }); setSent(true); setF({ subject: '', message: '', order_id: '' }); load() } catch (x) { setErr(friendlyError(x)) } finally { setBusy(false) }
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_20rem]">
      <div>
        <h2 className="font-display text-3xl">How can we help?</h2>
        <p className="mt-2 text-sm text-ink-soft">We reply by email, usually within a few hours between 6 AM and 9 PM.</p>
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <Select label="Related order (optional)" value={f.order_id} onChange={(e) => setF({ ...f, order_id: e.target.value })}>
            <option value="">Not about a specific order</option>
            {orders.map((o) => <option key={o.id} value={o.id}>{o.order_no}, {fmtDate(o.delivery_date)}</option>)}
          </Select>
          <Field label="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} error={errs.subject} />
          <TextArea label="Message" rows={6} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} error={errs.message} />
          {err && <Alert>{err}</Alert>}
          {sent && <Alert tone="ok" title="Request received">Thank you. We will get back to you soon.</Alert>}
          <Button type="submit" loading={busy}>Send request</Button>
        </form>
        {env.whatsappNumber && <p className="mt-6 text-sm text-ink-soft">Prefer chat? <a className="font-medium text-ink underline underline-offset-4" href={`https://wa.me/${env.whatsappNumber.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">Message us on WhatsApp</a>.</p>}
      </div>
      <aside>
        <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">Your requests</h3>
        {tickets === null ? <p className="mt-3 text-sm text-ink-soft">Loading</p> : tickets.length === 0 ? <p className="mt-3 text-sm text-ink-soft">Nothing yet.</p> : (
          <ul className="mt-3 space-y-3">
            {tickets.map((t) => (
              <li key={t.id} className="rounded-2xl border border-ink/10 bg-white p-4 text-sm">
                <p className="font-medium">{t.subject}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{fmtDate(t.created_at.slice(0, 10))}, {t.status}</p>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  )
}
