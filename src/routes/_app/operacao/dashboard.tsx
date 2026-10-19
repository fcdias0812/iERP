import { createFileRoute } from '@tanstack/react-router'
import { DashboardOperacaoPage } from '@/features/operacao/DashboardOperacaoPage'

export const Route = createFileRoute('/_app/operacao/dashboard')({
  component: DashboardOperacaoPage,
})
