import { api } from './http'
import type { Notificacao, ResultadoBusca } from './types'

/** Serviços do shell: busca global (Ctrl+K) e notificações. */

export const sistemaKeys = {
  busca: (q: string) => ['busca', q] as const,
  notificacoes: ['notificacoes'] as const,
}

/** Busca global (Ctrl+K): registros de todos os módulos. */
export const buscaGlobal = (q: string, signal?: AbortSignal) =>
  api<ResultadoBusca[]>('/busca', { query: { q }, signal })

export const listarNotificacoes = () => api<Notificacao[]>('/notificacoes')
export const marcarNotificacoesLidas = (ids?: string[]) =>
  api<void>('/notificacoes/lidas', { method: 'POST', body: { ids } })
