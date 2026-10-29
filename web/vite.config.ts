import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const site = (env.VITE_SITE_URL || env.SITE_URL || 'https://www.example.com').replace(/\/+$/, '')
  return {
    plugins: [
      react(),
      tailwindcss(),
      // index.html carries absolute canonical / Open Graph / JSON-LD URLs; fill the site origin at build time
      { name: 'site-url', transformIndexHtml: (html: string) => html.replaceAll('%VITE_SITE_URL%', site) },
    ],
  }
})
