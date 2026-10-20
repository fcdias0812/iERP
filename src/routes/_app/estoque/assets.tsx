import { createFileRoute } from '@tanstack/react-router'
import { tableSearchSchema } from '@/components/data-table/url-state'
import { AssetsPage } from '@/features/estoque/paginas'

/* Estoque › Assets (Controle de Notebooks): lista do sistema de fora, só para ver (src/features/estoque/). */
export const Route = createFileRoute('/_app/estoque/assets')({
  validateSearch: tableSearchSchema,
  component: AssetsPage,
})
