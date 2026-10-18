import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext } from '@tanstack/react-router'
import { RootLayout } from '@/components/layout/RootLayout'
import { FullPageError, FullPageNotFound } from '@/features/system/ErrorPages'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  // Fora do shell (ex.: erro antes de montar o layout): telas de página inteira.
  errorComponent: FullPageError,
  notFoundComponent: FullPageNotFound,
})
