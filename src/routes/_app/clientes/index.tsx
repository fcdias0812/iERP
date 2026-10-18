import { createFileRoute } from '@tanstack/react-router'
import { tableSearchSchema } from '@/components/data-table/url-state'
import { ClientesListPage } from '@/features/clientes/ClientesListPage'

export const Route = createFileRoute('/_app/clientes/')({
  validateSearch: tableSearchSchema,
  component: ClientesListPage,
})
