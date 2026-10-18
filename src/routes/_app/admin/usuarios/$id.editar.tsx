import { createFileRoute } from '@tanstack/react-router'
import { UsuarioEditPage } from '@/features/admin/usuarios/UsuarioEditPages'

export const Route = createFileRoute('/_app/admin/usuarios/$id/editar')({
  component: UsuarioEditPage,
})
