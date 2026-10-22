import { queryToSearch } from '@/components/data-table/url-state'
import type { TableQuery } from '@/components/data-table/types'
import { api, buildUrl } from './http'
import type {
  AcaoCliente,
  DocumentoCliente,
  LotesResumoCliente,
  SiteCliente,
  SiteInput,
  TipoDocumento,
  PaginaClientes,
  Cliente,
  ClienteInput,
  ClienteResumo,
  ClientesResumo,
  ConfiguracoesClienteInput,
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
  sites: (id: string) => ['clientes', 'sites', id] as const,
  documentos: (id: string) => ['clientes', 'documentos', id] as const,
  lotes: (id: string) => ['clientes', 'lotes', id] as const,
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

/** Aba Configurações: grava tudo de uma vez. */
export const salvarConfiguracoesCliente = (id: string, input: ConfiguracoesClienteInput) =>
  api<Cliente>(`/clientes/${id}/configuracoes`, { method: 'PUT', body: input })

/* ------------------------------------------------------------ visão geral */

export const resumoLotesCliente = (id: string) =>
  api<LotesResumoCliente>(`/clientes/${id}/lotes/resumo`)

/* ------------------------------------------------------------ logística */

export const listarSites = (id: string) => api<SiteCliente[]>(`/clientes/${id}/sites`)

export const criarSite = (id: string, input: SiteInput) =>
  api<SiteCliente>(`/clientes/${id}/sites`, { method: 'POST', body: input })

export const atualizarSite = (id: string, siteId: string, input: SiteInput) =>
  api<SiteCliente>(`/clientes/${id}/sites/${siteId}`, { method: 'PUT', body: input })

export const removerSite = (id: string, siteId: string) =>
  api<void>(`/clientes/${id}/sites/${siteId}`, { method: 'DELETE' })

/* ------------------------------------------------------------ documentos */

export const listarDocumentos = (id: string) =>
  api<DocumentoCliente[]>(`/clientes/${id}/documentos`)

export function enviarDocumento(id: string, arquivo: File, tipo: TipoDocumento) {
  const form = new FormData()
  form.set('tipo', tipo)
  form.set('arquivo', arquivo, arquivo.name)
  return api<DocumentoCliente>(`/clientes/${id}/documentos`, { method: 'POST', body: form })
}

/** Endereço para baixar o arquivo (o servidor responde como anexo). */
export const urlDocumento = (id: string, docId: string) =>
  buildUrl(`/clientes/${id}/documentos/${docId}/arquivo`)

export const removerDocumento = (id: string, docId: string) =>
  api<void>(`/clientes/${id}/documentos/${docId}`, { method: 'DELETE' })
