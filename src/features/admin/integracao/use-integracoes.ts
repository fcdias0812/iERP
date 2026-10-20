import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import { apiErrorMessage } from '@/lib/api-errors'
import {
  atualizarIntegracao,
  criarIntegracao,
  gerarChaveIntegracao,
  integracoesKeys,
  listarIntegracoes,
  listarSistemasIntegraveis,
  obterIntegracao,
  revogarChaveIntegracao,
  transicionarIntegracao,
} from '@/services/integracoes'
import type { AcaoCadastro, IntegracaoDetalhe, IntegracaoInput } from '@/services/types'

/* Consultas e mutações de Administração › Integração. */

export const useIntegracoes = () =>
  useQuery({
    queryKey: integracoesKeys.lista,
    queryFn: ({ signal }) => listarIntegracoes(signal),
    // Último contato, avisos pendentes e erros mudam sozinhos (trabalho de fundo).
    refetchInterval: 30_000,
  })

export const useSistemasIntegraveis = () =>
  useQuery({
    queryKey: integracoesKeys.sistemas,
    queryFn: ({ signal }) => listarSistemasIntegraveis(signal),
    staleTime: Infinity,
  })

export const useIntegracao = (id: string | undefined) =>
  useQuery({
    queryKey: integracoesKeys.detalhe(id ?? ''),
    queryFn: ({ signal }) => obterIntegracao(id!, signal),
    enabled: Boolean(id),
  })

function useAtualizar() {
  const qc = useQueryClient()
  return (d: IntegracaoDetalhe) => {
    qc.setQueryData(integracoesKeys.detalhe(d.id), d)
    void qc.invalidateQueries({ queryKey: integracoesKeys.lista })
    void qc.invalidateQueries({ queryKey: ['auditoria'] })
  }
}

export function useSalvarIntegracao(id?: string) {
  const { t } = useTranslation()
  const atualizar = useAtualizar()
  return useMutation({
    mutationFn: (input: IntegracaoInput) =>
      id ? atualizarIntegracao(id, input) : criarIntegracao(input),
    onSuccess: (d) => {
      atualizar(d)
      toast.success(t(id ? 'integracao.toast.salvo' : 'integracao.toast.criado', { name: d.nome }))
    },
    onError: (e) => toast.error(t('integracao.toast.falhou'), { description: apiErrorMessage(e) }),
  })
}

export function useGerarChave() {
  const { t } = useTranslation()
  const atualizar = useAtualizar()
  return useMutation({
    mutationFn: (id: string) => gerarChaveIntegracao(id),
    onSuccess: (r) => atualizar(r.integracao),
    onError: (e) => toast.error(t('integracao.toast.falhou'), { description: apiErrorMessage(e) }),
  })
}

export function useRevogarChave() {
  const { t } = useTranslation()
  const atualizar = useAtualizar()
  return useMutation({
    mutationFn: (id: string) => revogarChaveIntegracao(id),
    onSuccess: (d) => {
      atualizar(d)
      toast.success(t('integracao.toast.chaveRevogada', { name: d.nome }))
    },
    onError: (e) => toast.error(t('integracao.toast.falhou'), { description: apiErrorMessage(e) }),
  })
}

export function useTransicaoIntegracao() {
  const { t } = useTranslation()
  const atualizar = useAtualizar()
  return useMutation({
    mutationFn: ({ id, acao }: { id: string; acao: AcaoCadastro }) =>
      transicionarIntegracao(id, acao),
    onSuccess: (d, { acao }) => {
      atualizar(d)
      toast.success(t(`cadastros.toast.${acao}`, { name: d.nome }))
    },
    onError: (e) => toast.error(t('integracao.toast.falhou'), { description: apiErrorMessage(e) }),
  })
}
