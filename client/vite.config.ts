
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
