import { useMemo } from 'react'
import { useApi } from './mode'
import { useQuery } from './useQuery'
import type { Category, PlanPeriod, Product, Profile, Slot, Zone } from './types'

/** Delivery slots, products, delivery staff and customers as id -> record maps. Cheap lookups reused by many screens. */
export function useSlots() {
  const api = useApi()
  const q = useQuery(() => api.select<Slot>('delivery_slots', { order: [{ col: 'sort' }] }), [])
  const map = useMemo(() => new Map((q.data ?? []).map((s) => [s.id, s])), [q.data])
  return { ...q, slots: q.data ?? [], map, label: (id: string) => map.get(id)?.label ?? id }
}
export function useProducts() {
  const api = useApi()
  const q = useQuery(() => api.select<Product>('products', { order: [{ col: 'sort' }] }), [])
  const map = useMemo(() => new Map((q.data ?? []).map((s) => [s.id, s])), [q.data])
  return { ...q, products: q.data ?? [], map }
}
export function useCategories() {
  const api = useApi()
  return useQuery(() => api.select<Category>('categories', { order: [{ col: 'sort' }] }), [])
}
export function useZones() {
  const api = useApi()
  return useQuery(() => api.select<Zone>('delivery_zones', { order: [{ col: 'pincode' }] }), [])
}
export function usePlans() {
  const api = useApi()
  return useQuery(() => api.select<PlanPeriod>('plan_periods', { order: [{ col: 'days' }] }), [])
}
export function useDeliveryStaff() {
  const api = useApi()
  const q = useQuery(() => api.select<Profile>('profiles', { filters: [{ col: 'role', op: 'eq', val: 'delivery' }], order: [{ col: 'full_name' }] }), [])
  return { ...q, staff: (q.data ?? []).filter((p) => p.active !== false) }
}
export function useCustomerMap() {
  const api = useApi()
  const q = useQuery(() => api.select<Profile>('profiles', { filters: [{ col: 'role', op: 'eq', val: 'customer' }], limit: 2000 }), [])
  const map = useMemo(() => new Map((q.data ?? []).map((s) => [s.id, s])), [q.data])
  return { ...q, customers: q.data ?? [], map, name: (id: string | null | undefined) => (id ? map.get(id)?.full_name ?? 'Customer' : '-') }
}

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const newId = () => globalThis.crypto?.randomUUID?.() ?? 'id-' + Math.random().toString(36).slice(2, 12)
