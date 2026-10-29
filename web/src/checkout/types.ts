import type { AddressSnapshot } from '../lib/api'
import type { ResolvedLine } from '../lib/catalog'

/** One payable unit: all one-time lines together, or a single subscription line. */
export interface PayGroup {
  id: string
  kind: 'once' | 'sub'
  lines: ResolvedLine[]
  title: string
}

export interface AddressValue {
  /** saved address id when available (sent as address_id); otherwise the snapshot is sent inline */
  id?: string
  snapshot: AddressSnapshot
  pincode: string
  feePaise: number
  label: string
}

export interface Schedule {
  date: string
  slot: string
  giftNote: string
  instructions: string
}

export interface AppliedCoupon { code: string; discountPaise: number }
