// Notification templates for Phool Ghar. Pure module (no Deno APIs) so it can be unit-tested under node.
// renderTemplate(key, payload, ctx) returns the email (subject/html/text), a WhatsApp text and the
// in-app notification (title/body) for one template key from docs/BACKEND_CONTRACT.md.
// Layout is table-based with inline styles, 600px max, mobile safe, no web fonts, no images, no emoji.

export const COLORS = {
  cream: '#fbf5ea',
  ink: '#1f1a17',
  marigold: '#e8731a',
  leaf: '#1f3d2b',
  rose: '#7a1f45',
  muted: '#6b6259',
  card: '#fffdf8',
  line: '#eadfca',
} as const

export const TEMPLATE_KEYS = [
  'order_placed',
  'payment_success',
  'payment_failed',
  'order_confirmed',
  'order_preparing',
  'order_out_for_delivery',
  'order_delivered',
  'order_cancelled',
  'refund_processed',
  'subscription_started',
  'delivery_reminder',
  'subscription_skipped',
  'subscription_paused',
  'subscription_resumed',
  'subscription_cancelled',
  'plan_ending_soon',
  'plan_renewal_link',
  'welcome',
  'staff_invited',
] as const

export type TemplateKey = (typeof TEMPLATE_KEYS)[number]

export function isTemplateKey(k: unknown): k is TemplateKey {
  return typeof k === 'string' && (TEMPLATE_KEYS as readonly string[]).includes(k)
}

export interface RenderCtx {
  siteUrl: string // e.g. https://phoolghar.in (no trailing slash needed)
  storeName: string
  supportWhatsapp?: string // digits or free text phone, optional
}

export interface Rendered {
  subject: string
  html: string
  text: string
  whatsapp: string
  inapp: { title: string; body: string; type: string }
}

type Payload = Record<string, unknown>

interface Spec {
  subject: string
  title: string // heading inside the email and in-app title
  lines: string[] // paragraphs (plain text)
  facts?: Array<[string, string]>
  cta?: { label: string; path: string }
  tone?: 'default' | 'alert'
  wa: string // WhatsApp text (WhatsApp markup allowed: *bold*)
  inapp: string // short in-app body
}

export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatRupees(paise: unknown): string {
  const n = Number(paise)
  if (!Number.isFinite(n)) return ''
  const rupees = Math.round(n) / 100
  const whole = Number.isInteger(rupees)
  return 'Rs. ' + rupees.toLocaleString('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** 'YYYY-MM-DD' to 'Sat, 24 Oct 2026'. Returns the input unchanged if it does not parse. */
export function formatDate(d: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d ?? ''))
  if (!m) return String(d ?? '')
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return `${DAYS[dt.getUTCDay()]}, ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`
}

const str = (v: unknown, fallback = ''): string => {
  const s = v === null || v === undefined ? '' : String(v).trim()
  return s || fallback
}

function absUrl(siteUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return siteUrl.replace(/\/+$/, '') + (path.startsWith('/') ? path : '/' + path)
}

