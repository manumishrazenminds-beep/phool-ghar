/** Single place that reads public (browser-safe) env. Secrets never live here. */
export const env = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '',
  supabaseKey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? '',
  razorpayKeyId: (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined) ?? '',
  whatsappNumber: (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) ?? '',
  /** Raster tile URL template for the delivery map. Defaults to OpenStreetMap (no key, light use). */
  mapTilesUrl: (import.meta.env.VITE_MAP_TILES_URL as string | undefined) || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  mapAttribution: (import.meta.env.VITE_MAP_ATTRIBUTION as string | undefined) || '&copy; OpenStreetMap contributors',
  /** 'supabase' once the backend is configured; otherwise the site runs on static mock data. */
  provider: ((import.meta.env.VITE_DATA_PROVIDER as string | undefined) ?? 'mock') as 'mock' | 'supabase',
}

export const backendConfigured = Boolean(env.supabaseUrl && env.supabaseKey && env.provider === 'supabase')
