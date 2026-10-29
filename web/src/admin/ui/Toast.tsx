import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import clsx from 'clsx'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { readableError } from '../format'

interface T { id: number; text: string; kind: 'ok' | 'error' }
interface Ctx { toast: (text: string, kind?: 'ok' | 'error') => void; run: <R>(fn: () => Promise<R>, okText?: string) => Promise<R | undefined> }
const C = createContext<Ctx | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([])
  const n = useRef(0)
  const toast = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = ++n.current
    setItems((x) => [...x, { id, text, kind }])
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), kind === 'error' ? 9000 : 3500)
  }, [])
  const run = useCallback(async <R,>(fn: () => Promise<R>, okText?: string) => {
    try {
      const r = await fn()
      if (okText) toast(okText)
      return r
    } catch (e) {
      toast(readableError(e), 'error')
      return undefined
    }
  }, [toast])
  const value = useMemo(() => ({ toast, run }), [toast, run])
  return (
    <C.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[400] flex flex-col items-center gap-2 px-4 print:hidden" role="status" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={clsx('pointer-events-auto flex max-w-lg items-start gap-2 rounded-xl px-4 py-3 text-sm shadow-lg', i.kind === 'ok' ? 'bg-ink text-cream' : 'bg-rose text-white')}>
            {i.kind === 'ok' ? <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden /> : <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden />}
            <span className="break-words">{i.text}</span>
          </div>
        ))}
      </div>
    </C.Provider>
  )
}
export function useToast() {
  const c = useContext(C)
  if (!c) throw new Error('ToastProvider missing')
  return c
}
