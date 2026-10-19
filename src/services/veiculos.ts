import { queryToSearch } from '@/components/data-table/url-state'
import type { TableQuery } from '@/components/data-table/types'
import { api } from './http'
import type {
  AcaoCadastro,
  PaginaVeiculos,
  VeiculoDetalhe,
  VeiculoInput,
  ResumoCadastro,
  Veiculo,
} from './types'

/* Veículos (Relacionamento). Lista no formato de consulta do DataTable (s, f, a, q, p, ps). */

export const veiculosKeys = {
  all: ['veiculos'] as const,
  lista: (query: TableQuery) => ['veiculos', 'lista', query] as const,
  resumo: () => ['veiculos', 'resumo'] as const,
  detalhe: (id: string) => ['veiculos', 'detalhe', id] as const,
}

export const listarVeiculos = (query: TableQuery, signal?: AbortSignal) =>
  api<PaginaVeiculos>('/veiculos', {
    query: { ...queryToSearch(query), p: query.page, ps: query.pageSize },
    signal,
  })

/** Todos os resultados filtrados (para exportar). */
export async function listarTodosVeiculos(query: TableQuery): Promise<Veiculo[]> {
  const page = await api<PaginaVeiculos>('/veiculos', {
    query: { ...queryToSearch(query), p: 1, ps: 100_000 },
  })
  return page.rows
}

export const resumoVeiculos = () => api<ResumoCadastro>('/veiculos/resumo')

export const obterVeiculo = (id: string, signal?: AbortSignal) =>
  api<VeiculoDetalhe>(`/veiculos/${id}`, { signal })

export const criarVeiculo = (input: VeiculoInput) =>
  api<VeiculoDetalhe>('/veiculos', { method: 'POST', body: input })

export const atualizarVeiculo = (id: string, input: VeiculoInput) =>
  api<VeiculoDetalhe>(`/veiculos/${id}`, { method: 'PUT', body: input })

export const transicionarVeiculo = (id: string, acao: AcaoCadastro) =>
  api<VeiculoDetalhe>(`/veiculos/${id}/transicao`, { method: 'POST', body: { acao } })
