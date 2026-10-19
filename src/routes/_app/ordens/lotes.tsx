import { createFileRoute } from '@tanstack/react-router'
import { tableSearchSchema } from '@/components/data-table/url-state'
import { LotesAgendadosPage } from '@/features/ordens/LotesAgendadosPage'

export const Route = createFileRoute('/_app/ordens/lotes')({
  validateSearch: tableSearchSchema,
  component: LotesAgendadosPage,
})
