import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TableQuery } from '@/components/data-table/types'
import { toast } from '@/components/ui/sonner'
import { apiErrorMessage } from '@/lib/api-errors'
import {
  atualizarCliente,
  atualizarSite,
  clientesKeys,
  criarCliente,
  criarSite,
  enviarDocumento,
  listarClientes,
  listarDocumentos,
  listarSites,
  obterCliente,
  removerDocumento,
  removerSite,
  resumoClientes,
  resumoLotesCliente,
  desativarLinkRastreio,
  gerarLinkRastreio,
  salvarConfiguracoesCliente,
  transicionarCliente,
} from '@/services/clientes'
import { ApiError } from '@/services/http'
import type {
  AcaoCliente,
  Cliente,
  ClienteInput,
  ConfiguracoesClienteInput,
  SiteInput,
  TipoDocumento,
} from '@/services/types'

/* Consultas e mutações de clientes (TanStack Query) — usadas pelas telas. */

export function useClientesLista(query: TableQuery) {
  return useQuery({
    queryKey: clientesKeys.lista(query),
    queryFn: ({ signal }) => listarClientes(query, signal),
    // Mantém a página anterior enquanto a próxima carrega (sem "piscar").
    placeholderData: keepPreviousData,
  })
}

export const useClientesResumo = () =>
  useQuery({ queryKey: clientesKeys.resumo(), queryFn: resumoClientes })

export function useCliente(id: string | undefined) {
  return useQuery({
    queryKey: clientesKeys.detalhe(id ?? ''),
    queryFn: ({ signal }) => obterCliente(id!, signal),
    enabled: Boolean(id),
  })
}

/** Atualiza o cache do detalhe e invalida listas/resumo depois de mudar um cliente. */
function useAtualizarCache() {
  const qc = useQueryClient()
  return (cliente?: Cliente) => {
    if (cliente) qc.setQueryData(clientesKeys.detalhe(cliente.id), cliente)
    void qc.invalidateQueries({ queryKey: ['clientes', 'lista'] })
    void qc.invalidateQueries({ queryKey: clientesKeys.resumo() })
  }
}

/** CNPJ já usado por outro cliente: a tela mostra o erro no próprio campo (sem toast). */
export const isCnpjEmUso = (e: unknown) => e instanceof ApiError && e.code === 'cnpj_in_use'

export function useSalvarCliente(id?: string) {
  const { t } = useTranslation()
  const atualizar = useAtualizarCache()
  return useMutation({
    mutationFn: (input: ClienteInput) => (id ? atualizarCliente(id, input) : criarCliente(input)),
    onSuccess: (c) => {
      atualizar(c)
      toast.success(
        id
          ? t('clientes.toast.saved', { name: c.nome })
          : t('clientes.toast.created', { name: c.nome }),
      )
    },
    onError: (e) => {
      if (isCnpjEmUso(e)) return
      toast.error(t('clientes.toast.saveFailed'), { description: apiErrorMessage(e) })
    },
  })
}

export function useSalvarConfiguracoes(id: string) {
  const { t } = useTranslation()
  const atualizar = useAtualizarCache()
  return useMutation({
    mutationFn: (input: ConfiguracoesClienteInput) => salvarConfiguracoesCliente(id, input),
    onSuccess: (c) => {
      atualizar(c)
      toast.success(t('clientes.config.toast.saved', { name: c.nome }))
    },
    onError: (e) =>
      toast.error(t('clientes.toast.saveFailed'), { description: apiErrorMessage(e) }),
  })
}

/** Link público de acompanhamento: gerar (ou trocar) e desativar. */
export function useLinkRastreio(id: string) {
  const { t } = useTranslation()
  const atualizar = useAtualizarCache()
  const falhou = (e: unknown) =>
    toast.error(t('clientes.toast.actionFailed'), { description: apiErrorMessage(e) })
  const gerar = useMutation({
    mutationFn: () => gerarLinkRastreio(id),
    onSuccess: (c) => {
      atualizar(c)
      toast.success(t('clientes.rastreio.toast.gerado'))
    },
    onError: falhou,
  })
  const desativar = useMutation({
    mutationFn: () => desativarLinkRastreio(id),
    onSuccess: (c) => {
      atualizar(c)
      toast.success(t('clientes.rastreio.toast.desativado'))
    },
    onError: falhou,
  })
  return { gerar, desativar }
}

