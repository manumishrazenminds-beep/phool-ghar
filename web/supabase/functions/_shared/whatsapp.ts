// WhatsApp helpers.
//  (a) Cloud API sender, used ONLY when WHATSAPP_TOKEN and WHATSAPP_PHONE_ID are set.
//  (b) wa.me click-to-chat link builder for the free tier (no API, a human taps send).
//  (c) SMS adapter stub behind SMS_ENABLED (DLT registration is paid, so no provider is wired).
import { fetchWithRetry, type SendResult } from './email.ts'

// deno-lint-ignore no-explicit-any
const env = (k: string): string => ((globalThis as any).Deno?.env?.get(k) ?? '').trim()

/**
 * Normalise a phone number to digits with country code, default India (91).
 * '98765 43210' -> '919876543210', '+91 98765 43210' -> '919876543210', '09876543210' -> '919876543210'.
 * Returns null if it does not look like a phone number (11 to 15 digits after normalising).
 */
export function normalizePhone(input: unknown, defaultCountry = '91'): string | null {
  let d = String(input ?? '').replace(/[^\d]/g, '')
  if (!d) return null
  if (d.startsWith('00')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('0')) d = defaultCountry + d.slice(1)
  else if (d.length === 10) d = defaultCountry + d
  if (d.length < 11 || d.length > 15) return null
  return d
}

/** wa.me click-to-chat link. Returns null when the phone is unusable. */
export function buildWaLink(phone: unknown, text?: string): string | null {
  const p = normalizePhone(phone)
  if (!p) return null
  return `https://wa.me/${p}` + (text ? `?text=${encodeURIComponent(text)}` : '')
}

export function whatsappCloudConfigured(): boolean {
  return !!env('WHATSAPP_TOKEN') && !!env('WHATSAPP_PHONE_ID')
}

export interface WhatsAppInput {
  to: unknown
  text: string
  /** Approved template name, used when WHATSAPP_USE_TEMPLATES=true (business-initiated messages need one). */
  templateName?: string
  language?: string
}

/**
 * Cloud API send. Business-initiated messages outside the 24h window must use an approved template:
 * set WHATSAPP_USE_TEMPLATES=true and create templates named "pg_<template_key>" (e.g. pg_order_confirmed)
 * with ONE body variable {{1}}; this sender passes the rendered WhatsApp text as that variable.
 */
export async function sendWhatsAppCloud(input: WhatsAppInput): Promise<SendResult> {
  const token = env('WHATSAPP_TOKEN')
  const phoneId = env('WHATSAPP_PHONE_ID')
  if (!token || !phoneId) return { ok: false, retryable: false, error: 'WhatsApp Cloud API not configured' }
  const to = normalizePhone(input.to)
  if (!to) return { ok: false, retryable: false, error: 'Invalid WhatsApp number' }
  const version = env('WHATSAPP_API_VERSION') || 'v21.0'
  const useTemplates = env('WHATSAPP_USE_TEMPLATES').toLowerCase() === 'true'
  const body = useTemplates && input.templateName
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: `pg_${input.templateName}`,
          language: { code: input.language || env('WHATSAPP_TEMPLATE_LANG') || 'en' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: input.text.replace(/\s*\n\s*/g, ' ').slice(0, 1000) }] }],
        },
      }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: input.text.slice(0, 4000), preview_url: true } }
  try {
    const res = await fetchWithRetry(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const raw = await res.text()
    if (res.ok) {
      let id: string | undefined
      try {
        id = JSON.parse(raw)?.messages?.[0]?.id
      } catch { /* ignore */ }
      return { ok: true, id }
    }
    const retryable = res.status === 408 || res.status === 429 || res.status >= 500
    return { ok: false, retryable, error: `WhatsApp ${res.status}: ${raw.slice(0, 300)}` }
  } catch (e) {
    return { ok: false, retryable: true, error: `WhatsApp request failed: ${(e as Error).message}` }
  }
}

export function smsEnabled(): boolean {
  return env('SMS_ENABLED').toLowerCase() === 'true'
}

/** SMS stub. Disabled by default; when enabled there is no provider yet, so it fails permanently with a clear message. */
export function sendSms(_to: unknown, _text: string): Promise<SendResult> {
  if (!smsEnabled()) return Promise.resolve({ ok: true, skipped: 'sms_disabled' })
  return Promise.resolve({ ok: false, retryable: false, error: 'SMS_ENABLED is true but no SMS provider adapter is implemented (DLT registration required)' })
}
