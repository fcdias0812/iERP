import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { TransportadoraDetailPage } from '@/features/transportadoras/TransportadoraDetailPage'
import { ABAS_TRANSPORTADORA } from '@/features/transportadoras/abas'

export const Route = createFileRoute('/_app/transportadoras/$id/')({
  // ?aba=motoristas abre direto numa aba (link compartilhável); ?editar=true abre o painel de edição.
  validateSearch: z.object({
    aba: z.enum(ABAS_TRANSPORTADORA).optional().catch(undefined),
    editar: z.boolean().optional().catch(undefined),
  }),
  component: TransportadoraDetailPage,
})
