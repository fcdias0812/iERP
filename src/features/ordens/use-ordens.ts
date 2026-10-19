import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TableQuery } from '@/components/data-table/types'
import { EMPTY_QUERY } from '@/components/data-table/types'
import { toast } from '@/components/ui/sonner'
import { apiErrorMessage } from '@/lib/api-errors'
import { clientesKeys, listarClientes, listarSites } from '@/services/clientes'
import { criarOrdem, listarOrdens, ordensKeys, preCalcularOrdem } from '@/services/ordens'
import type { OrdemInput } from '@/services/types'

/* Consultas e mutações de Ordens (agendamento e lista dos lotes agendados). */

export const useLotesAgendados = (query: TableQuery) =>
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
      toast.success(t('ordens.agendamento.toast.created', { code: o.codigo }))
    },
    onError: (e) =>
      toast.error(t('ordens.agendamento.toast.failed'), { description: apiErrorMessage(e) }),
  })
}
