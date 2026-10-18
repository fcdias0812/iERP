import { createFileRoute } from '@tanstack/react-router'
import { UsuarioNovoPage } from '@/features/admin/usuarios/UsuarioEditPages'

export const Route = createFileRoute('/_app/admin/usuarios/novo')({
  component: UsuarioNovoPage,
})
