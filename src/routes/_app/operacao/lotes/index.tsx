import { createFileRoute } from '@tanstack/react-router'
import { tableSearchSchema } from '@/components/data-table/url-state'
import { LotesOperacaoPage } from '@/features/lotes/rotas'

export const Route = createFileRoute('/_app/operacao/lotes/')({
  validateSearch: tableSearchSchema,
  component: LotesOperacaoPage,
})