export function useTransicaoCliente() {
  const { t } = useTranslation()
  const atualizar = useAtualizarCache()
  return useMutation({
    mutationFn: ({ id, acao }: { id: string; acao: AcaoCliente }) => transicionarCliente(id, acao),
    onSuccess: (c, { acao }) => {
      atualizar(c)
      toast.success(t(`clientes.toast.acao.${acao}`, { name: c.nome }))
    },
    onError: (e) =>
      toast.error(t('clientes.toast.actionFailed'), { description: apiErrorMessage(e) }),
  })
}

/* ------------------------------------------------------------ abas do detalhe */

/** Depois de mudar algo do cliente (site, documento): histórico, contatos e lista em dia. */
function useAtualizarDetalhe(clienteId: string) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: clientesKeys.detalhe(clienteId) })
    void qc.invalidateQueries({ queryKey: ['clientes', 'lista'] })
  }
}

export const useLotesResumo = (clienteId: string) =>
  useQuery({
    queryKey: clientesKeys.lotes(clienteId),
    queryFn: () => resumoLotesCliente(clienteId),
  })

export const useSites = (clienteId: string) =>
  useQuery({ queryKey: clientesKeys.sites(clienteId), queryFn: () => listarSites(clienteId) })

export function useSalvarSite(clienteId: string, siteId?: string) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const atualizarDetalhe = useAtualizarDetalhe(clienteId)
  return useMutation({
    mutationFn: (input: SiteInput) =>
      siteId ? atualizarSite(clienteId, siteId, input) : criarSite(clienteId, input),
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: clientesKeys.sites(clienteId) })
      atualizarDetalhe()
      toast.success(
        siteId
          ? t('clientes.sites.toast.saved', { code: s.codigo })
          : t('clientes.sites.toast.created', { code: s.codigo }),
      )
    },
    onError: (e) => {
      if (isCodigoSiteEmUso(e)) return
      toast.error(t('clientes.sites.toast.saveFailed'), { description: apiErrorMessage(e) })
    },
  })
}

/** Código de site repetido: a tela mostra o erro no próprio campo (sem toast). */
export const isCodigoSiteEmUso = (e: unknown) =>
  e instanceof ApiError && e.code === 'site_code_in_use'

export function useRemoverSite(clienteId: string) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const atualizarDetalhe = useAtualizarDetalhe(clienteId)
  return useMutation({
    mutationFn: ({ siteId }: { siteId: string; codigo: string }) => removerSite(clienteId, siteId),
    onSuccess: (_, { codigo }) => {
      void qc.invalidateQueries({ queryKey: clientesKeys.sites(clienteId) })
      atualizarDetalhe()
      toast.success(t('clientes.sites.toast.removed', { code: codigo }))
    },
    onError: (e) =>
      toast.error(t('clientes.toast.actionFailed'), { description: apiErrorMessage(e) }),
  })
}

export const useDocumentos = (clienteId: string) =>
  useQuery({
    queryKey: clientesKeys.documentos(clienteId),
    queryFn: () => listarDocumentos(clienteId),
  })

export function useEnviarDocumento(clienteId: string) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const atualizarDetalhe = useAtualizarDetalhe(clienteId)
  return useMutation({
    mutationFn: ({ arquivo, tipo }: { arquivo: File; tipo: TipoDocumento }) =>
      enviarDocumento(clienteId, arquivo, tipo),
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: clientesKeys.documentos(clienteId) })
      atualizarDetalhe()
      toast.success(t('clientes.documentos.toast.sent', { name: d.nome }))
    },
    onError: (e, { arquivo }) =>
      toast.error(t('clientes.documentos.toast.sendFailed', { name: arquivo.name }), {
        description: apiErrorMessage(e),
      }),
  })
}

export function useRemoverDocumento(clienteId: string) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const atualizarDetalhe = useAtualizarDetalhe(clienteId)
  return useMutation({
    mutationFn: ({ docId }: { docId: string; nome: string }) => removerDocumento(clienteId, docId),
    onSuccess: (_, { nome }) => {
      void qc.invalidateQueries({ queryKey: clientesKeys.documentos(clienteId) })
      atualizarDetalhe()
      toast.success(t('clientes.documentos.toast.removed', { name: nome }))
    },
    onError: (e) =>
      toast.error(t('clientes.toast.actionFailed'), { description: apiErrorMessage(e) }),
  })
}
