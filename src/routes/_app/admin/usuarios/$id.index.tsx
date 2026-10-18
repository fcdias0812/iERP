import { createFileRoute } from '@tanstack/react-router'
import { UsuarioDetailPage } from '@/features/admin/usuarios/UsuarioDetailPage'

export const Route = createFileRoute('/_app/admin/usuarios/$id/')({
  component: UsuarioDetailPage,
})