function buildSpec(key: TemplateKey, p: Payload, ctx: RenderCtx): Spec {
  const store = ctx.storeName
  const name = str(p.name, 'there')
  const orderNo = str(p.order_no)
  const orderRef = orderNo ? `order ${orderNo}` : 'your order'
  const orderRefCap = orderNo ? `Order ${orderNo}` : 'Your order'
  const amount = p.amount_paise !== undefined ? formatRupees(p.amount_paise) : ''
  const date = p.delivery_date ? formatDate(p.delivery_date) : ''
  const slot = str(p.slot_label)
  const product = str(p.product_name, 'your flowers')
  const orderPath = p.order_id ? `/account/orders/${encodeURIComponent(str(p.order_id))}` : '/account/orders'
  const subsPath = '/account/subscriptions'
  const reason = str(p.reason)

  const orderFacts: Array<[string, string]> = []
  if (orderNo) orderFacts.push(['Order', orderNo])
  if (amount) orderFacts.push(['Amount', amount])
  if (date) orderFacts.push(['Delivery date', date])
  if (slot) orderFacts.push(['Time slot', slot])

  switch (key) {
    case 'order_placed':
      return {
        subject: `We received ${orderRef}`,
        title: 'Order received',
        lines: [`Hello ${name}, thank you for your order. We will confirm it as soon as payment clears.`],
        facts: orderFacts,
        cta: { label: 'View order', path: orderPath },
        wa: `Hello ${name}, we received ${orderRef}${amount ? ` (${amount})` : ''}. We will confirm shortly. - ${store}`,
        inapp: `${orderRefCap} has been received.`,
      }
    case 'payment_success':
      return {
        subject: `Payment received${orderNo ? ' for ' + orderNo : ''}`,
        title: 'Payment received',
        lines: [`Hello ${name}, we have received your payment${amount ? ' of ' + amount : ''}. Thank you.`],
        facts: orderFacts,
        cta: { label: 'View order', path: orderPath },
        wa: `Hello ${name}, payment${amount ? ' of ' + amount : ''} received for ${orderRef}. Thank you. - ${store}`,
        inapp: `Payment${amount ? ' of ' + amount : ''} received.`,
      }
    case 'payment_failed':
      return {
        subject: `Payment did not go through${orderNo ? ' for ' + orderNo : ''}`,
        title: 'Payment failed',
        lines: [
          `Hello ${name}, your payment could not be completed${reason ? ' (' + reason + ')' : ''}. No flowers have been reserved against it.`,
          'You can try again from your account. If money was debited, the bank normally reverses it within 5 to 7 working days.',
        ],
        facts: orderFacts,
        cta: { label: 'Try again', path: orderPath },
        tone: 'alert',
        wa: `Hello ${name}, the payment for ${orderRef} did not go through. Please try again from your account. - ${store}`,
        inapp: 'Your payment did not go through. Please try again.',
      }
    case 'order_confirmed':
      return {
        subject: `${orderRefCap} is confirmed`,
        title: 'Order confirmed',
        lines: [`Hello ${name}, ${orderRef} is confirmed. Our florists will start preparing it for delivery.`],
        facts: orderFacts,
        cta: { label: 'Track order', path: orderPath },
        wa: `Hello ${name}, ${orderRef} is confirmed${date ? ' for ' + date : ''}${slot ? ', ' + slot : ''}. - ${store}`,
        inapp: `${orderRefCap} is confirmed.`,
      }
    case 'order_preparing':
      return {
        subject: `${orderRefCap} is being prepared`,
        title: 'Being prepared',
        lines: [`Hello ${name}, your flowers are being freshly prepared for ${orderRef}.`],
        facts: orderFacts,
        cta: { label: 'Track order', path: orderPath },
        wa: `Hello ${name}, ${orderRef} is being freshly prepared. - ${store}`,
        inapp: `${orderRefCap} is being prepared.`,
      }
    case 'order_out_for_delivery':
      return {
        subject: `${orderRefCap} is out for delivery`,
        title: 'Out for delivery',
        lines: [`Hello ${name}, ${orderRef} is on its way to you${slot ? ' in the ' + slot + ' slot' : ''}.`, ...(p.delivery_person ? [`Delivered by ${str(p.delivery_person)}.`] : [])],
        facts: orderFacts,
        cta: { label: 'Track order', path: orderPath },
        wa: `Hello ${name}, ${orderRef} is out for delivery${slot ? ' (' + slot + ')' : ''}. - ${store}`,
        inapp: `${orderRefCap} is out for delivery.`,
      }
    case 'order_delivered':
      return {
        subject: `${orderRefCap} was delivered`,
        title: 'Delivered',
        lines: [`Hello ${name}, ${orderRef} has been delivered. We hope it brightens your day.`, 'If anything is not right, reply to this email or contact support and we will make it right.'],
        facts: orderFacts,
        cta: { label: 'Leave a review', path: orderPath },
        wa: `Hello ${name}, ${orderRef} was delivered. Thank you for choosing ${store}.`,
        inapp: `${orderRefCap} was delivered.`,
      }
    case 'order_cancelled':
      return {
        subject: `${orderRefCap} was cancelled`,
        title: 'Order cancelled',
        lines: [`Hello ${name}, ${orderRef} has been cancelled${reason ? ': ' + reason : ''}.`, 'If you paid online, your refund will be started automatically and you will get a separate confirmation.'],
        facts: orderFacts,
        cta: { label: 'View order', path: orderPath },
        tone: 'alert',
        wa: `Hello ${name}, ${orderRef} was cancelled${reason ? ' (' + reason + ')' : ''}. Any payment will be refunded. - ${store}`,
        inapp: `${orderRefCap} was cancelled.`,
      }
    case 'refund_processed':
      return {
        subject: `Refund processed${amount ? ': ' + amount : ''}`,
        title: 'Refund processed',
        lines: [`Hello ${name}, we have processed your refund${amount ? ' of ' + amount : ''}${orderNo ? ' for order ' + orderNo : ''}.`, 'It usually reaches your original payment method within 5 to 7 working days.'],
        facts: orderFacts,
        cta: { label: 'View order', path: orderPath },
        wa: `Hello ${name}, your refund${amount ? ' of ' + amount : ''} has been processed. It may take 5 to 7 working days to show. - ${store}`,
        inapp: `Refund${amount ? ' of ' + amount : ''} processed.`,
      }
    case 'subscription_started': {
      const facts: Array<[string, string]> = [['Flowers', product]]
      if (p.plan_days) facts.push(['Plan', `${str(p.plan_days)} days`])
      if (p.start_date) facts.push(['Starts', formatDate(p.start_date)])
      if (p.end_date) facts.push(['Ends', formatDate(p.end_date)])
      if (slot) facts.push(['Time slot', slot])
      return {
        subject: 'Your daily flower plan has started',
        title: 'Your plan is active',
        lines: [`Hello ${name}, your subscription for ${product} is active. Fresh flowers will arrive on your chosen days.`, 'You can skip, pause or change a delivery until 9 PM the evening before.'],
        facts,
        cta: { label: 'Manage plan', path: subsPath },
        wa: `Hello ${name}, your ${product} plan is active${p.start_date ? ' from ' + formatDate(p.start_date) : ''}. Manage it any time in your account. - ${store}`,
        inapp: `Your ${product} plan is active.`,
      }
    }
    case 'delivery_reminder':
      return {
        subject: `Tomorrow: ${product} arrives${slot ? ' in the ' + slot + ' slot' : ''}`,
        title: 'Delivery tomorrow',
        lines: [
          `Hello ${name}, ${product} is scheduled for delivery tomorrow${date ? ' (' + date + ')' : ''}${slot ? ', ' + slot : ''}.`,
          'Please keep someone available to receive it. To skip a later delivery, do it in your account before 9 PM the evening before.',
        ],
        facts: orderFacts,
        cta: { label: 'Skip or manage deliveries', path: subsPath },
        wa: `Hello ${name}, reminder: ${product} arrives tomorrow${slot ? ' (' + slot + ')' : ''}. Manage deliveries: ${absUrl(ctx.siteUrl, subsPath)}`,
        inapp: `${product} arrives tomorrow${slot ? ', ' + slot : ''}.`,
      }
    case 'subscription_skipped':
      return {
        subject: 'Delivery skipped',
        title: 'Delivery skipped',
        lines: [`Hello ${name}, we have skipped ${product}${p.skip_date ? ' on ' + formatDate(p.skip_date) : ''}.`, ...(p.end_date ? [`Your plan now ends on ${formatDate(p.end_date)}, so you do not lose a delivery.`] : [])],
        cta: { label: 'Manage plan', path: subsPath },
        wa: `Hello ${name}, ${product} is skipped${p.skip_date ? ' on ' + formatDate(p.skip_date) : ''}. Your plan end date moves forward. - ${store}`,
        inapp: `Delivery skipped${p.skip_date ? ' on ' + formatDate(p.skip_date) : ''}.`,
      }
    case 'subscription_paused':
      return {
        subject: 'Your plan is paused',
        title: 'Plan paused',
        lines: [`Hello ${name}, your ${product} plan is paused${p.paused_from ? ' from ' + formatDate(p.paused_from) : ''}${p.paused_to ? ' to ' + formatDate(p.paused_to) : ''}. No deliveries will be made in this period.`],
        cta: { label: 'Manage plan', path: subsPath },
        wa: `Hello ${name}, your ${product} plan is paused${p.paused_to ? ' until ' + formatDate(p.paused_to) : ''}. - ${store}`,
        inapp: 'Your plan is paused.',
      }
    case 'subscription_resumed':
      return {
        subject: 'Your plan has resumed',
        title: 'Plan resumed',
        lines: [`Hello ${name}, your ${product} plan is active again and deliveries continue on your chosen days.`],
        cta: { label: 'Manage plan', path: subsPath },
        wa: `Hello ${name}, your ${product} plan has resumed. - ${store}`,
        inapp: 'Your plan has resumed.',
      }
    case 'subscription_cancelled':
      return {
        subject: 'Your plan was cancelled',
        title: 'Plan cancelled',
        lines: [`Hello ${name}, your ${product} plan has been cancelled${reason ? ': ' + reason : ''}. We are sorry to see you go.`, 'You are welcome back any time.'],
        cta: { label: 'Browse flowers', path: '/' },
        tone: 'alert',
        wa: `Hello ${name}, your ${product} plan was cancelled. You are welcome back any time. - ${store}`,
        inapp: 'Your plan was cancelled.',
      }
    case 'plan_ending_soon':
      return {
        subject: 'Your flower plan ends soon',
        title: 'Plan ending soon',
        lines: [`Hello ${name}, your ${product} plan ends${p.end_date ? ' on ' + formatDate(p.end_date) : ' soon'}. Renew now to keep your mornings fresh without a break.`],
        cta: { label: 'Renew plan', path: str(p.renew_url, subsPath) },
        wa: `Hello ${name}, your ${product} plan ends${p.end_date ? ' on ' + formatDate(p.end_date) : ' soon'}. Renew: ${absUrl(ctx.siteUrl, str(p.renew_url, subsPath))}`,
        inapp: `Your plan ends${p.end_date ? ' on ' + formatDate(p.end_date) : ' soon'}.`,
      }
    case 'plan_renewal_link':
      return {
        subject: 'Renew your flower plan',
        title: 'Renew your plan',
        lines: [`Hello ${name}, use the button below to renew your ${product} plan in one step.`],
        cta: { label: 'Renew plan', path: str(p.renew_url, subsPath) },
        wa: `Hello ${name}, renew your ${product} plan here: ${absUrl(ctx.siteUrl, str(p.renew_url, subsPath))}`,
        inapp: 'Your renewal link is ready.',
      }
    case 'welcome':
      return {
        subject: `Welcome to ${store}`,
        title: `Welcome to ${store}`,
        lines: [`Hello ${name}, thank you for joining us. We deliver fresh flowers for pooja, home and gifting, one-time or daily.`, 'Add your address and choose your first bouquet whenever you are ready.'],
        cta: { label: 'Start shopping', path: '/' },
        wa: `Hello ${name}, welcome to ${store}. Fresh flowers, delivered. ${absUrl(ctx.siteUrl, '/')}`,
        inapp: `Welcome to ${store}.`,
      }
    case 'staff_invited': {
      const role = str(p.role, 'staff') === 'delivery' ? 'delivery partner' : 'team member'
      if (p.reset === true) {
        return {
          subject: `Reset your ${store} password`,
          title: 'Reset your password',
          lines: [`Hello ${name}, an administrator asked for a password reset on your ${store} account.`, 'Use the button below to choose a new password. The link works once and expires soon.'],
          cta: { label: 'Set new password', path: str(p.invite_url, '/login') },
          wa: `Hello ${name}, reset your ${store} password: ${absUrl(ctx.siteUrl, str(p.invite_url, '/login'))}`,
          inapp: 'Your password reset link was sent by email.',
        }
      }
      return {
        subject: `You have been invited to ${store}`,
        title: 'You are invited',
        lines: [
          `Hello ${name}, you have been added as a ${role} at ${store}${p.invited_by ? ' by ' + str(p.invited_by) : ''}.`,
          'Use the button below to set your password and sign in. The link works once and expires soon.',
        ],
        cta: { label: 'Set password', path: str(p.invite_url, '/login') },
        wa: `Hello ${name}, you have been added as a ${role} at ${store}. Set your password: ${absUrl(ctx.siteUrl, str(p.invite_url, '/login'))}`,
        inapp: `You were added as a ${role}.`,
      }
    }
  }
}

