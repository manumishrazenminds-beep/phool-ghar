import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile, Role } from '../lib/api'

export interface AuthCtx {
  /** false when Supabase env is missing; auth UI shows a "not connected" state */
  configured: boolean
  loading: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  role: Role | null
  signInPassword: (email: string, password: string) => Promise<void>
  signUp: (p: { email: string; password: string; fullName: string; phone?: string }) => Promise<{ needsConfirm: boolean }>
  sendEmailCode: (email: string, next?: string) => Promise<void>
  verifyEmailCode: (email: string, token: string) => Promise<void>
  signInGoogle: (next?: string) => Promise<void>
  sendPhoneCode: (phone: string) => Promise<void>
  verifyPhoneCode: (phone: string, token: string) => Promise<void>
  sendReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  /** true while the user arrived via a password-recovery link */
  recovering: boolean
}

export const AuthContext = createContext<AuthCtx | null>(null)
