import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv lit .env* ; process.env couvre aussi docker-compose (VITE_API_PROXY)
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY || process.env.VITE_API_PROXY || 'http://localhost:8000'
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://www.svgrepo.com https://tile.openstreetmap.org https://images.unsplash.com",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss: http: https:",
    "object-src 'none'",
    "frame-src 'self' blob: https://www.openstreetmap.org https://www.google.com",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ')

  return {
    plugins: [react()],
    server: {
      host: true,
      allowedHosts: true,
      headers: { 'Content-Security-Policy': csp },
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          timeout: 120000,
          proxyTimeout: 120000,
        },
        '/media': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      headers: {
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https://www.svgrepo.com https://tile.openstreetmap.org https://images.unsplash.com",
          "font-src 'self' data:",
          "connect-src 'self'",
          "object-src 'none'",
          "frame-src 'self' blob: https://www.openstreetmap.org https://www.google.com",
          "base-uri 'self'",
          "frame-ancestors 'none'",
          "form-action 'self'",
        ].join('; '),
      },
    },
  }
})
