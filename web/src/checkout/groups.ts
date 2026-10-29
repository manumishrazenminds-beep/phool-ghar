import type { ResolvedLine } from '../lib/catalog'
import type { PayGroup } from './types'

export function buildGroups(lines: ResolvedLine[]): PayGroup[] {
  const once = lines.filter((l) => l.line.mode === 'once')
  const groups: PayGroup[] = []
  if (once.length) groups.push({ id: 'once', kind: 'once', lines: once, title: once.length === 1 ? once[0].product.name : `${once.length} one-time items` })
  for (const l of lines.filter((x) => x.line.mode === 'sub')) groups.push({ id: l.line.key, kind: 'sub', lines: [l], title: `${l.product.name}, daily plan` })
  return groups
}
