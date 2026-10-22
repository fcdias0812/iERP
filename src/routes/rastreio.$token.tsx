import { createFileRoute } from '@tanstack/react-router'
import { RastreioPublicoPage } from '@/features/rastreio/RastreioPublicoPage'

// Página PÚBLICA (fora do shell e do login): o link de acompanhamento dos lotes de um cliente.
export const Route = createFileRoute('/rastreio/$token')({
  component: RastreioPublicoPage,
})
