import { queryToSearch } from '@/components/data-table/url-state'
import type { TableQuery } from '@/components/data-table/types'
import { api, buildUrl } from './http'
import type {
  CalculoOs,
  OcorrenciaInput,
  Ordem,
  OrdemInput,
  OrdemResumo,
  PaginaOrdens,
  TipoDocumentoLote,
  QuantidadesOs,
  ServicosOs,
} from './types'

/* Ordens: agendamento (cria o lote), lista dos lotes e detalhe do lote (ocorrências, pallets). */

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

/* ---------------- Detalhe do lote: ocorrências (as respostas trazem o lote atualizado) */

function formOcorrencia(dados: OcorrenciaInput, fotos: File[]) {
  const form = new FormData()
  form.set('dados', JSON.stringify(dados))
  for (const f of fotos) form.append('fotos', f, f.name)
  return form
}

export const registrarOcorrencia = (ordemId: string, dados: OcorrenciaInput, fotos: File[]) =>
  api<Ordem>(`/ordens/${ordemId}/ocorrencias`, {
    method: 'POST',
    body: formOcorrencia(dados, fotos),
  })

export const corrigirOcorrencia = (
  ordemId: string,
  ocorrenciaId: string,
  dados: OcorrenciaInput,
  fotos: File[],
) =>
  api<Ordem>(`/ordens/${ordemId}/ocorrencias/${ocorrenciaId}`, {
    method: 'PATCH',
    body: formOcorrencia(dados, fotos),
  })

export const cancelarOcorrencia = (ordemId: string, ocorrenciaId: string) =>
  api<Ordem>(`/ordens/${ordemId}/ocorrencias/${ocorrenciaId}/cancelar`, { method: 'POST' })

/** Foto de uma ocorrência (imagem exibida na tela). */
export const urlFotoOcorrencia = (ordemId: string, ocorrenciaId: string, fotoId: string) =>
  buildUrl(`/ordens/${ordemId}/ocorrencias/${ocorrenciaId}/fotos/${fotoId}`)

/** Foto de um pallet recebido. */
export const urlFotoPallet = (ordemId: string, palletId: string) =>
  buildUrl(`/ordens/${ordemId}/pallets/${palletId}/foto`)

/** Edita o lote (só enquanto agendado; o cliente não muda). */
export const editarOrdem = (id: string, dados: OrdemInput) =>
  api<Ordem>(`/ordens/${id}`, { method: 'PUT', body: dados })

/** Documentos adicionados ao lote depois do agendamento (aba Documentos). */
export function adicionarDocumentosLote(
  ordemId: string,
  tipo: TipoDocumentoLote,
  arquivos: File[],
) {
  const form = new FormData()
  form.set('tipo', tipo)
  for (const f of arquivos) form.append('arquivos', f, f.name)
  return api<Ordem>(`/ordens/${ordemId}/anexos`, { method: 'POST', body: form })
}

export const removerDocumentoLote = (ordemId: string, anexoId: string) =>
  api<Ordem>(`/ordens/${ordemId}/anexos/${anexoId}`, { method: 'DELETE' })
