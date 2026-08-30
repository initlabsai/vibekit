import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `vite` for hot reload proxies the API to `bun server.ts`; `vite build` then `bun server.ts` serves it all.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8790' } },
})
