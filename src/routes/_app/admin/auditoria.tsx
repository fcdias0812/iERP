import { createFileRoute } from '@tanstack/react-router'
import { AuditoriaPage } from '@/features/admin/auditoria/AuditoriaPage'

export const Route = createFileRoute('/_app/admin/auditoria')({
  component: AuditoriaPage,
})
