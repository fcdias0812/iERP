import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { msw } from 'msw/vite'

// API do iERP (server/). No dev e no preview, /api é encaminhado para ela.
const API_TARGET = process.env.API_TARGET ?? 'http://localhost:3001'
const proxy = { '/api': { target: API_TARGET, changeOrigin: false } }

// https://vite.dev/config/
export default defineConfig({
  server: { proxy },
  preview: { proxy },
  plugins: [
    // O plugin do router precisa vir antes do plugin do React.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    // MSW 3: serve o mockServiceWorker.js no dev e o publica no build (sem arquivo em public/).
    // 'worker-only': usamos o setupWorker estável de 'msw/browser' (src/mocks/browser.ts).
    msw({ mode: 'worker-only' }),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: {
    // Sem CDN: tudo (fontes, imagens, ícones) sai no dist/.
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1000,
  },
})
