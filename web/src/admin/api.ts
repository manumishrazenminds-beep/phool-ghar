import { callFn, supabase } from '../lib/supabase'
import { readableError } from './format'

export interface Filter {
  col: string
  op: 'eq' | 'neq' | 'in' | 'gt' | 'gte' | 'lt' | 'lte' | 'ilike' | 'is'
  val: unknown
}
export interface Query {
  filters?: Filter[]
  /** case-insensitive "contains" across several text columns */
  or?: { cols: string[]; term: string }
  order?: { col: string; asc?: boolean }[]
  limit?: number
}

/**
 * Every admin screen talks to this interface only. `liveApi` (below) hits Supabase under RLS;
 * `demoApi` (demo.ts) answers the same calls from in-memory sample data.
 */
export interface Api {
  mode: 'live' | 'demo'
  select<T>(table: string, q?: Query): Promise<T[]>
  upsert<T>(table: string, rows: Partial<T> | Partial<T>[], onConflict?: string): Promise<T[]>
  /** Partial update of rows matching all `match` columns (use instead of upsert for partial patches). */
  update(table: string, match: Record<string, unknown>, patch: Record<string, unknown>): Promise<void>
  remove(table: string, match: Record<string, unknown>): Promise<void>
  /** Printable invoice HTML from the order-invoice function. */
  invoice(orderId: string): Promise<string>
  rpc<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T>
  fn<T = unknown>(name: string, body?: unknown): Promise<T>
  uploadImage(file: File): Promise<string>
}

const fail = (e: unknown): never => {
  throw new Error(readableError(e))
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const liveApi: Api = {
  mode: 'live',
  async select<T>(table: string, q: Query = {}) {
    let b: any = supabase.from(table).select('*')
    for (const f of q.filters ?? []) {
      const v = f.val
      if (f.op === 'in') b = b.in(f.col, v as unknown[])
      else if (f.op === 'is') b = b.is(f.col, v)
      else if (f.op === 'ilike') b = b.ilike(f.col, `%${v}%`)
      else b = b[f.op](f.col, v)
    }
    if (q.or?.term.trim()) {
      const t = q.or.term.trim().replace(/[,()%]/g, ' ')
      b = b.or(q.or.cols.map((c) => `${c}.ilike.%${t}%`).join(','))
    }
    for (const o of q.order ?? []) b = b.order(o.col, { ascending: o.asc ?? true })
    b = b.limit(q.limit ?? 1000)
    const { data, error } = await b
    if (error) fail(error)
    return (data ?? []) as T[]
  },
  async upsert<T>(table: string, rows: Partial<T> | Partial<T>[], onConflict?: string) {
    const { data, error }: any = await (supabase.from(table) as any).upsert(rows, onConflict ? { onConflict } : undefined).select()
    if (error) fail(error)
    return (data ?? []) as T[]
  },
  async update(table, match, patch) {
    let b: any = supabase.from(table).update(patch)
    for (const [k, v] of Object.entries(match)) b = b.eq(k, v)
    const { error } = await b
    if (error) fail(error)
  },
  async invoice(orderId) {
    // order-invoice is GET-only, so callFn (POST) cannot be used here.
    const { data, error } = await supabase.functions.invoke(`order-invoice?order_id=${encodeURIComponent(orderId)}&format=json`, { method: 'GET' })
    if (error) return fail(error)
    const html = (data as { data?: { html?: string } } | null)?.data?.html
    if (!html) throw new Error('The invoice function returned no document.')
    return html
  },
  async remove(table, match) {
    let b: any = supabase.from(table).delete()
    for (const [k, v] of Object.entries(match)) b = b.eq(k, v)
    const { error } = await b
    if (error) fail(error)
  },
  async rpc<T>(name: string, args?: Record<string, unknown>) {
    const { data, error } = await (supabase as any).rpc(name, args ?? {})
    if (error) fail(error)
    return data as T
  },
  async fn<T>(name: string, body?: unknown) {
    try {
      const r = await callFn<{ data?: T } & Record<string, unknown>>(name, body)
      return (r && typeof r === 'object' && 'data' in r ? r.data : r) as T
    } catch (e) {
      return fail(e)
    }
  },
  async uploadImage(file: File) {
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type })
    if (error) fail(error)
    return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
  },
}
