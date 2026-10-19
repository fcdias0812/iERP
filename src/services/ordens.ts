import { queryToSearch } from '@/components/data-table/url-state'
import type { TableQuery } from '@/components/data-table/types'
import { api, buildUrl } from './http'
import type {
  CalculoOs,
  Ordem,
  OrdemInput,
  OrdemResumo,
  PaginaOrdens,
  QuantidadesOs,
  ServicosOs,
} from './types'

/* Ordens: agendamento (cria o lote) e lista dos lotes agendados. */

export const ordensKeys = {
  all: ['ordens'] as const,
  lista: (query: TableQuery) => ['ordens', 'lista', query] as const,
  detalhe: (id: string) => ['ordens', 'detalhe', id] as const,
}

export const listarOrdens = (query: TableQuery, signal?: AbortSignal) =>
  api<PaginaOrdens>('/ordens', {
    query: { ...queryToSearch(query), p: query.page, ps: query.pageSize },
    signal,
  })

/** Todos os resultados filtrados (para exportar). */
export async function listarTodasOrdens(query: TableQuery): Promise<OrdemResumo[]> {
  const page = await api<PaginaOrdens>('/ordens', {
    query: { ...queryToSearch(query), p: 1, ps: 100_000 },
  })
  return page.rows
}

export const obterOrdem = (id: string, signal?: AbortSignal) =>
  api<Ordem>(`/ordens/${id}`, { signal })

/** Pré-cálculo (não grava nada). */
export const preCalcularOrdem = (dados: {
  docaId: string
  servicos: ServicosOs
  quantidades: QuantidadesOs
}) => api<CalculoOs>('/ordens/pre-calculo', { method: 'POST', body: dados })

/** Cria a ordem: dados (JSON) + arquivos do escopo e das observações, num envio só. */
export function criarOrdem(dados: OrdemInput, arquivos: { escopo: File[]; observacoes: File[] }) {
  const form = new FormData()
  form.set('dados', JSON.stringify(dados))
  for (const f of arquivos.escopo) form.append('escopo', f, f.name)
  for (const f of arquivos.observacoes) form.append('observacoes', f, f.name)
  return api<Ordem>('/ordens', { method: 'POST', body: form })
}

/** Endereço para baixar um anexo (o servidor responde como anexo). */
export const urlAnexoOrdem = (id: string, anexoId: string) =>
  buildUrl(`/ordens/${id}/anexos/${anexoId}/arquivo`)
