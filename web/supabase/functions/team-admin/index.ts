// Edge Function: team-admin (admin JWT only). Ops via POST { op, ... }:
//   list | create | update | deactivate | reactivate | reset_password
// Manages profiles with role 'staff' or 'delivery' plus a permissions array. Adapted from the Legopolis
// team-admin. Guard rails:
//  * only an active admin can call it; customers can never be targeted (no account-takeover primitive)
//  * creating an admin, promoting to admin, or touching/demoting/deactivating another admin needs allow_admin: true
//  * you can never change your own role/active, and the last active admin can never be removed
//  * passwords are never returned or logged; invite/reset links are delivered through the outbox (email)
import { preflight } from '../_shared/cors.ts'
import { fail, failFromError, HttpError, ok, readJson } from '../_shared/http.ts'
import { requireRole } from '../_shared/auth.ts'
import { readEnv } from '../_shared/env.ts'
import { enforceRateLimit } from '../_shared/ratelimit.ts'
import { serviceClient, type Db } from '../_shared/supabase.ts'
import { asObject, RE, reqStr, str } from '../_shared/validate.ts'
import { logApp } from '../notify-dispatch/lib.ts'

const PERMISSIONS = ['orders', 'products', 'stock', 'subscriptions', 'customers', 'coupons', 'reports', 'settings', 'team'] as const
const TEAM_ROLES = ['staff', 'delivery']
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/
const MIN_PASSWORD = 10

interface Profile { id: string; role: string; full_name: string | null; phone: string | null; email: string | null; permissions: string[]; active: boolean }
const PROFILE_COLS = 'id, role, full_name, phone, email, permissions, active, created_at'

function bad(msg: string): never {
  throw new HttpError(400, 'invalid_input', msg)
}

export function parsePermissions(v: unknown, role: string): string[] {
  if (role === 'delivery') return []
  if (v === undefined || v === null) return []
  if (!Array.isArray(v)) bad('permissions: must be an array')
  const out = [...new Set((v as unknown[]).map((x) => String(x)))]
  const unknown = out.filter((p) => !(PERMISSIONS as readonly string[]).includes(p))
  if (unknown.length) bad(`permissions: unknown value(s) ${unknown.join(', ')}`)
  return out
}

function randomPassword(): string {
  const b = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...b)).replace(/[^A-Za-z0-9]/g, 'x') + 'aA1!'
}

async function getTarget(db: Db, id: string): Promise<Profile> {
  const { data, error } = await db.from('profiles').select(PROFILE_COLS).eq('id', id).maybeSingle()
  if (error) throw new HttpError(503, 'lookup_failed', 'Could not load that account')
  if (!data || !['admin', 'staff', 'delivery'].includes(data.role)) throw new HttpError(404, 'not_found', 'No team member with that id')
  return data as Profile
}

function needAdminFlag(target: Profile, allowAdmin: boolean) {
  if (target.role === 'admin' && !allowAdmin) {
    throw new HttpError(403, 'admin_protected', 'This is an admin account. Repeat the request with allow_admin: true to confirm')
  }
}

async function otherActiveAdmins(db: Db, excludeId: string): Promise<number> {
  const { count } = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('active', true).neq('id', excludeId)
  return count ?? 0
}

async function sendLink(db: Db, target: { id: string; email: string; full_name: string | null; role: string }, kind: 'invite' | 'reset', invitedBy: string | null): Promise<boolean> {
  const site = (readEnv('SITE_URL') ?? '').replace(/\/+$/, '')
  const { data, error } = await db.auth.admin.generateLink({ type: 'recovery', email: target.email, options: site ? { redirectTo: `${site}/reset-password` } : undefined })
  const link: string | undefined = data?.properties?.action_link
  if (error || !link) {
    await logApp(db, 'error', 'team-admin', 'link_failed', error?.message ?? 'no link returned', { id: target.id })
    return false
  }
  const { error: qErr } = await db.rpc('enqueue_notification', {
    p_user: target.id,
    p_channel: 'email',
    p_template: 'staff_invited',
    p_to: target.email,
    p_payload: { name: (target.full_name ?? '').split(' ')[0] || 'there', role: target.role, invite_url: link, invited_by: invitedBy ?? undefined, reset: kind === 'reset' },
    p_dedupe: `staff_invited:${target.id}:${kind}:${Math.floor(Date.now() / 60000)}`,
  })
  if (qErr) {
    await logApp(db, 'error', 'team-admin', 'enqueue_failed', qErr.message, { id: target.id })
    return false
  }
  return true
}

