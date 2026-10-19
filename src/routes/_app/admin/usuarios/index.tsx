import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { tableSearchSchema } from '@/components/data-table/url-state'
import { UsuariosListPage } from '@/features/admin/usuarios/UsuariosListPage'

export const Route = createFileRoute('/_app/admin/usuarios/')({
  // ?aberto=novo (ou o id) abre o painel de cadastro/edição.
  validateSearch: tableSearchSchema.extend({ aberto: z.string().optional().catch(undefined) }),
  component: UsuariosListPage,
})
