import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TableQuery } from '@/components/data-table/types'
import { toast } from '@/components/ui/sonner'
import { apiErrorMessage } from '@/lib/api-errors'
import { ApiError } from '@/services/http'
import type { AcaoUsuario, Usuario, UsuarioInput } from '@/services/types'
import {
  atualizarUsuario,
  criarUsuario,
  listarUsuarios,
  obterUsuario,
  resumoUsuarios,
  transicionarUsuario,
  usuariosKeys,
} from '@/services/usuarios'

/* Consultas e mutações de usuários (TanStack Query) — usadas pelas telas. */

export function useUsuariosLista(query: TableQuery) {
  return useQuery({
    queryKey: usuariosKeys.lista(query),
    queryFn: ({ signal }) => listarUsuarios(query, signal),
    // Mantém a página anterior enquanto a próxima carrega (sem "piscar").
    placeholderData: keepPreviousData,
  })
}

export const useUsuariosResumo = () =>
  useQuery({ queryKey: usuariosKeys.resumo(), queryFn: resumoUsuarios })

export function useUsuario(id: string) {
  return useQuery({
    queryKey: usuariosKeys.detalhe(id),
    queryFn: ({ signal }) => obterUsuario(id, signal),
  })
}

/** Atualiza o cache do detalhe e invalida listas/resumo depois de mudar um usuário. */
function useAtualizarCache() {
  const qc = useQueryClient()
  return (usuario?: Usuario) => {
    if (usuario) qc.setQueryData(usuariosKeys.detalhe(usuario.id), usuario)
    void qc.invalidateQueries({ queryKey: ['usuarios', 'lista'] })
    void qc.invalidateQueries({ queryKey: usuariosKeys.resumo() })
  }
}

/** E-mail já usado por outro usuário: a tela mostra o erro no próprio campo (sem toast). */
export const isEmailEmUso = (e: unknown) => e instanceof ApiError && e.code === 'email_in_use'

export function useSalvarUsuario(id?: string) {
  const { t } = useTranslation()
  const atualizar = useAtualizarCache()
  return useMutation({
    mutationFn: (input: UsuarioInput) => (id ? atualizarUsuario(id, input) : criarUsuario(input)),
    onSuccess: (u) => {
      atualizar(u)
      toast.success(
        id
          ? t('usuarios.toast.saved', { name: u.nome })
          : t('usuarios.toast.created', { name: u.nome }),
      )
    },
    onError: (e) => {
      if (isEmailEmUso(e)) return
      toast.error(t('usuarios.toast.saveFailed'), { description: apiErrorMessage(e) })
    },
  })
}

export function useTransicaoUsuario() {
  const { t } = useTranslation()
  const atualizar = useAtualizarCache()
  return useMutation({
    mutationFn: ({ id, acao, motivo }: { id: string; acao: AcaoUsuario; motivo?: string }) =>
      transicionarUsuario(id, acao, motivo),
    onSuccess: (u, { acao }) => {
      atualizar(u)
      toast.success(t(`usuarios.toast.acao.${acao}`, { name: u.nome }))
    },
    onError: (e) =>
      toast.error(t('usuarios.toast.actionFailed'), { description: apiErrorMessage(e) }),
  })
}
