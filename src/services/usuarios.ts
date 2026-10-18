import { queryToSearch } from '@/components/data-table/url-state'
import type { TableQuery } from '@/components/data-table/types'
import { api } from './http'
import type {
  AcaoUsuario,
  PaginaUsuarios,
  Usuario,
  UsuarioInput,
  UsuarioResumo,
  UsuariosResumo,
} from './types'

/*
 * Usuários (Admin › Usuários). A lista usa o MESMO formato de consulta do
 * DataTable (s, f, a, q, p, ps) — o servidor aplica filtro, ordenação e paginação.
 */

export const usuariosKeys = {
  all: ['usuarios'] as const,
  lista: (query: TableQuery) => ['usuarios', 'lista', query] as const,
  resumo: () => ['usuarios', 'resumo'] as const,
  detalhe: (id: string) => ['usuarios', 'detalhe', id] as const,
}

export function listarUsuarios(query: TableQuery, signal?: AbortSignal) {
  return api<PaginaUsuarios>('/usuarios', {
    query: { ...queryToSearch(query), p: query.page, ps: query.pageSize },
    signal,
  })
}

/** Todos os resultados filtrados (para exportar). */
export async function listarTodosUsuarios(query: TableQuery): Promise<UsuarioResumo[]> {
  const page = await api<PaginaUsuarios>('/usuarios', {
    query: { ...queryToSearch(query), p: 1, ps: 100_000 },
  })
  return page.rows
}

export const resumoUsuarios = () => api<UsuariosResumo>('/usuarios/resumo')

export const obterUsuario = (id: string, signal?: AbortSignal) =>
  api<Usuario>(`/usuarios/${id}`, { signal })

export const criarUsuario = (input: UsuarioInput) =>
  api<Usuario>('/usuarios', { method: 'POST', body: input })

export const atualizarUsuario = (id: string, input: UsuarioInput) =>
  api<Usuario>(`/usuarios/${id}`, { method: 'PUT', body: input })

export const transicionarUsuario = (id: string, acao: AcaoUsuario, motivo?: string) =>
  api<Usuario>(`/usuarios/${id}/transicao`, { method: 'POST', body: { acao, motivo } })
