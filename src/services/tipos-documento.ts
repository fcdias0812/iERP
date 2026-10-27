import type { LocalizedText } from '@/lib/localized-text'
import { api } from './http'
import type { TipoDocLote } from './types'

/*
 * Tipos de documento do lote (22/10/2026): a lista única (os do sistema + os criados nas
 * Configurações do cliente) — server/src/modules/clientes/tipos-documento.ts.
 */

export const tiposDocumentoKeys = {
  lista: ['tipos-documento'] as const,
}

export const listarTiposDocumento = (signal?: AbortSignal) =>
  api<TipoDocLote[]>('/tipos-documento', { signal })

export const criarTipoDocumento = (nome: LocalizedText) =>
  api<TipoDocLote>('/tipos-documento', { method: 'POST', body: { nome } })
