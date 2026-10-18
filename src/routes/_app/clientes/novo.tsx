import { createFileRoute } from '@tanstack/react-router'
import { ClienteNovoPage } from '@/features/clientes/ClienteEditPages'

export const Route = createFileRoute('/_app/clientes/novo')({
  component: ClienteNovoPage,
})
