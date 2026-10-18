import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { LoginPage } from '@/features/system/AuthPages'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().optional().catch(undefined) }),
  component: LoginPage,
})
