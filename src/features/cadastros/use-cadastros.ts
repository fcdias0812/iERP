import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import { apiErrorMessage } from '@/lib/api-errors'
import { areasApi, materiaisApi, recipientesApi } from '@/services/cadastros'
import { ApiError } from '@/services/http'
import type { AcaoCadastro, TipoRecipiente } from '@/services/types'

/*
 * Consultas e mutações de Sistema › Cadastros. Mudar material ou área atualiza também as listas
 * de recipientes (que mostram o nome deles) — e vice-versa (contagem de recipientes).
 */

type Chave = 'materiais' | 'areas' | 'recipientes'
const RAIZES: Chave[] = ['materiais', 'areas', 'recipientes']

interface Api<Detalhe, Input> {
  obter: (id: string, signal?: AbortSignal) => Promise<Detalhe>
  criar: (input: Input) => Promise<Detalhe>
  atualizar: (id: string, input: Input) => Promise<Detalhe>
  transicionar: (id: string, acao: AcaoCadastro) => Promise<Detalhe>
}

function hooksDe<Detalhe extends { id: string }, Input>(
  raiz: Chave,
  apiDe: Api<Detalhe, Input>,
  /** Prefixo dos textos de aviso: cadastros.<textos>.toast.* */
  textos: 'materiais' | 'areas' | 'recipientes',
  nomeDe: (d: Detalhe) => string,
) {
  function useInvalidar() {
    const qc = useQueryClient()
    return (d: Detalhe) => {
      qc.setQueryData([raiz, 'detalhe', d.id], d)
      for (const r of RAIZES) void qc.invalidateQueries({ queryKey: [r] })
    }
  }
  return {
    useDetalhe: (id: string | undefined) =>
      useQuery({
        queryKey: [raiz, 'detalhe', id ?? ''],
        queryFn: ({ signal }) => apiDe.obter(id!, signal),
        enabled: Boolean(id),
      }),
    useSalvar(id?: string) {
      const { t } = useTranslation()
      const invalidar = useInvalidar()
      return useMutation({
        mutationFn: (input: Input) => (id ? apiDe.atualizar(id, input) : apiDe.criar(input)),
        onSuccess: (d) => {
          invalidar(d)
          toast.success(
            t(`cadastros.${textos}.toast.${id ? 'salvo' : 'criado'}`, { name: nomeDe(d) }),
          )
        },
        onError: (e) => {
          // Nome repetido aparece no próprio campo.
          if (e instanceof ApiError && e.code === 'name_in_use') return
          toast.error(t(`cadastros.${textos}.toast.falhou`), { description: apiErrorMessage(e) })
        },
      })
    },
    useTransicao() {
      const { t } = useTranslation()
      const invalidar = useInvalidar()
      return useMutation({
        mutationFn: ({ id, acao }: { id: string; acao: AcaoCadastro }) =>
          apiDe.transicionar(id, acao),
        onSuccess: (d, { acao }) => {
          invalidar(d)
          toast.success(t(`cadastros.toast.${acao}`, { name: nomeDe(d) }))
        },
        onError: (e) =>
          toast.error(t(`cadastros.${textos}.toast.falhou`), { description: apiErrorMessage(e) }),
      })
    },
  }
}

export const useMateriais = () =>
  useQuery({
    queryKey: ['materiais', 'lista'],
    queryFn: ({ signal }) => materiaisApi.listar(signal),
  })
export const useAreas = () =>
  useQuery({ queryKey: ['areas', 'lista'], queryFn: ({ signal }) => areasApi.listar(signal) })
export const useRecipientes = (tipo: TipoRecipiente) =>
  useQuery({
    queryKey: ['recipientes', 'lista', tipo],
    queryFn: ({ signal }) => recipientesApi.listar(signal, { tipo }),
  })

export const materiaisHooks = hooksDe(
  'materiais',
  materiaisApi,
  'materiais',
  (d) => d.nome.textos[d.nome.origem] ?? '',
)
export const areasHooks = hooksDe('areas', areasApi, 'areas', (d) => d.nome)
export const recipientesHooks = hooksDe(
  'recipientes',
  recipientesApi,
  'recipientes',
  (d) => d.codigo,
)
