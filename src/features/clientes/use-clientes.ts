import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TableQuery } from '@/components/data-table/types'
import { toast } from '@/components/ui/sonner'
import { apiErrorMessage } from '@/lib/api-errors'
import {
  atualizarCliente,
  clientesKeys,
  criarCliente,
  listarClientes,
  obterCliente,
  resumoClientes,
  transicionarCliente,
} from '@/services/clientes'
import { ApiError } from '@/services/http'
import type { AcaoCliente, Cliente, ClienteInput } from '@/services/types'

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

export function useCliente(id: string) {
  return useQuery({
    queryKey: clientesKeys.detalhe(id),
    queryFn: ({ signal }) => obterCliente(id, signal),
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