function renderHtml(spec: Spec, ctx: RenderCtx): string {
  const accent = spec.tone === 'alert' ? COLORS.rose : COLORS.marigold
  const serif = "Georgia,'Times New Roman',serif"
  const sans = "Helvetica,Arial,sans-serif"
  const paras = spec.lines
    .map((l) => `<p style="margin:0 0 14px;font-family:${sans};font-size:15px;line-height:24px;color:${COLORS.ink};">${escapeHtml(l)}</p>`)
    .join('')
  const facts = spec.facts?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;border-top:1px solid ${COLORS.line};">${spec.facts
        .map(
          ([k, v]) =>
            `<tr><td style="padding:9px 0;border-bottom:1px solid ${COLORS.line};font-family:${sans};font-size:13px;line-height:18px;color:${COLORS.muted};width:38%;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:9px 0;border-bottom:1px solid ${COLORS.line};font-family:${sans};font-size:14px;line-height:20px;color:${COLORS.ink};font-weight:bold;vertical-align:top;">${escapeHtml(v)}</td></tr>`,
        )
        .join('')}</table>`
    : ''
  const cta = spec.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 6px;"><tr><td align="center" bgcolor="${accent === COLORS.rose ? COLORS.rose : COLORS.marigold}" style="border-radius:6px;background:${accent};"><a href="${escapeHtml(absUrl(ctx.siteUrl, spec.cta.path))}" style="display:inline-block;padding:13px 26px;font-family:${sans};font-size:15px;font-weight:bold;line-height:20px;color:${accent === COLORS.rose ? '#ffffff' : COLORS.ink};text-decoration:none;border-radius:6px;">${escapeHtml(spec.cta.label)}</a></td></tr></table>`
    : ''
  const support = ctx.supportWhatsapp ? `Questions? WhatsApp us on ${escapeHtml(ctx.supportWhatsapp)}.` : 'Questions? Just reply to this email.'
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light"><title>${escapeHtml(spec.subject)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.cream};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLORS.cream};font-size:1px;line-height:1px;">${escapeHtml(spec.inapp)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.cream}" style="background:${COLORS.cream};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${COLORS.card};border:1px solid ${COLORS.line};border-radius:10px;">
<tr><td bgcolor="${COLORS.leaf}" style="background:${COLORS.leaf};padding:20px 28px;border-radius:10px 10px 0 0;font-family:${serif};font-size:24px;line-height:30px;color:${COLORS.cream};">${escapeHtml(ctx.storeName)}</td></tr>
<tr><td height="4" bgcolor="${accent}" style="background:${accent};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 8px;">
<h1 style="margin:0 0 16px;font-family:${serif};font-size:26px;line-height:32px;font-weight:normal;color:${COLORS.ink};">${escapeHtml(spec.title)}</h1>
${paras}${facts}${cta}
</td></tr>
<tr><td style="padding:18px 28px 26px;font-family:${sans};font-size:12px;line-height:18px;color:${COLORS.muted};">${support}<br>${escapeHtml(ctx.storeName)}. Fresh flowers, delivered.</td></tr>
</table></td></tr></table></body></html>`
}

function renderText(spec: Spec, ctx: RenderCtx): string {
  const out: string[] = [ctx.storeName.toUpperCase(), '', spec.title, '']
  out.push(...spec.lines.flatMap((l) => [l, '']))
  if (spec.facts?.length) out.push(...spec.facts.map(([k, v]) => `${k}: ${v}`), '')
  if (spec.cta) out.push(`${spec.cta.label}: ${absUrl(ctx.siteUrl, spec.cta.path)}`, '')
  out.push(ctx.supportWhatsapp ? `Questions? WhatsApp ${ctx.supportWhatsapp}.` : 'Questions? Just reply to this email.')
  return out.join('\n')
}

export function renderTemplate(key: TemplateKey, payload: Payload | null | undefined, ctx: RenderCtx): Rendered {
  const spec = buildSpec(key, payload ?? {}, ctx)
  return {
    subject: spec.subject,
    html: renderHtml(spec, ctx),
    text: renderText(spec, ctx),
    whatsapp: spec.wa,
    inapp: { title: spec.title, body: spec.inapp, type: key },
  }
}
