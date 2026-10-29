import { ImageSquare } from '@phosphor-icons/react'
import { useId, useState } from 'react'
import { useApi } from './mode'
import { Button, useToast } from './ui'

/** Uploads to the product-images bucket (or makes a local preview in demo mode) and reports the public URL. */
export function ImageInput({ label, value, onChange }: { label: string; value: string | null; onChange: (url: string | null) => void }) {
  const api = useApi()
  const { run } = useToast()
  const id = useId()
  const [busy, setBusy] = useState(false)
  const pick = async (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith('image/')) { await run(async () => { throw new Error('Choose an image file (JPG, PNG or WebP).') }); return }
    if (f.size > 5 * 1024 * 1024) { await run(async () => { throw new Error('That image is over 5 MB. Resize it and try again.') }); return }
    setBusy(true)
    const url = await run(() => api.uploadImage(f), 'Image uploaded')
    setBusy(false)
    if (url) onChange(url)
  }
  return (
    <div>
      <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">{label}</span>
      <div className="flex items-center gap-3">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-ink/10 bg-cream-2/50">
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImageSquare size={28} className="text-ink-soft/50" aria-hidden />}
        </div>
        <div className="flex flex-wrap gap-2">
          <label htmlFor={id} className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-ink/15 bg-white px-3 text-sm hover:border-ink/40 focus-within:outline-2 pointer-coarse:min-h-11">
            {busy ? 'Uploading...' : value ? 'Replace' : 'Upload'}
            <input id={id} type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {value && <Button size="sm" variant="quiet" onClick={() => onChange(null)}>Remove</Button>}
        </div>
      </div>
    </div>
  )
}
