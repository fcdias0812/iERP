import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { msw } from 'msw/vite'

// API do iERP (server/). No dev e no preview, /api é encaminhado para ela.
const API_TARGET = process.env.API_TARGET ?? 'http://localhost:3001'
const proxy = { '/api': { target: API_TARGET, changeOrigin: false } }

/*
 * VERSÃO DO BUILD (pedido do usuário, 28/10/2026: avisar quando houver versão nova). Cada build
 * ganha um identificador: ele vai DENTRO do código (`__IERP_BUILD__`) e num `version.json` ao
 * lado do site. A página aberta pergunta o `version.json` de tempos em tempos; se mudou, foi
 * publicada uma versão nova (src/components/layout/AvisoAtualizacao.tsx).
 */
const BUILD = process.env.IERP_BUILD ?? new Date().toISOString()
function versaoDoBuild(): Plugin {
  return {
    name: 'ierp-versao-do-build',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ build: BUILD }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: { __IERP_BUILD__: JSON.stringify(BUILD) },
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
    versaoDoBuild(),
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
