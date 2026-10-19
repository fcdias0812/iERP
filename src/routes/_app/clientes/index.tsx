import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { tableSearchSchema } from '@/components/data-table/url-state'
import { ClientesListPage } from '@/features/clientes/ClientesListPage'

export const Route = createFileRoute('/_app/clientes/')({
  // ?aberto=novo (ou o id) abre o painel de cadastro/edição.
  validateSearch: tableSearchSchema.extend({ aberto: z.string().optional().catch(undefined) }),
  component: ClientesListPage,
})
