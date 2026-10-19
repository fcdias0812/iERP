import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TableQuery } from '@/components/data-table/types'
import { toast } from '@/components/ui/sonner'
import { apiErrorMessage } from '@/lib/api-errors'
import { ApiError } from '@/services/http'
import type { AcaoCadastro } from '@/services/types'

/*
 * Consultas e mutações (TanStack Query) de um cadastro de Relacionamento — o mesmo molde para
 * Transportadoras, Motoristas e Veículos: lista, resumo, detalhe, salvar e inativar/reativar.
 */

interface Servicos<Pagina, Resumo, Detalhe, Input> {
  /** Raiz das chaves de cache (ex.: 'motoristas'). */
  raiz: string
  listar: (q: TableQuery, signal?: AbortSignal) => Promise<Pagina>
  resumo: () => Promise<Resumo>
  obter: (id: string, signal?: AbortSignal) => Promise<Detalhe>
  criar: (input: Input) => Promise<Detalhe>
  atualizar: (id: string, input: Input) => Promise<Detalhe>
  transicionar: (id: string, acao: AcaoCadastro) => Promise<Detalhe>
  /** Nome exibido nos avisos (ex.: o nome do motorista, o código do veículo). */
  nomeDe: (d: Detalhe) => string
  /** Prefixo das chaves i18n de aviso (ex.: 'motoristas' → motoristas.toast.*). */
  textos: 'transportadoras' | 'motoristas' | 'veiculos'
  /** Erros que a tela mostra no próprio campo (sem aviso). */
  errosDeCampo?: string[]
}

export function criarHooksCadastro<Pagina, Resumo, Detalhe, Input>(
  s: Servicos<Pagina, Resumo, Detalhe, Input>,
) {
  const chaves = {
    lista: (q: TableQuery) => [s.raiz, 'lista', q] as const,
    resumo: [s.raiz, 'resumo'] as const,
    detalhe: (id: string) => [s.raiz, 'detalhe', id] as const,
  }
  /** Variáveis dos avisos: `name` (pessoas/empresas) e `code` (veículos). */
  const vars = (d: Detalhe) => ({ name: s.nomeDe(d), code: s.nomeDe(d) })

  function useAtualizarCache() {
    const qc = useQueryClient()
    return (d?: Detalhe & { id?: string }) => {
      if (d?.id) qc.setQueryData(chaves.detalhe(d.id), d)
      void qc.invalidateQueries({ queryKey: [s.raiz, 'lista'] })
      void qc.invalidateQueries({ queryKey: chaves.resumo })
    }
  }

  const ehErroDeCampo = (e: unknown) =>
    e instanceof ApiError && Boolean(s.errosDeCampo?.includes(e.code))

  return {
    chaves,
    ehErroDeCampo,

    useLista: (q: TableQuery) =>
      useQuery({
        queryKey: chaves.lista(q),
        queryFn: ({ signal }) => s.listar(q, signal),
        placeholderData: keepPreviousData,
      }),

    useResumo: () => useQuery({ queryKey: chaves.resumo, queryFn: s.resumo }),

    useDetalhe: (id: string | undefined) =>
      useQuery({
        queryKey: chaves.detalhe(id ?? ''),
        queryFn: ({ signal }) => s.obter(id!, signal),
        enabled: Boolean(id),
      }),

    useSalvar(id?: string) {
      const { t } = useTranslation()
      const atualizar = useAtualizarCache()
      const qc = useQueryClient()
      return useMutation({
        mutationFn: (input: Input) => (id ? s.atualizar(id, input) : s.criar(input)),
        onSuccess: (d) => {
          atualizar(d as Detalhe & { id?: string })
          // Vínculos (transportadora ↔ motorista) mudam as outras listas também.
          void qc.invalidateQueries({ queryKey: ['transportadoras'] })
          void qc.invalidateQueries({ queryKey: ['motoristas'] })
          toast.success(t(`${s.textos}.toast.${id ? 'saved' : 'created'}`, vars(d)))
        },
        onError: (e) => {
          if (ehErroDeCampo(e)) return
          toast.error(t(`${s.textos}.toast.saveFailed`), { description: apiErrorMessage(e) })
        },
      })
    },

    useTransicao() {
      const { t } = useTranslation()
      const atualizar = useAtualizarCache()
      return useMutation({
        mutationFn: ({ id, acao }: { id: string; acao: AcaoCadastro }) => s.transicionar(id, acao),
        onSuccess: (d, { acao }) => {
          atualizar(d as Detalhe & { id?: string })
          toast.success(t(`${s.textos}.toast.acao.${acao}`, vars(d)))
        },
        onError: (e) =>
          toast.error(t(`${s.textos}.toast.actionFailed`), { description: apiErrorMessage(e) }),
      })
    },
  }
}
