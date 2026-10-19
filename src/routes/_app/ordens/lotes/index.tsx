import { createFileRoute } from '@tanstack/react-router'
import { tableSearchSchema } from '@/components/data-table/url-state'
import { LotesOrdensPage } from '@/features/lotes/rotas'

export const Route = createFileRoute('/_app/ordens/lotes/')({
  validateSearch: tableSearchSchema,
  component: LotesOrdensPage,
})
