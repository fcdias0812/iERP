import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import { apiErrorMessage } from '@/lib/api-errors'
import { textoOriginal } from '@/lib/localized-text'
import { ApiError } from '@/services/http'
import {
  atualizarPerfil,
  criarPerfil,
  obterPerfil,
  perfisKeys,
  transicionarPerfil,
} from '@/services/perfis'
import type { AcaoCadastro, PerfilAcessoDetalhe, PerfilAcessoInput } from '@/services/types'

/*
 * Consultas e mutações de Administração › Perfis de acesso. A lista (`usePerfis`, em
 * hooks/use-can) é a mesma que dá as permissões das telas: salvar um perfil atualiza o menu na hora.
 */

function useAtualizar() {
  const qc = useQueryClient()
  return (p: PerfilAcessoDetalhe) => {
    qc.setQueryData(perfisKeys.detalhe(p.id), p)
    void qc.invalidateQueries({ queryKey: ['perfis'] })
    // A lista de usuários mostra o nome do perfil; a auditoria ganhou um evento.
    void qc.invalidateQueries({ queryKey: ['usuarios'] })
    void qc.invalidateQueries({ queryKey: ['auditoria'] })
  }
}

export const usePerfil = (id: string | undefined) =>
  useQuery({
    queryKey: perfisKeys.detalhe(id ?? ''),
    queryFn: ({ signal }) => obterPerfil(id!, signal),
    enabled: Boolean(id),
  })

export function useSalvarPerfil(id?: string) {
  const { t } = useTranslation()
  const atualizar = useAtualizar()
  return useMutation({
    mutationFn: (input: PerfilAcessoInput) =>
      id ? atualizarPerfil(id, input) : criarPerfil(input),
    onSuccess: (p) => {
      atualizar(p)
      toast.success(
        t(id ? 'perfis.toast.salvo' : 'perfis.toast.criado', { name: textoOriginal(p.nome) }),
      )
    },
    onError: (e) => {
      // Nome repetido aparece no próprio campo.
      if (e instanceof ApiError && e.code === 'name_in_use') return
      toast.error(t('perfis.toast.falhou'), { description: apiErrorMessage(e) })
    },
  })
}

export function useTransicaoPerfil() {
  const { t } = useTranslation()
  const atualizar = useAtualizar()
  return useMutation({
    mutationFn: ({ id, acao }: { id: string; acao: AcaoCadastro }) => transicionarPerfil(id, acao),
    onSuccess: (p, { acao }) => {
      atualizar(p)
      toast.success(t(`cadastros.toast.${acao}`, { name: textoOriginal(p.nome) }))
    },
    onError: (e) => toast.error(t('perfis.toast.falhou'), { description: apiErrorMessage(e) }),
  })
}
