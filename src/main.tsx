import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'

import '@/styles/fonts'
import '@/styles/index.css'
import '@/i18n'
import '@/lib/zod-i18n'
import { AppError, NotFoundContent } from '@/features/system/ErrorPages'
import { ApiError } from '@/services/http'
import { routeTree } from './routeTree.gen'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Erro do cliente (4xx) não adianta repetir; erro de servidor/rede tenta mais 1 vez.
      retry: (count, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
    },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // Erro ou "não encontrado" em qualquer tela interna: telas 500/404 do sistema (dentro do shell).
  defaultErrorComponent: AppError,
  defaultNotFoundComponent: NotFoundContent,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

/**
 * API simulada (MSW): DESLIGADA por padrão — o iERP usa a API real (server/, via /api).
 * VITE_USE_MOCKS=true liga a simulação (demonstração sem backend e testes e2e).
 */
async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return
  const { worker } = await import('./mocks/browser')
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledFrame: 'bypass', // fontes, imagens etc. seguem direto
    quiet: true,
  })
}

void enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
})
