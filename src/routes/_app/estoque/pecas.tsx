import { createFileRoute } from '@tanstack/react-router'
import { tableSearchSchema } from '@/components/data-table/url-state'
import { PecasPage } from '@/features/estoque/paginas'

/* Estoque › Peças (Controle de Notebooks): lista do sistema de fora, só para ver (src/features/estoque/). */
export const Route = createFileRoute('/_app/estoque/pecas')({
  validateSearch: tableSearchSchema,
  component: PecasPage,
})
