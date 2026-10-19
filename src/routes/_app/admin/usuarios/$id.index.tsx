import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { UsuarioDetailPage } from '@/features/admin/usuarios/UsuarioDetailPage'

export const Route = createFileRoute('/_app/admin/usuarios/$id/')({
  // ?editar=true abre o painel de edição.
  validateSearch: z.object({ editar: z.boolean().optional().catch(undefined) }),
  component: UsuarioDetailPage,
})
