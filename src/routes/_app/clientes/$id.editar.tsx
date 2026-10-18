import { createFileRoute } from '@tanstack/react-router'
import { ClienteEditPage } from '@/features/clientes/ClienteEditPages'

export const Route = createFileRoute('/_app/clientes/$id/editar')({
  component: ClienteEditPage,
})
