import { api } from './http'
import type { EventoHistoricoModulo, ModuloHistorico } from './types'

/* Histórico do módulo (Ordens › Histórico, Operação › Histórico). */

export const historicoKeys = {
  modulo: (modulo: ModuloHistorico, desde: string | null) => ['historico', modulo, desde] as const,
}

/** Eventos do módulo desde a data (ISO); null = tudo. Mais recente primeiro. */
export const listarHistoricoModulo = (
  modulo: ModuloHistorico,
  desde: string | null,
  signal?: AbortSignal,
) =>
  api<EventoHistoricoModulo[]>(`/historico/${modulo}`, {
    query: desde ? { desde } : {},
    signal,
  })
