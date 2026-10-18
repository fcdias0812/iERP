import { createFileRoute } from '@tanstack/react-router'
import { tableSearchSchema } from '@/components/data-table/url-state'
import { UsuariosListPage } from '@/features/admin/usuarios/UsuariosListPage'

export const Route = createFileRoute('/_app/admin/usuarios/')({
  validateSearch: tableSearchSchema,
  component: UsuariosListPage,
})
