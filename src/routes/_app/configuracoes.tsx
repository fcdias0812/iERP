import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '@/features/system/ProfileSettings'

export const Route = createFileRoute('/_app/configuracoes')({
  component: SettingsPage,
})
