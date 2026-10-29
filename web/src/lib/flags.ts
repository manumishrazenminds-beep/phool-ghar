/** Feature flags read from public env. Phone OTP stays off by default because SMS is paid. */
export const flags = {
  phoneOtp: (import.meta.env.VITE_PHONE_AUTH_ENABLED as string | undefined) === 'true',
  googleAuth: (import.meta.env.VITE_GOOGLE_AUTH_ENABLED as string | undefined) !== 'false',
}
