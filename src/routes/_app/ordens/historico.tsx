import { createFileRoute } from '@tanstack/react-router'
import { HistoricoOrdensPage } from '@/features/historico/rotas'

export const Route = createFileRoute('/_app/ordens/historico')({
  component: HistoricoOrdensPage,
})
