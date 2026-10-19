import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { tableSearchSchema } from '@/components/data-table/url-state'
import { VeiculosPage } from '@/features/veiculos/VeiculosPage'

export const Route = createFileRoute('/_app/veiculos/')({
  // ?aberto=<id> (ou "novo") abre o painel do veículo.
  validateSearch: tableSearchSchema.extend({ aberto: z.string().optional().catch(undefined) }),
  component: VeiculosPage,
})
