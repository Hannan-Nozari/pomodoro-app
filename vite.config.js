import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Base path for Capacitor Android builds — keep as '/'
  base: '/',
  server: {
    port: 5173,
  },
})
