import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // O identificador do build (vite.config.ts) nos testes.
  define: { __IERP_BUILD__: JSON.stringify('teste') },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
