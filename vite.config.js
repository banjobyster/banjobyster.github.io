import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The reusable creature framework lives in ./bysters (its own package, resolved
// here by alias while it is still a local dir). `bysters` -> the package entry,
// `bysters/<subpath>` -> a file inside it. When M-inject makes it a real
// dependency the alias drops out and the specifiers stay the same.
const bystersDir = fileURLToPath(new URL('./bysters', import.meta.url))
const bystersAlias = [
  { find: /^bysters$/, replacement: `${bystersDir}/index.js` },
  { find: /^bysters\/(.*)$/, replacement: `${bystersDir}/$1` },
]

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: { alias: bystersAlias },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        sandbox: fileURLToPath(new URL('./sandbox.html', import.meta.url)),
        bysters: fileURLToPath(new URL('./bysters-sandbox.html', import.meta.url)),
        playground: fileURLToPath(new URL('./bysters-playground.html', import.meta.url)),
      },
    },
  },
  // Vitest reads this block; Vite ignores it. The pure core runs headless (no
  // DOM, no Pixi), so the default node environment is right for it.
  test: {
    environment: 'node',
    include: ['bysters/**/*.test.js'],
  },
})
