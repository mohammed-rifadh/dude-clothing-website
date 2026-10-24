
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_BASE_URL
    ? new URL(env.VITE_API_BASE_URL).origin
    : null

  return {
    plugins: [react(), tailwindcss()],
    ...(apiTarget && {
      server: {
        proxy: {
          '/api': {
            target: apiTarget,
            changeOrigin: true,
            secure: false,
          },
        },
      },
    }),
  }
})
