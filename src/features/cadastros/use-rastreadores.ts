import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import { apiErrorMessage } from '@/lib/api-errors'
import {
  editarRastreador,
  lerGpsAgora,
  listarRastreadores,
  obterRastreador,
  rastreadoresKeys,
  transicionarRastreador,
} from '@/services/rastreadores'
import { usarRastreador } from '@/services/viagens'

/* Rastreadores GPS (aparelhos dos caminhões) e o "Usar rastreador" da viagem. */

export const useRastreadores = () =>
  useQuery({
    queryKey: rastreadoresKeys.lista(),
    queryFn: ({ signal }) => listarRastreadores(signal),
    refetchInterval: 60_000,
  })

export const useRastreador = (id: string | undefined) =>
  useQuery({
    queryKey: rastreadoresKeys.detalhe(id ?? ''),
    queryFn: ({ signal }) => obterRastreador(id!, signal),
    enabled: Boolean(id),
  })

export function useEditarRastreador(id: string) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (d: { placa: string | null; descricao: string | null }) => editarRastreador(id, d),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: rastreadoresKeys.todos })
      toast.success(t('cadastros.rastreadores.toast.salvo', { name: r.deviceId }))
    },
    onError: (e) =>
      toast.error(t('cadastros.toast.saveFailed'), { description: apiErrorMessage(e) }),
  })
}

export function useTransicaoRastreador() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, acao }: { id: string; acao: 'inativar' | 'reativar' }) =>
      transicionarRastreador(id, acao),
    onSuccess: (r, { acao }) => {
      void qc.invalidateQueries({ queryKey: rastreadoresKeys.todos })
      toast.success(t(`cadastros.toast.${acao}`, { name: r.deviceId }))
    },
    onError: (e) =>
      toast.error(t('cadastros.toast.actionFailed'), { description: apiErrorMessage(e) }),
  })
}

export function useLerGpsAgora() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: lerGpsAgora,
    onSuccess: (lista) => {
      qc.setQueryData(rastreadoresKeys.lista(), lista)
      toast.success(t('cadastros.rastreadores.toast.lido'))
    },
    onError: (e) =>
      toast.error(t('cadastros.rastreadores.toast.falhou'), { description: apiErrorMessage(e) }),
  })
}

export function useUsarRastreador() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ viagemId, rastreadorId }: { viagemId: string; rastreadorId: string }) =>
      usarRastreador(viagemId, rastreadorId),
    onSuccess: (v) => {
      void qc.invalidateQueries({ queryKey: ['viagens'] })
      void qc.invalidateQueries({ queryKey: rastreadoresKeys.todos })
      toast.success(t('viagens.rastreador.iniciada', { code: v.loteCodigo, n: v.numero }))
    },
    onError: (e) => toast.error(t('viagens.toast.falhou'), { description: apiErrorMessage(e) }),
  })
}
