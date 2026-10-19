import { queryToSearch } from '@/components/data-table/url-state'
import type { TableQuery } from '@/components/data-table/types'
import { api } from './http'
import type {
  AcaoCadastro,
  PaginaMotoristas,
  Motorista,
  MotoristaInput,
  ResumoMotoristas,
  MotoristaResumo,
} from './types'

/* Motoristas (Relacionamento). Lista no formato de consulta do DataTable (s, f, a, q, p, ps). */

export const motoristasKeys = {
  all: ['motoristas'] as const,
  lista: (query: TableQuery) => ['motoristas', 'lista', query] as const,
  resumo: () => ['motoristas', 'resumo'] as const,
  detalhe: (id: string) => ['motoristas', 'detalhe', id] as const,
}

export const listarMotoristas = (query: TableQuery, signal?: AbortSignal) =>
  api<PaginaMotoristas>('/motoristas', {
    query: { ...queryToSearch(query), p: query.page, ps: query.pageSize },
    signal,
  })

/** Todos os resultados filtrados (para exportar). */
export async function listarTodosMotoristas(query: TableQuery): Promise<MotoristaResumo[]> {
  const page = await api<PaginaMotoristas>('/motoristas', {
    query: { ...queryToSearch(query), p: 1, ps: 100_000 },
  })
  return page.rows
}

export const resumoMotoristas = () => api<ResumoMotoristas>('/motoristas/resumo')

export const obterMotorista = (id: string, signal?: AbortSignal) =>
  api<Motorista>(`/motoristas/${id}`, { signal })

export const criarMotorista = (input: MotoristaInput) =>
  api<Motorista>('/motoristas', { method: 'POST', body: input })

export const atualizarMotorista = (id: string, input: MotoristaInput) =>
  api<Motorista>(`/motoristas/${id}`, { method: 'PUT', body: input })

export const transicionarMotorista = (id: string, acao: AcaoCadastro) =>
  api<Motorista>(`/motoristas/${id}/transicao`, { method: 'POST', body: { acao } })

/** Para escolher motoristas (transportadora): todos, com a transportadora atual. */
export async function opcoesMotoristas(): Promise<MotoristaResumo[]> {
  const page = await api<PaginaMotoristas>('/motoristas', { query: { p: 1, ps: 100_000 } })
  return page.rows
}
