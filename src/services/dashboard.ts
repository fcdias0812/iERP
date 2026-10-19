import { api } from './http'
import type { DashboardOperacao } from './types'

/* Operação › Dashboard (tudo calculado no servidor a partir dos lotes e clientes). */

export const dashboardKeys = {
  all: ['dashboard'] as const,
  operacao: (mapaDe: string, mapaAte: string) =>
    ['dashboard', 'operacao', mapaDe, mapaAte] as const,
}

/** Período do mapa em `yyyy-mm-dd`. */
export const obterDashboardOperacao = (mapaDe: string, mapaAte: string, signal?: AbortSignal) =>
  api<DashboardOperacao>('/dashboard/operacao', { query: { mapaDe, mapaAte }, signal })
