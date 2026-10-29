import { useEffect, useState } from 'react'
import { getSettings } from './api'
import { parseCutoff } from './dates'

export interface PublicSettings { cutoffMinutes: number; freeDeliveryForSubscription: boolean; minOrderPaise: number; supportWhatsapp: string }
const DEFAULTS: PublicSettings = { cutoffMinutes: 21 * 60, freeDeliveryForSubscription: false, minOrderPaise: 0, supportWhatsapp: '' }

let cache: Promise<PublicSettings> | null = null
function load(): Promise<PublicSettings> {
  cache ??= getSettings().then((s) => ({
    cutoffMinutes: parseCutoff(typeof s.cutoff_time === 'string' ? s.cutoff_time : undefined),
    freeDeliveryForSubscription: s.free_delivery_for_subscription === true || s.free_delivery_for_subscription === 'true',
    minOrderPaise: Number(s.min_order_paise ?? 0) || 0,
    supportWhatsapp: typeof s.support_whatsapp === 'string' ? s.support_whatsapp : '',
  })).catch(() => { cache = null; return DEFAULTS })
  return cache
}

/** Public app_settings (cut-off, delivery rules) with sensible defaults while loading or when offline. */
export function useSettings(): PublicSettings {
  const [s, setS] = useState(DEFAULTS)
  useEffect(() => { let alive = true; load().then((v) => alive && setS(v)); return () => { alive = false } }, [])
  return s
}
