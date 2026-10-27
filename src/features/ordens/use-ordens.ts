import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TableQuery } from '@/components/data-table/types'
import { EMPTY_QUERY } from '@/components/data-table/types'
import { toast } from '@/components/ui/sonner'
import { apiErrorMessage } from '@/lib/api-errors'
import { clientesKeys, listarClientes, listarSites } from '@/services/clientes'
import {
  adicionarDocumentosLote,
  cancelarOcorrencia,
  corrigirOcorrencia,
  criarOrdem,
  editarOrdem,
  listarOrdens,
  obterEspelhoDoLote,
  obterOrdem,
  ordensKeys,
  preCalcularOrdem,
  registrarOcorrencia,
  removerDocumentoLote,
  salvarRecebimento,
} from '@/services/ordens'
import type {
  FotosRecebimento,
  OcorrenciaInput,
  Ordem,
  OrdemInput,
  RecebimentoInput,
  TipoDocumentoLote,
} from '@/services/types'

/* Consultas e mutações de Ordens (agendamento, lista dos lotes e detalhe do lote). */

export const useLotes = (query: TableQuery) =>
  useQuery({
    queryKey: ordensKeys.lista(query),
    queryFn: ({ signal }) => listarOrdens(query, signal),
    placeholderData: keepPreviousData,
  })

/** Sites (com docas) do cliente escolhido — só depois de escolher o cliente. */
export const useSitesDoCliente = (clienteId: string) =>
  useQuery({
    queryKey: clientesKeys.sites(clienteId),
    queryFn: () => listarSites(clienteId),
    enabled: Boolean(clienteId),
  })

/** Busca de clientes ATIVOS para o combobox (até 20 por vez). */
export async function buscarClientesAtivos(busca: string) {
  const page = await listarClientes({
    ...EMPTY_QUERY,
    search: busca,
    filters: [{ id: 'status', kind: 'in', values: ['ativo'] }],
    sort: [{ id: 'nome', desc: false }],
    pageSize: 20,
  })
  return page.rows.map((c) => ({ value: c.id, label: c.nome }))
}

/** Pré-cálculo: não grava nada; o erro aparece no próprio card. */
export const usePreCalculo = () => useMutation({ mutationFn: preCalcularOrdem })

export function useCriarOrdem() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      dados,
      arquivos,
    }: {
      dados: OrdemInput
      arquivos: { escopo: File[]; observacoes: File[] }
    }) => criarOrdem(dados, arquivos),
    onSuccess: (o) => {
      void qc.invalidateQueries({ queryKey: ordensKeys.all })
      // A mesma coleta de outro lote: virou parte dele (22/10/2026).
      if (o.juntadoA)
        toast.success(
          t('ordens.agendamento.toast.juntado', { code: o.codigo, principal: o.juntadoA.codigo }),
        )
      else toast.success(t('ordens.agendamento.toast.created', { code: o.codigo }))
    },
    onError: (e) =>
      toast.error(t('ordens.agendamento.toast.failed'), { description: apiErrorMessage(e) }),
  })
}

/** Detalhe do lote (etapas, pallets, ocorrências e histórico vêm juntos). */
export const useLote = (id: string) =>
  useQuery({ queryKey: ordensKeys.detalhe(id), queryFn: ({ signal }) => obterOrdem(id, signal) })

/**
 * O espelho do lote que veio de outro sistema (Gerenciamento de Projetos): buscado ao vivo lá, só
 * quando o lote é de fora. Sem nova tentativa — fora do ar, a tela diz e segue.
 */
export const useEspelhoDoLote = (id: string, deFora: boolean) =>
  useQuery({
    queryKey: ordensKeys.espelho(id),
    queryFn: ({ signal }) => obterEspelhoDoLote(id, signal),
    enabled: deFora,
    retry: false,
    staleTime: 30_000,
  })

/** Grava o lote devolvido pela API no cache e atualiza as listas. */
function useAtualizarLote() {
  const qc = useQueryClient()
  return (o: Ordem) => {
    qc.setQueryData(ordensKeys.detalhe(o.id), o)
    void qc.invalidateQueries({ queryKey: ['ordens', 'lista'] })
  }
}

