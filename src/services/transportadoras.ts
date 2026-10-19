import { queryToSearch } from '@/components/data-table/url-state'
import type { TableQuery } from '@/components/data-table/types'
import { api } from './http'
import type {
  AcaoCadastro,
  PaginaTransportadoras,
  Transportadora,
  TransportadoraInput,
  ResumoCadastro,
  TransportadoraOpcao,
  TransportadoraResumo,
} from './types'

/* Transportadoras (Relacionamento). Lista no formato de consulta do DataTable (s, f, a, q, p, ps). */

export const transportadorasKeys = {
  all: ['transportadoras'] as const,
  lista: (query: TableQuery) => ['transportadoras', 'lista', query] as const,
  resumo: () => ['transportadoras', 'resumo'] as const,
  detalhe: (id: string) => ['transportadoras', 'detalhe', id] as const,
}

export const listarTransportadoras = (query: TableQuery, signal?: AbortSignal) =>
  api<PaginaTransportadoras>('/transportadoras', {
    query: { ...queryToSearch(query), p: query.page, ps: query.pageSize },
    signal,
  })

/** Todos os resultados filtrados (para exportar). */
export async function listarTodosTransportadoras(
  query: TableQuery,
): Promise<TransportadoraResumo[]> {
  const page = await api<PaginaTransportadoras>('/transportadoras', {
    query: { ...queryToSearch(query), p: 1, ps: 100_000 },
  })
  return page.rows
}

export const resumoTransportadoras = () => api<ResumoCadastro>('/transportadoras/resumo')

export const obterTransportadora = (id: string, signal?: AbortSignal) =>
  api<Transportadora>(`/transportadoras/${id}`, { signal })

export const criarTransportadora = (input: TransportadoraInput) =>
  api<Transportadora>('/transportadoras', { method: 'POST', body: input })

export const atualizarTransportadora = (id: string, input: TransportadoraInput) =>
  api<Transportadora>(`/transportadoras/${id}`, { method: 'PUT', body: input })

export const transicionarTransportadora = (id: string, acao: AcaoCadastro) =>
  api<Transportadora>(`/transportadoras/${id}/transicao`, { method: 'POST', body: { acao } })

/** Para escolher a transportadora (motorista). */
export const opcoesTransportadoras = () => api<TransportadoraOpcao[]>('/transportadoras/opcoes')
