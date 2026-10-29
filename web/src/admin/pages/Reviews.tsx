import { Star } from '@phosphor-icons/react'
import { useState } from 'react'
import { fmtDate } from '../format'
import { useApi } from '../mode'
import { useQuery } from '../useQuery'
import { Button, EmptyState, PageHeader, StatusBadge, Table, useToast } from '../ui'

interface ReviewRow { id: string; product_id: string; rating: number; body: string | null; approved: boolean; created_at: string }
interface ProductName { id: string; name: string }

export default function Reviews() {
  const api = useApi()
  const { run } = useToast()
  const [show, setShow] = useState<'pending' | 'all'>('pending')
  const q = useQuery(async () => {
    const [reviews, products] = await Promise.all([
      api.select<ReviewRow>('reviews', { order: [{ col: 'created_at', asc: false }], limit: 200 }),
      api.select<ProductName>('products', {}),
    ])
    const names = new Map(products.map((p) => [p.id, p.name]))
    return reviews.map((r) => ({ ...r, product: names.get(r.product_id) ?? 'Product' }))
  }, [])
  const rows = (q.data ?? []).filter((r) => show === 'all' || !r.approved)

  const set = async (r: ReviewRow, approved: boolean) => {
    if (await run(async () => { await api.update('reviews', { id: r.id }, { approved }); return true }, approved ? 'Review published' : 'Review hidden')) q.reload()
  }
  const del = async (r: ReviewRow) => {
    if (await run(async () => { await api.remove('reviews', { id: r.id }); return true }, 'Review deleted')) q.reload()
  }

  return (
    <>
      <PageHeader eyebrow="Catalogue" title="Reviews" actions={
        <div className="flex gap-2">
          <Button variant={show === 'pending' ? 'primary' : 'ghost'} onClick={() => setShow('pending')}>Waiting ({(q.data ?? []).filter((r) => !r.approved).length})</Button>
          <Button variant={show === 'all' ? 'primary' : 'ghost'} onClick={() => setShow('all')}>All</Button>
        </div>
      }>Only customers with a delivered order can leave a review. Nothing shows on the shop until you publish it.</PageHeader>
      <Table caption="Reviews" rows={rows} loading={q.loading} error={q.error} onRetry={q.reload} rowKey={(r) => r.id}
        empty={<EmptyState title={show === 'pending' ? 'Nothing waiting' : 'No reviews yet'}>Reviews appear here after a delivered order.</EmptyState>}
        columns={[
          { key: 'p', header: 'Product', cell: (r) => <span className="font-medium">{r.product}</span> },
          { key: 'r', header: 'Rating', cell: (r) => <span className="inline-flex items-center gap-1"><Star size={14} weight="fill" className="text-saffron" />{r.rating}</span> },
          { key: 'b', header: 'Review', cell: (r) => <span className="line-clamp-2 max-w-md text-sm">{r.body || 'No comment'}</span> },
          { key: 'd', header: 'Date', hideOnSmall: true, cell: (r) => fmtDate(r.created_at, { day: 'numeric', month: 'short' }) },
          { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.approved ? 'active' : 'paused'} label={r.approved ? 'Published' : 'Waiting'} /> },
          { key: 'a', header: '', align: 'right', cell: (r) => (
            <span className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
              <Button onClick={() => void set(r, !r.approved)}>{r.approved ? 'Hide' : 'Publish'}</Button>
              <Button variant="danger" onClick={() => void del(r)}>Delete</Button>
            </span>
          ) },
        ]} />
    </>
  )
}
