import { createFileRoute } from '@tanstack/react-router'
import { tableSearchSchema } from '@/components/data-table/url-state'
import { MateriaisPage } from '@/features/estoque/paginas'

/* Estoque › Materiais (armazém): lista do sistema de fora, só para ver (src/features/estoque/). */
export const Route = createFileRoute('/_app/estoque/materiais')({
  validateSearch: tableSearchSchema,
  component: MateriaisPage,
})
