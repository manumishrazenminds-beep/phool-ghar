import { useMemo } from 'react'
import { useApi } from './mode'
import { useQuery } from './useQuery'
import type { SettingRow } from './types'

/** app_settings as a plain key -> value object, plus a typed save. */
export function useSettings() {
  const api = useApi()
  const q = useQuery(() => api.select<SettingRow>('app_settings'), [])
  const values = useMemo(() => Object.fromEntries((q.data ?? []).map((r) => [r.key, r.value])) as Record<string, unknown>, [q.data])
  const save = async (patch: Record<string, unknown>) => {
    await api.upsert('app_settings', Object.entries(patch).map(([key, value]) => ({ key, value })), 'key')
    q.reload()
  }
  return { ...q, values, save }
}
