import { ArrowClockwise } from '@phosphor-icons/react'
import { useState } from 'react'
import { fmtDateTime, humanize } from '../format'
import { useApi } from '../mode'
import { useQuery } from '../useQuery'
import type { OutboxRow } from '../types'
import { Button, EmptyState, PageHeader, SelectField, StatusBadge, Table, Tabs, Toolbar, useToast } from '../ui'

type Tab = 'all' | 'failed' | 'queued' | 'sent'
export default function Notifications() {
  const api = useApi()
  const { run } = useToast()
  const [tab, setTab] = useState<Tab>('failed')
  const [channel, setChannel] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const q = useQuery(() => api.select<OutboxRow>('notification_outbox', { order: [{ col: 'created_at', asc: false }], limit: 300 }), [])
  const all = q.data ?? []
  const bad = (r: OutboxRow) => r.status === 'failed' || r.status === 'dead'
  const rows = all.filter((r) => (!channel || r.channel === channel) && (tab === 'all' || (tab === 'failed' ? bad(r) : tab === 'queued' ? r.status === 'queued' || r.status === 'sending' : r.status === 'sent')))
  const retry = async (r: OutboxRow) => {
    setBusy(r.id)
    const ok = await run(async () => { await api.update('notification_outbox', { id: r.id }, { status: 'queued', next_attempt_at: new Date().toISOString(), attempts: r.status === 'dead' ? 0 : r.attempts, last_error: null }); return true }, 'Queued for another try')
    setBusy(null)
    if (ok) q.reload()
  }
  return (
    <>
      <PageHeader eyebrow="Store" title="Notifications log" actions={<Button icon={<ArrowClockwise size={16} />} onClick={q.reload}>Refresh</Button>}>Every email and WhatsApp message the shop tries to send. Failed messages are retried automatically up to six times, then marked dead.</PageHeader>
      <Toolbar>
        <Tabs label="Status" value={tab} onChange={setTab} tabs={[{ id: 'failed', label: 'Failed', count: all.filter(bad).length }, { id: 'queued', label: 'Waiting', count: all.filter((r) => r.status === 'queued' || r.status === 'sending').length }, { id: 'sent', label: 'Sent' }, { id: 'all', label: 'All', count: all.length }]} />
        <SelectField label="Channel" value={channel} onChange={(e) => setChannel(e.target.value)}><option value="">All</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="push">Push</option></SelectField>
      </Toolbar>
      <Table caption="Notification outbox" rows={q.data ? rows : undefined} loading={q.loading} error={q.error} onRetry={q.reload} rowKey={(r) => r.id}
        empty={<EmptyState title={tab === 'failed' ? 'Nothing has failed' : 'No messages'}>{tab === 'failed' ? 'All recent notifications went out.' : 'Nothing matches this filter.'}</EmptyState>}
        columns={[
          { key: 'w', header: 'When', cell: (r) => <span className="text-xs">{fmtDateTime(r.created_at)}</span> },
          { key: 't', header: 'Template', cell: (r) => humanize(r.template) },
          { key: 'c', header: 'Channel', hideOnSmall: true, cell: (r) => humanize(r.channel) },
          { key: 'to', header: 'To', hideOnSmall: true, cell: (r) => <span className="text-xs">{r.to_address}</span> },
          { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          { key: 'a', header: 'Tries', align: 'right', cell: (r) => r.attempts },
          { key: 'e', header: 'Last error', cell: (r) => <span className="block max-w-56 truncate text-xs text-rose" title={r.last_error ?? ''}>{r.last_error ?? ''}</span> },
          { key: 'r', header: '', align: 'right', cell: (r) => bad(r) ? <Button size="sm" disabled={busy === r.id} onClick={() => void retry(r)}>Retry</Button> : null },
        ]} />
    </>
  )
}
