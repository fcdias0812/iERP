import { api } from './http'
import type { Rastreador, RastreadorDetalhe } from './types'

/*
 * Sistema › Cadastros › Rastreadores GPS: os aparelhos dos caminhões (aparecem sozinhos na
 * leitura do servidor de GPS — server/src/modules/viagens/rastreadores.ts).
 */

export const rastreadoresKeys = {
  todos: ['rastreadores'] as const,
  lista: () => ['rastreadores', 'lista'] as const,
  detalhe: (id: string) => ['rastreadores', 'detalhe', id] as const,
}

export const listarRastreadores = (signal?: AbortSignal) =>
  api<Rastreador[]>('/rastreadores', { signal })
export const obterRastreador = (id: string, signal?: AbortSignal) =>
  api<RastreadorDetalhe>(`/rastreadores/${id}`, { signal })
export const editarRastreador = (
  id: string,
  dados: { placa: string | null; descricao: string | null },
) => api<RastreadorDetalhe>(`/rastreadores/${id}`, { method: 'PUT', body: dados })
export const transicionarRastreador = (id: string, acao: 'inativar' | 'reativar') =>
  api<RastreadorDetalhe>(`/rastreadores/${id}/transicao`, { method: 'POST', body: { acao } })
export const lerGpsAgora = () => api<Rastreador[]>('/rastreadores/ler-agora', { method: 'POST' })
