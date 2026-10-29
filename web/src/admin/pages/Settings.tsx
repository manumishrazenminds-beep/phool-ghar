import { useEffect, useState } from 'react'
import { useSettings } from '../settings'
import { Button, ErrorBanner, PageHeader, Panel, Skeleton, TextField, useToast } from '../ui'

export default function Settings() {
  const { run } = useToast()
  const s = useSettings()
  const [name, setName] = useState('')
  const [gst, setGst] = useState('')
  const [wa, setWa] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!s.data) return
    setName(String(s.values.store_name ?? '')); setGst(s.values.gst_percent != null ? String(s.values.gst_percent) : ''); setWa(String(s.values.support_whatsapp ?? ''))
  }, [s.data]) // eslint-disable-line react-hooks/exhaustive-deps
  const g = Number(gst)
  const err = gst !== '' && (!(g >= 0) || g > 28) ? 'GST percent must be between 0 and 28.' : wa && !/^\d{10,15}$/.test(wa.replace(/\D/g, '')) ? 'Enter the WhatsApp number with country code, digits only.' : null
  return (
    <>
      <PageHeader eyebrow="Store" title="Settings">Shown on invoices and in customer messages. Delivery times, fees and the cut-off live under Delivery settings.</PageHeader>
      {s.error && <ErrorBanner message={s.error} onRetry={s.reload} />}
      {s.loading && !s.data ? <Skeleton rows={3} /> : (
        <Panel title="Store profile" className="max-w-2xl">
          <div className="space-y-4">
            <TextField label="Store name" value={name} onChange={(e) => setName(e.target.value)} />
            <TextField label="GST percent" type="number" min="0" max="28" step="0.5" value={gst} onChange={(e) => setGst(e.target.value)} hint="Included in prices. Shown as a separate line on invoices." />
            <TextField label="Support WhatsApp number" inputMode="tel" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="919820011000" hint="With country code, no plus sign or spaces. Customers tap this for help." error={err ?? undefined} />
            <Button variant="primary" disabled={busy || !!err || !name.trim()} onClick={async () => { setBusy(true); await run(() => s.save({ store_name: name.trim(), gst_percent: gst === '' ? 0 : g, support_whatsapp: wa.replace(/\D/g, '') }), 'Settings saved'); setBusy(false) }}>Save settings</Button>
          </div>
        </Panel>
      )}
    </>
  )
}
