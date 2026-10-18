import { createFileRoute } from '@tanstack/react-router'
import { ProfilePage } from '@/features/system/ProfileSettings'

export const Route = createFileRoute('/_app/perfil')({
  component: ProfilePage,
})
