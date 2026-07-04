import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The reusable creature framework now lives in its OWN repo, the sibling `bysters`
// directory (github.com/banjobyster/bysters), so the portfolio consumes it from
// there rather than a local copy. This alias resolves `bysters` -> the package
// entry and `bysters/<subpath>` -> a file inside it, so consumer specifiers stay
// identical to what an external `import from 'bysters'` would use.
const bystersDir = fileURLToPath(new URL('../bysters', import.meta.url))
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
      },
    },
  },
  // Vitest reads this block; Vite ignores it. The pure core runs headless (no
  // DOM, no Pixi), so the default node environment is right for it.
  test: {
    // The framework's headless tests live in the sibling bysters repo now; run
    // them from here so the portfolio still validates the framework it consumes.
    environment: 'node',
    include: ['../bysters/core/**/*.test.js', '../bysters/dom/**/*.test.js'],
  },
})
