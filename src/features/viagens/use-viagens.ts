import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import { apiErrorMessage } from '@/lib/api-errors'
import {
  cienteEmergenciaViagem,
  enviarChatViagem,
  finalizarViagem,
  lerChatViagem,
  listarViagens,
  obterViagem,
  poisDaEstrada,
  viagensDoLote,
  adicionarCaminhao,
  adicionarRastreio,
  viagensKeys,
  type SituacaoViagens,
} from '@/services/viagens'

/*
 * Consultas e ações de Ordens › Viagens. A lista das abertas se atualiza sozinha a cada 5 s (o
 * servidor ouve o rastreador ao vivo — o navegador só pergunta a ele).
 */

/** De quanto em quanto tempo a tela pergunta as posições (ms). */
export const ATUALIZAR_MS = 5_000

export const useViagens = (situacao: SituacaoViagens, desde?: string) =>
  useQuery({
    queryKey: viagensKeys.lista(situacao, desde),
    queryFn: ({ signal }) => listarViagens(situacao, desde, signal),
    refetchInterval: situacao === 'abertas' ? ATUALIZAR_MS : false,
    placeholderData: keepPreviousData,
  })

/** Detalhe com o trajeto: na rua, relê a cada 15 s; terminada, uma vez. */
export const useViagem = (id: string | undefined, naRua: boolean) =>
  useQuery({
    queryKey: viagensKeys.detalhe(id ?? ''),
    queryFn: ({ signal }) => obterViagem(id!, signal),
    enabled: Boolean(id),
    refetchInterval: naRua ? 15_000 : false,
    placeholderData: keepPreviousData,
  })

export const useViagensDoLote = (ordemId: string, ligado = true) =>
  useQuery({
    queryKey: viagensKeys.doLote(ordemId),
    queryFn: ({ signal }) => viagensDoLote(ordemId, signal),
    enabled: ligado && Boolean(ordemId),
    refetchInterval: 15_000,
  })

export const useChatViagem = (id: string | undefined) =>
  useQuery({
    queryKey: viagensKeys.chat(id ?? ''),
    queryFn: ({ signal }) => lerChatViagem(id!, signal),
    enabled: Boolean(id),
    refetchInterval: ATUALIZAR_MS,
  })

export const usePoisDaEstrada = (caixa: { s: number; w: number; n: number; e: number } | null) =>
  useQuery({
    queryKey: viagensKeys.pois(caixa ? `${caixa.s}|${caixa.w}|${caixa.n}|${caixa.e}` : ''),
    queryFn: ({ signal }) => poisDaEstrada(caixa!, signal),
    enabled: Boolean(caixa),
    staleTime: 60 * 60_000,
    placeholderData: keepPreviousData,
  })

export function useEnviarChat(id: string) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (texto: string) => enviarChatViagem(id, texto),
    onSuccess: (msgs) => qc.setQueryData(viagensKeys.chat(id), msgs),
    onError: (e) => toast.error(t('viagens.chat.falhou'), { description: apiErrorMessage(e) }),
  })
}

/** "Adicionar caminhão": mais uma viagem no lote (o detalhe do lote e as viagens se atualizam). */
export function useAdicionarCaminhao(ordemId: string) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (c: { motoristaId: string | null; placa: string | null }) =>
      adicionarCaminhao(ordemId, c),
    onSuccess: (v) => {
      void qc.invalidateQueries({ queryKey: viagensKeys.todas })
      void qc.invalidateQueries({ queryKey: ['ordens'] })
      toast.success(t('viagens.caminhao.adicionado', { n: v.numero }))
    },
    onError: (e) => toast.error(t('viagens.toast.falhou'), { description: apiErrorMessage(e) }),
  })
}

/**
 * "Nova viagem" em Ordens › Viagens (28/10/2026): mais um caminhão no lote escolhido lá, com o
 * rastreador (celular ou aparelho de GPS).
 */
export function useNovaViagem() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (d: {
      ordemId: string
      motoristaId: string | null
      placa: string | null
      rastreadorId: string | null
    }) => adicionarCaminhao(d.ordemId, d),
    onSuccess: (v) => {
      void qc.invalidateQueries({ queryKey: viagensKeys.todas })
      void qc.invalidateQueries({ queryKey: ['ordens'] })
      toast.success(t('viagens.nova.criada', { code: v.loteCodigo, n: v.numero }))
    },
    onError: (e) => toast.error(t('viagens.nova.falhou'), { description: apiErrorMessage(e) }),
  })
}

/** "Adicionar rastreador" no card do caminhão (28/10/2026). */
export function useAdicionarRastreio() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (d: { viagemId: string; rastreadorId: string | null }) =>
      adicionarRastreio(d.viagemId, d.rastreadorId),
    onSuccess: (v) => {
      void qc.invalidateQueries({ queryKey: viagensKeys.todas })
      void qc.invalidateQueries({ queryKey: ['ordens'] })
      void qc.invalidateQueries({ queryKey: ['rastreadores'] })
      toast.success(t('viagens.rastreios.adicionado', { n: v.numero }))
    },
    onError: (e) => toast.error(t('viagens.rastreios.falhou'), { description: apiErrorMessage(e) }),
  })
}

export function useFinalizarViagem() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => finalizarViagem(id),
    onSuccess: (v) => {
      void qc.invalidateQueries({ queryKey: viagensKeys.todas })
      toast.success(t('viagens.toast.finalizada', { code: v.loteCodigo }))
    },
    onError: (e) => toast.error(t('viagens.toast.falhou'), { description: apiErrorMessage(e) }),
  })
}

export function useCienteEmergencia() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cienteEmergenciaViagem(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: viagensKeys.todas })
      toast.success(t('viagens.toast.ciente'))
    },
    onError: (e) => toast.error(t('viagens.toast.falhou'), { description: apiErrorMessage(e) }),
  })
}
