import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { tableSearchSchema } from '@/components/data-table/url-state'
import { MotoristasPage } from '@/features/motoristas/MotoristasPage'

export const Route = createFileRoute('/_app/motoristas/')({
  // ?aberto=<id> (ou "novo") abre o painel do motorista.
  validateSearch: tableSearchSchema.extend({ aberto: z.string().optional().catch(undefined) }),
  component: MotoristasPage,
})
