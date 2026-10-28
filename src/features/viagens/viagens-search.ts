import { z } from 'zod'

/* Parâmetros da URL de Ordens › Viagens (leve: a rota importa daqui). */

export const ABAS_VIAGENS = ['em-andamento', 'finalizadas'] as const
export type AbaViagens = (typeof ABAS_VIAGENS)[number]

export const viagensSearchSchema = z.object({
  aba: z.enum(ABAS_VIAGENS).optional().catch(undefined),
  /** A viagem escolhida (no mapa / no replay). */
  viagem: z.string().optional().catch(undefined),
  /** Conversa aberta com o motorista (id da viagem). */
  chat: z.string().optional().catch(undefined),
  /** Painel "New trip" aberto (28/10/2026). */
  aberto: z.literal('novo').optional().catch(undefined),
})
