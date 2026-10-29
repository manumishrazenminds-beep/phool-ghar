import { RequireAuth } from '../auth/RequireAuth'
import { CheckoutFlow } from '../checkout/CheckoutFlow'
import { PageShell } from '../lib/ui'

export default function Checkout() {
  return (
    <RequireAuth what="Checkout">
      <PageShell eyebrow="Checkout" title={<>Almost <em>there</em></>}>
        <CheckoutFlow />
      </PageShell>
    </RequireAuth>
  )
}
