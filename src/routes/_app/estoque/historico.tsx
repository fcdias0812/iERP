import { createFileRoute } from '@tanstack/react-router'
import { HistoricoEstoquePage } from '@/features/estoque/HistoricoEstoquePage'

/* Estoque › Histórico: o que mudou no estoque dos três sistemas (o iERP compara as leituras). */
export const Route = createFileRoute('/_app/estoque/historico')({
  component: HistoricoEstoquePage,
})
