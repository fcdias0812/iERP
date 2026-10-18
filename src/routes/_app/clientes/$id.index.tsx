import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ClienteDetailPage } from '@/features/clientes/ClienteDetailPage'
import { ABAS_CLIENTE } from '@/features/clientes/abas'

export const Route = createFileRoute('/_app/clientes/$id/')({
  // ?aba=logistica abre direto numa aba (link compartilhável).
  validateSearch: z.object({ aba: z.enum(ABAS_CLIENTE).optional().catch(undefined) }),
  component: ClienteDetailPage,
})
