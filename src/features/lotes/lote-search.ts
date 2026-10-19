import { z } from 'zod'
import { ABAS_LOTE } from './origem'

/* Parâmetros da URL do detalhe do lote (leve: a rota importa daqui). */
export const loteSearchSchema = z.object({
  aba: z.enum(ABAS_LOTE).optional().catch(undefined),
  /** Painel da ocorrência: "nova" ou o id. */
  ocorrencia: z.string().optional().catch(undefined),
  /** Painel de edição do lote (só enquanto agendado). */
  editar: z.boolean().optional().catch(undefined),
  /** Painel de recebimento (receber o agendado ou corrigir em Inspeção). */
  receber: z.boolean().optional().catch(undefined),
})
export type LoteSearch = z.infer<typeof loteSearchSchema>
