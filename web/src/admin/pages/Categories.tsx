import { ArrowDown, ArrowUp, Plus } from '@phosphor-icons/react'
import { useState } from 'react'
import { ImageInput } from '../ImageInput'
import { newId, slugify } from '../lookups'
import { useApi } from '../mode'
import { useQuery } from '../useQuery'
import type { Category } from '../types'
import { Button, Drawer, EmptyState, PageHeader, Table, TextArea, TextField, Toggle, useToast } from '../ui'

export default function Categories() {
  const api = useApi()
  const { run } = useToast()
  const q = useQuery(() => api.select<Category>('categories', { order: [{ col: 'sort' }] }), [])
  const [edit, setEdit] = useState<Category | null>(null)
  const [isNew, setIsNew] = useState(false)
  const list = q.data ?? []
  const move = async (i: number, dir: -1 | 1) => {
    const a = list[i], b = list[i + dir]
    if (!a || !b) return
    if (await run(async () => { await Promise.all([api.update('categories', { id: a.id }, { sort: b.sort }), api.update('categories', { id: b.id }, { sort: a.sort === b.sort ? a.sort + dir : a.sort })]); return true })) q.reload()
  }
  return (
    <>
      <PageHeader eyebrow="Catalogue" title="Categories" actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => { setIsNew(true); setEdit({ id: newId(), slug: '', name: '', blurb: '', image_url: null, sort: (list.at(-1)?.sort ?? 0) + 1, active: true }) }}>New category</Button>}>The order here is the order on the shop page.</PageHeader>
      <Table caption="Categories" rows={q.data} loading={q.loading} error={q.error} onRetry={q.reload} rowKey={(c) => c.id} onRowClick={(c) => { setIsNew(false); setEdit(c) }}
        empty={<EmptyState title="No categories">Create one such as Pooja Flowers or Bouquets.</EmptyState>}
        columns={[
          { key: 'o', header: 'Order', cell: (c) => { const i = list.indexOf(c); return (
            <span className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
              <button type="button" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => void move(i, -1)} className="grid h-8 w-8 place-items-center rounded hover:bg-ink/5 disabled:opacity-30 pointer-coarse:h-11 pointer-coarse:w-11"><ArrowUp size={14} /></button>
              <button type="button" aria-label={`Move ${c.name} down`} disabled={i === list.length - 1} onClick={() => void move(i, 1)} className="grid h-8 w-8 place-items-center rounded hover:bg-ink/5 disabled:opacity-30 pointer-coarse:h-11 pointer-coarse:w-11"><ArrowDown size={14} /></button>
            </span>) } },
          { key: 'n', header: 'Name', cell: (c) => <span className="flex items-center gap-3"><span className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-cream-2">{c.image_url && <img src={c.image_url} alt="" className="h-full w-full object-cover" />}</span><span><b className="font-medium">{c.name}</b><span className="block max-w-sm truncate text-xs text-ink-soft">{c.blurb}</span></span></span> },
          { key: 's', header: 'Slug', hideOnSmall: true, cell: (c) => <span className="font-mono text-xs">{c.slug}</span> },
          { key: 'a', header: 'Active', align: 'center', cell: (c) => <span onClick={(e) => e.stopPropagation()}><Toggle compact label={`${c.name} active`} checked={c.active} onChange={async (v) => { if (await run(async () => { await api.update('categories', { id: c.id }, { active: v }); return true })) q.reload() }} /></span> },
        ]} />
      {edit && <CatDrawer key={edit.id} init={edit} isNew={isNew} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); q.reload() }} />}
    </>
  )
}

function CatDrawer({ init, isNew, onClose, onSaved }: { init: Category; isNew: boolean; onClose: () => void; onSaved: () => void }) {
  const api = useApi()
  const { run } = useToast()
  const [c, setC] = useState(init)
  const [busy, setBusy] = useState(false)
  const bad = !c.name.trim()
  return (
    <Drawer open onClose={onClose} eyebrow={isNew ? 'New category' : 'Edit category'} title={c.name || 'Untitled'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy || bad} onClick={async () => { setBusy(true); const ok = await run(async () => { await api.upsert('categories', { ...c, slug: c.slug.trim() || slugify(c.name) }, 'id'); return true }, 'Category saved'); setBusy(false); if (ok) onSaved() }}>Save</Button></>}>
      <div className="space-y-3">
        <TextField label="Name" required value={c.name} onChange={(e) => setC({ ...c, name: e.target.value, slug: isNew ? slugify(e.target.value) : c.slug })} />
        <TextField label="Slug" value={c.slug} onChange={(e) => setC({ ...c, slug: slugify(e.target.value) })} />
        <TextArea label="Short description" value={c.blurb ?? ''} onChange={(e) => setC({ ...c, blurb: e.target.value })} />
        <ImageInput label="Image" value={c.image_url} onChange={(u) => setC({ ...c, image_url: u })} />
        <Toggle label="Active" checked={c.active} onChange={(v) => setC({ ...c, active: v })} />
      </div>
    </Drawer>
  )
}
