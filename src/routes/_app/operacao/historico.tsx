import { createFileRoute } from '@tanstack/react-router'
import { HistoricoOperacaoPage } from '@/features/historico/rotas'

export const Route = createFileRoute('/_app/operacao/historico')({
  component: HistoricoOperacaoPage,
})
