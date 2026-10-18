import { queryToSearch } from '@/components/data-table/url-state'
import type { TableQuery } from '@/components/data-table/types'
import { api } from './http'
import type {
  AcaoCliente,
  PaginaClientes,
  Cliente,
  ClienteInput,
  ClienteResumo,
  ClientesResumo,
} from './types'

/*
 * Clientes. A lista usa o MESMO formato de consulta do DataTable (s, f, a, q, p, ps) —
 * o servidor aplica filtro, ordenação e paginação. CNPJ e telefone vão sem pontuação.
 */

export const clientesKeys = {
  all: ['clientes'] as const,
  lista: (query: TableQuery) => ['clientes', 'lista', query] as const,
  resumo: () => ['clientes', 'resumo'] as const,
  detalhe: (id: string) => ['clientes', 'detalhe', id] as const,
}

export function listarClientes(query: TableQuery, signal?: AbortSignal) {
  return api<PaginaClientes>('/clientes', {
    query: { ...queryToSearch(query), p: query.page, ps: query.pageSize },
    signal,
  })
}

/** Todos os resultados filtrados (para exportar). */
export async function listarTodosClientes(query: TableQuery): Promise<ClienteResumo[]> {
  const page = await api<PaginaClientes>('/clientes', {
    query: { ...queryToSearch(query), p: 1, ps: 100_000 },
  })
  return page.rows
}

export const resumoClientes = () => api<ClientesResumo>('/clientes/resumo')

export const obterCliente = (id: string, signal?: AbortSignal) =>
  api<Cliente>(`/clientes/${id}`, { signal })

export const criarCliente = (input: ClienteInput) =>
  api<Cliente>('/clientes', { method: 'POST', body: input })

export const atualizarCliente = (id: string, input: ClienteInput) =>
  api<Cliente>(`/clientes/${id}`, { method: 'PUT', body: input })

export const transicionarCliente = (id: string, acao: AcaoCliente) =>
  api<Cliente>(`/clientes/${id}/transicao`, { method: 'POST', body: { acao } })
