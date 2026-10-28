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
/** As viagens do lote (uma por caminhão). */
export const viagensDoLote = (ordemId: string, signal?: AbortSignal) =>
  api<Viagem[]>(`/viagens/lote/${ordemId}`, { signal })
/** "Usar rastreador": o caminhão vai pelo aparelho de GPS. */
export const usarRastreador = (viagemId: string, rastreadorId: string) =>
  api<ViagemDetalhe>(`/viagens/${viagemId}/rastreador`, {
    method: 'POST',
    body: { rastreadorId },
  })

/** "Adicionar caminhão" no lote e "Nova viagem" em Viagens (com o rastreador, se for aparelho). */
export const adicionarCaminhao = (
  ordemId: string,
  caminhao: { motoristaId: string | null; placa: string | null; rastreadorId?: string | null },
) => api<ViagemDetalhe>(`/viagens/lote/${ordemId}`, { method: 'POST', body: caminhao })
/** "Adicionar rastreador" no caminhão (28/10/2026): celular (null) ou aparelho de GPS. */
export const adicionarRastreio = (viagemId: string, rastreadorId: string | null) =>
  api<ViagemDetalhe>(`/viagens/${viagemId}/rastreios`, { method: 'POST', body: { rastreadorId } })
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

/** Arquivos do trajeto de uma viagem terminada (como no iERP antigo). */
export const FORMATOS_TRAJETO = ['gpx', 'kml', 'csv'] as const
export type FormatoTrajeto = (typeof FORMATOS_TRAJETO)[number]
export const urlExportarViagem = (id: string, formato: FormatoTrajeto) =>
  `${API_BASE}/viagens/${encodeURIComponent(id)}/exportar/${formato}`

/** Tiles do trânsito (TomTom) pelo servidor, que guarda a chave. */
export const URL_TRANSITO = `${API_BASE}/viagens/mapa/transito/{z}/{x}/{y}.png`