async function audit(db: Db, actor: string, action: string, entityId: string, detail: Record<string, unknown>) {
  try {
    await db.from('audit_log').insert({ actor_id: actor, action: `team.${action}`, entity: 'profiles', entity_id: entityId, detail })
  } catch { /* best effort */ }
}

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return fail(req, 405, 'method_not_allowed', 'Use POST')
  try {
    const caller = await requireRole(req, ['admin'])
    const db = serviceClient()
    await enforceRateLimit(db, req, { scope: 'team-admin', userId: caller.userId, user: { max: 30, windowSec: 60 }, ip: { max: 60, windowSec: 60 }, onError: (e) => console.warn('rate limiter error', e) })
    const body = asObject(await readJson(req, 8 * 1024))
    const op = reqStr(body.op, 'op', { max: 32 })
    const allowAdmin = body.allow_admin === true

    switch (op) {
      case 'list': {
        const { data, error } = await db.from('profiles').select(PROFILE_COLS).in('role', ['admin', 'staff', 'delivery']).order('created_at', { ascending: true }).limit(500)
        if (error) throw new HttpError(503, 'lookup_failed', 'Could not load the team')
        return ok(req, { members: data ?? [] })
      }

      case 'create': {
        const email = reqStr(body.email, 'email', { max: 254 }).toLowerCase()
        if (!EMAIL_RE.test(email)) bad('email: invalid address')
        const fullName = reqStr(body.full_name, 'full_name', { min: 2, max: 80 })
        const phone = str(body.phone, 'phone', { optional: true, max: 20, re: /^[0-9+\-\s()]{7,20}$/ }) ?? null
        const role = reqStr(body.role, 'role', { max: 16 })
        if (role === 'admin') {
          if (!allowAdmin) throw new HttpError(403, 'admin_protected', 'Creating an admin needs allow_admin: true')
        } else if (!TEAM_ROLES.includes(role)) bad('role: must be staff or delivery')
        const permissions = role === 'admin' ? [] : parsePermissions(body.permissions, role)
        const supplied = str(body.password, 'password', { optional: true, max: 128 })
        if (supplied !== undefined && supplied.length < MIN_PASSWORD) bad(`password: must be at least ${MIN_PASSWORD} characters`)

        const { data: created, error } = await db.auth.admin.createUser({ email, password: supplied ?? randomPassword(), email_confirm: true, user_metadata: { full_name: fullName } })
        if (error || !created?.user) {
          if (/already|registered|exists/i.test(error?.message ?? '')) throw new HttpError(409, 'email_taken', 'An account with this email already exists')
          await logApp(db, 'error', 'team-admin', 'create_failed', error?.message ?? 'unknown')
          throw new HttpError(502, 'create_failed', 'Could not create the account')
        }
        const id = created.user.id
        const { error: pErr } = await db.from('profiles').upsert({ id, email, full_name: fullName, phone, role, permissions, active: true }, { onConflict: 'id' })
        if (pErr) {
          await db.auth.admin.deleteUser(id).catch(() => {}) // roll back so we never leave a login without a profile
          await logApp(db, 'error', 'team-admin', 'profile_failed', pErr.message)
          throw new HttpError(502, 'create_failed', 'Could not create the profile')
        }
        const invited = supplied ? false : await sendLink(db, { id, email, full_name: fullName, role }, 'invite', caller.profile.full_name)
        await audit(db, caller.userId, 'create', id, { role, permissions, invited })
        return ok(req, { id, email, full_name: fullName, phone, role, permissions, active: true, invite_sent: invited }, 201)
      }

      case 'update': {
        const id = reqStr(body.id, 'id', { re: RE.uuid })
        const target = await getTarget(db, id)
        needAdminFlag(target, allowAdmin)
        const patch: Record<string, unknown> = {}
        if (body.full_name !== undefined) patch.full_name = reqStr(body.full_name, 'full_name', { min: 2, max: 80 })
        if (body.phone !== undefined) patch.phone = body.phone === null || body.phone === '' ? null : str(body.phone, 'phone', { max: 20, re: /^[0-9+\-\s()]{7,20}$/ })
        let role = target.role
        if (body.role !== undefined) {
          const r = reqStr(body.role, 'role', { max: 16 })
          if (r === 'admin') {
            if (!allowAdmin) throw new HttpError(403, 'admin_protected', 'Promoting to admin needs allow_admin: true')
          } else if (!TEAM_ROLES.includes(r)) bad('role: must be staff or delivery')
          if (r !== target.role) {
            if (id === caller.userId) throw new HttpError(403, 'self_change', 'You cannot change your own role')
            if (target.role === 'admin' && (await otherActiveAdmins(db, id)) === 0) throw new HttpError(409, 'last_admin', 'Cannot demote the last active admin')
            patch.role = r
            role = r
          }
        }
        if (body.permissions !== undefined) patch.permissions = role === 'admin' ? [] : parsePermissions(body.permissions, role)
        else if (patch.role === 'delivery') patch.permissions = []
        if (body.active !== undefined) {
          if (typeof body.active !== 'boolean') bad('active: must be a boolean')
          if (id === caller.userId && body.active === false) throw new HttpError(403, 'self_change', 'You cannot deactivate yourself')
          if (target.role === 'admin' && body.active === false && (await otherActiveAdmins(db, id)) === 0) throw new HttpError(409, 'last_admin', 'Cannot deactivate the last active admin')
          patch.active = body.active
        }
        if (!Object.keys(patch).length) bad('nothing to update')
        const { data, error } = await db.from('profiles').update(patch).eq('id', id).select(PROFILE_COLS).maybeSingle()
        if (error || !data) throw new HttpError(502, 'update_failed', 'Could not update the account')
        if (patch.active !== undefined) await db.auth.admin.updateUserById(id, { ban_duration: patch.active ? 'none' : '876000h' })
        await audit(db, caller.userId, 'update', id, { changed: Object.keys(patch), role: patch.role, active: patch.active })
        return ok(req, data)
      }

      case 'deactivate':
      case 'reactivate': {
        const id = reqStr(body.id, 'id', { re: RE.uuid })
        const active = op === 'reactivate'
        const target = await getTarget(db, id)
        needAdminFlag(target, allowAdmin)
        if (!active) {
          if (id === caller.userId) throw new HttpError(403, 'self_change', 'You cannot deactivate yourself')
          if (target.role === 'admin' && (await otherActiveAdmins(db, id)) === 0) throw new HttpError(409, 'last_admin', 'Cannot deactivate the last active admin')
        }
        const { data, error } = await db.from('profiles').update({ active }).eq('id', id).select(PROFILE_COLS).maybeSingle()
        if (error || !data) throw new HttpError(502, 'update_failed', 'Could not update the account')
        // ban_duration also kills future sign-ins at the auth layer, not only in RLS
        await db.auth.admin.updateUserById(id, { ban_duration: active ? 'none' : '876000h' })
        await audit(db, caller.userId, op, id, {})
        return ok(req, data)
      }

      case 'reset_password': {
        const id = reqStr(body.id, 'id', { re: RE.uuid })
        const target = await getTarget(db, id)
        needAdminFlag(target, allowAdmin)
        const password = str(body.password, 'password', { optional: true, max: 128 })
        if (password !== undefined) {
          if (password.length < MIN_PASSWORD) bad(`password: must be at least ${MIN_PASSWORD} characters`)
          const { error } = await db.auth.admin.updateUserById(id, { password })
          if (error) throw new HttpError(502, 'reset_failed', 'Could not set the password')
          await audit(db, caller.userId, 'reset_password', id, { method: 'set' })
          return ok(req, { id, method: 'set' })
        }
        if (!target.email) throw new HttpError(409, 'no_email', 'This account has no email address')
        const sent = await sendLink(db, { id, email: target.email, full_name: target.full_name, role: target.role }, 'reset', caller.profile.full_name)
        if (!sent) throw new HttpError(502, 'reset_failed', 'Could not queue the reset email')
        await audit(db, caller.userId, 'reset_password', id, { method: 'email' })
        return ok(req, { id, method: 'email' })
      }

      default:
        throw new HttpError(400, 'unknown_op', 'op must be list, create, update, deactivate, reactivate or reset_password')
    }
  } catch (e) {
    if (e instanceof HttpError) return failFromError(req, e)
    try {
      await logApp(serviceClient(), 'error', 'team-admin', 'unhandled', (e as Error).message)
    } catch { /* ignore */ }
    return fail(req, 500, 'internal_error', 'Team action failed')
  }
})
