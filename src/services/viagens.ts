import { API_BASE, api } from './http'
import type { MensagemViagem, PoiEstrada, Viagem, ViagemDetalhe, ViagensResposta } from './types'

/*
 * Ordens › Viagens: as viagens dos lotes no rastreador de GPS (o servidor fala com o rastreador —
 * a chave interna nunca chega ao navegador).
 */

export type SituacaoViagens = 'abertas' | 'finalizadas'

export const viagensKeys = {
  todas: ['viagens'] as const,
  lista: (situacao: SituacaoViagens, desde?: string) =>
    ['viagens', 'lista', situacao, desde ?? null] as const,
  detalhe: (id: string) => ['viagens', 'detalhe', id] as const,
  chat: (id: string) => ['viagens', 'chat', id] as const,
  doLote: (ordemId: string) => ['viagens', 'lote', ordemId] as const,
  pois: (caixa: string) => ['viagens', 'pois', caixa] as const,
}

export const listarViagens = (situacao: SituacaoViagens, desde?: string, signal?: AbortSignal) =>
  api<ViagensResposta>('/viagens', { query: { situacao, desde }, signal })
export const obterViagem = (id: string, signal?: AbortSignal) =>
  api<ViagemDetalhe>(`/viagens/${id}`, { signal })
export const viagemDoLote = (ordemId: string, signal?: AbortSignal) =>
  api<Viagem | null>(`/viagens/lote/${ordemId}`, { signal })
export const lerChatViagem = (id: string, signal?: AbortSignal) =>
  api<MensagemViagem[]>(`/viagens/${id}/chat`, { signal })
export const enviarChatViagem = (id: string, texto: string) =>
  api<MensagemViagem[]>(`/viagens/${id}/chat`, { method: 'POST', body: { texto } })
export const finalizarViagem = (id: string) =>
  api<ViagemDetalhe>(`/viagens/${id}/finalizar`, { method: 'POST' })
export const cienteEmergenciaViagem = (id: string) =>
  api<ViagemDetalhe>(`/viagens/${id}/emergencia/ciente`, { method: 'POST' })
export const poisDaEstrada = (
  caixa: { s: number; w: number; n: number; e: number },
  signal?: AbortSignal,
) => api<PoiEstrada[]>('/viagens/mapa/pois', { query: caixa, signal })

/** Tiles do trânsito (TomTom) pelo servidor, que guarda a chave. */
export const URL_TRANSITO = `${API_BASE}/viagens/mapa/transito/{z}/{x}/{y}.png`
