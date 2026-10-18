import { createFileRoute } from '@tanstack/react-router'
import { PendingAccessPage } from '@/features/system/AuthPages'

export const Route = createFileRoute('/acesso-pendente')({
  component: PendingAccessPage,
})
