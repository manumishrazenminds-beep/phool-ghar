// Edge Function: daily-scheduler (CRON_SECRET only; runs 21:00 IST via pg_cron).
// 1) generate_subscription_orders(tomorrow IST)  2) enqueue evening delivery reminders for tomorrow's
// subscription deliveries  3) enqueue plan-ending-soon notices. Safe to run twice: every enqueue carries
// a deterministic dedupe key, and generate_subscription_orders is idempotent by its unique index.
import { preflight } from '../_shared/cors.ts'
import { fail, failFromError, HttpError, ok } from '../_shared/http.ts'
import { serviceClient, type Db } from '../_shared/supabase.ts'
import { chunk, istDate, logApp, requireCronOrService } from '../notify-dispatch/lib.ts'

const ENDING_SOON_DAYS = 3

interface Prof { id: string; email: string | null; phone: string | null }

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await build(from, from + 499)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 500) break
  }
  return out
}

async function loadMap<T extends { id: string }>(db: Db, table: string, cols: string, ids: string[]): Promise<Map<string, T>> {
  const m = new Map<string, T>()
  for (const part of chunk([...new Set(ids)], 150)) {
    const { data } = await db.from(table).select(cols).in('id', part)
    for (const r of (data ?? []) as T[]) m.set(r.id, r)
  }
  return m
}

/** Enqueue one row per channel that has an address. Returns [enqueued, errors]. */
async function enqueueFor(db: Db, prof: Prof | undefined, userId: string, template: string, payload: Record<string, unknown>, dedupeBase: string): Promise<{ enqueued: number; errors: number }> {
  let enqueued = 0
  let errors = 0
  const targets: Array<['email' | 'whatsapp', string | null | undefined]> = [['email', prof?.email], ['whatsapp', prof?.phone]]
  for (const [channel, addr] of targets) {
    if (!addr) continue
    const { error } = await db.rpc('enqueue_notification', { p_user: userId, p_channel: channel, p_template: template, p_to: addr, p_payload: { ...payload, event_key: dedupeBase }, p_dedupe: `${dedupeBase}:${channel}` })
    if (error && !/duplicate|23505|unique/i.test(`${error.code ?? ''} ${error.message ?? ''}`)) errors++ // duplicate = already queued by an earlier run
    else if (!error) enqueued++
  }
  return { enqueued, errors }
}

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST' && req.method !== 'GET') return fail(req, 405, 'method_not_allowed', 'Use POST')
  try {
    await requireCronOrService(req, false)
    const db = serviceClient()
    const today = istDate()
    const tomorrow = istDate(new Date(), 1)
    const counts = { date: tomorrow, orders_generated: null as unknown, reminders_enqueued: 0, ending_enqueued: 0, errors: 0 }

    // 1) tomorrow's subscription orders
    const gen = await db.rpc('generate_subscription_orders', { p_for_date: tomorrow })
    if (gen.error) {
      counts.errors++
      await logApp(db, 'error', 'daily-scheduler', 'generate_failed', gen.error.message, { date: tomorrow })
    } else {
      counts.orders_generated = gen.data
    }

    // 2) evening delivery reminders (one per tomorrow's subscription delivery)
    try {
      const orders = await fetchAll<{ id: string; user_id: string; order_no: string; delivery_date: string; slot_id: string | null; subscription_id: string }>((f, t) =>
        db.from('orders').select('id, user_id, order_no, delivery_date, slot_id, subscription_id').eq('kind', 'subscription_delivery').eq('delivery_date', tomorrow).not('status', 'in', '(cancelled,failed,delivered)').order('id').range(f, t),
      )
      const profs = await loadMap<Prof>(db, 'profiles', 'id, email, phone', orders.map((o) => o.user_id))
      const subs = await loadMap<{ id: string; product_id: string }>(db, 'subscriptions', 'id, product_id', orders.map((o) => o.subscription_id).filter(Boolean))
      const products = await loadMap<{ id: string; name: string }>(db, 'products', 'id, name', [...subs.values()].map((s) => s.product_id))
      const slots = new Map<string, string>()
      const { data: slotRows } = await db.from('delivery_slots').select('id, label')
      for (const s of (slotRows ?? []) as Array<{ id: string; label: string }>) slots.set(s.id, s.label)
      for (const o of orders) {
        const sub = subs.get(o.subscription_id)
        const r = await enqueueFor(db, profs.get(o.user_id), o.user_id, 'delivery_reminder', {
          order_id: o.id, order_no: o.order_no, delivery_date: o.delivery_date, subscription_id: o.subscription_id,
          slot_label: o.slot_id ? slots.get(o.slot_id) ?? o.slot_id : '', product_name: sub ? products.get(sub.product_id)?.name ?? '' : '',
        }, `delivery_reminder:${o.id}`)
        counts.reminders_enqueued += r.enqueued
        counts.errors += r.errors
      }
    } catch (e) {
      counts.errors++
      await logApp(db, 'error', 'daily-scheduler', 'reminders_failed', (e as Error).message)
    }

    // 3) plan ending soon: active plans whose last delivery date falls within the next few days
    try {
      const horizon = istDate(new Date(), ENDING_SOON_DAYS)
      const subs = await fetchAll<{ id: string; user_id: string; product_id: string; end_date: string; slot_id: string | null }>((f, t) =>
        db.from('subscriptions').select('id, user_id, product_id, end_date, slot_id').eq('status', 'active').gte('end_date', today).lte('end_date', horizon).order('id').range(f, t),
      )
      const profs = await loadMap<Prof>(db, 'profiles', 'id, email, phone', subs.map((s) => s.user_id))
      const products = await loadMap<{ id: string; name: string }>(db, 'products', 'id, name', subs.map((s) => s.product_id))
      for (const s of subs) {
        const r = await enqueueFor(db, profs.get(s.user_id), s.user_id, 'plan_ending_soon', {
          subscription_id: s.id, end_date: s.end_date, product_name: products.get(s.product_id)?.name ?? '',
        }, `plan_ending:${s.id}:${s.end_date}`)
        counts.ending_enqueued += r.enqueued
        counts.errors += r.errors
      }
    } catch (e) {
      counts.errors++
      await logApp(db, 'error', 'daily-scheduler', 'ending_failed', (e as Error).message)
    }

    // Duplicate dedupe keys surface as enqueue errors on a re-run only if enqueue_notification raises;
    // the contract RPC is expected to return the existing id for a duplicate, so a second run adds nothing.
    return ok(req, counts)
  } catch (e) {
    if (e instanceof HttpError) return failFromError(req, e)
    return fail(req, 500, 'internal_error', 'Scheduler failed')
  }
})