export function useSalvarOcorrencia(ordemId: string) {
  const { t } = useTranslation()
  const atualizar = useAtualizarLote()
  return useMutation({
    mutationFn: ({
      ocorrenciaId,
      dados,
      fotos,
    }: {
      ocorrenciaId?: string
      dados: OcorrenciaInput
      fotos: File[]
    }) =>
      ocorrenciaId
        ? corrigirOcorrencia(ordemId, ocorrenciaId, dados, fotos)
        : registrarOcorrencia(ordemId, dados, fotos),
    onSuccess: (o, v) => {
      atualizar(o)
      toast.success(
        t(
          v.ocorrenciaId
            ? 'lotes.ocorrencias.toast.corrigida'
            : 'lotes.ocorrencias.toast.registrada',
        ),
      )
    },
    onError: (e) =>
      toast.error(t('lotes.ocorrencias.toast.falhou'), { description: apiErrorMessage(e) }),
  })
}

export function useCancelarOcorrencia(ordemId: string) {
  const { t } = useTranslation()
  const atualizar = useAtualizarLote()
  return useMutation({
    mutationFn: ({ ocorrenciaId }: { ocorrenciaId: string; numero: number }) =>
      cancelarOcorrencia(ordemId, ocorrenciaId),
    onSuccess: (o, v) => {
      atualizar(o)
      toast.success(t('lotes.ocorrencias.toast.cancelada', { numero: v.numero }))
    },
    onError: (e) =>
      toast.error(t('lotes.ocorrencias.toast.falhou'), { description: apiErrorMessage(e) }),
  })
}

export function useAdicionarDocumentos(ordemId: string) {
  const { t } = useTranslation()
  const atualizar = useAtualizarLote()
  return useMutation({
    mutationFn: ({ tipo, arquivos }: { tipo: TipoDocumentoLote; arquivos: File[] }) =>
      adicionarDocumentosLote(ordemId, tipo, arquivos),
    onSuccess: (o, v) => {
      atualizar(o)
      toast.success(t('lotes.documentos.toast.enviados', { n: v.arquivos.length }))
    },
    onError: (e) =>
      toast.error(t('lotes.documentos.toast.falhou'), { description: apiErrorMessage(e) }),
  })
}

export function useRemoverDocumento(ordemId: string) {
  const { t } = useTranslation()
  const atualizar = useAtualizarLote()
  return useMutation({
    mutationFn: ({ anexoId }: { anexoId: string; nome: string }) =>
      removerDocumentoLote(ordemId, anexoId),
    onSuccess: (o, v) => {
      atualizar(o)
      toast.success(t('lotes.documentos.toast.removido', { name: v.nome }))
    },
    onError: (e) =>
      toast.error(t('lotes.documentos.toast.falhouRemover'), { description: apiErrorMessage(e) }),
  })
}

export function useEditarLote(id: string) {
  const { t } = useTranslation()
  const atualizar = useAtualizarLote()
  return useMutation({
    mutationFn: (dados: OrdemInput) => editarOrdem(id, dados),
    onSuccess: (o) => {
      atualizar(o)
      toast.success(t('lotes.editar.toast.salvo', { code: o.codigo }))
    },
    onError: (e) =>
      toast.error(t('lotes.editar.toast.falhou'), { description: apiErrorMessage(e) }),
  })
}

export function useSalvarRecebimento() {
  const { t } = useTranslation()
  const atualizar = useAtualizarLote()
  return useMutation({
    mutationFn: (v: {
      ordemId: string
      dados: RecebimentoInput
      fotos: FotosRecebimento
      modo: 'receber' | 'corrigir'
    }) => salvarRecebimento(v.ordemId, v.dados, v.fotos, v.modo),
    onSuccess: (o, v) => {
      atualizar(o)
      toast.success(
        t(v.modo === 'receber' ? 'recebimento.toast.recebido' : 'recebimento.toast.corrigido', {
          code: o.codigo,
        }),
      )
    },
    onError: (e) => toast.error(t('recebimento.toast.falhou'), { description: apiErrorMessage(e) }),
  })
}
