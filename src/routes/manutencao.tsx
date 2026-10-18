import { createFileRoute } from '@tanstack/react-router'
import { MaintenancePage } from '@/features/system/AuthPages'

export const Route = createFileRoute('/manutencao')({
  component: MaintenancePage,
})
