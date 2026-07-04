import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The portfolio consumes the creature framework as a published package,
// `@banjobyster/bysters` (resolved from node_modules like any dependency), so
// there is no local alias or build-input wiring here any more. PORT is honoured
// so parallel dev servers can each claim their own port.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: true,
  },
})
