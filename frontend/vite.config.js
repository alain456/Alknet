import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv lit .env* ; process.env couvre aussi docker-compose (VITE_API_PROXY)
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY || process.env.VITE_API_PROXY || 'http://localhost:8000'

  return {
    plugins: [react()],
    server: {
      host: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          timeout: 120000,
          proxyTimeout: 120000,
        },
      },
    },
  }
})
