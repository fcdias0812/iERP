import { z } from 'zod'
import { tableSearchSchema } from '@/components/data-table/url-state'

/* Parâmetros da URL de Operação › Recebimento (leve: a rota importa daqui). */

export const VISOES_RECEBIMENTO = ['a-receber', 'recebidos'] as const
export type VisaoRecebimento = (typeof VISOES_RECEBIMENTO)[number]

export const recebimentoSearchSchema = tableSearchSchema.extend({
  visao: z.enum(VISOES_RECEBIMENTO).optional().catch(undefined),
  /** Painel de recebimento: "novo" (escolher o lote) ou o id do lote. */
  aberto: z.string().optional().catch(undefined),
})
