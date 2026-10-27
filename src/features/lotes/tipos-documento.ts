import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import { apiErrorMessage } from '@/lib/api-errors'
import { textoNoIdioma, type LocalizedText } from '@/lib/localized-text'
import {
  criarTipoDocumento,
  listarTiposDocumento,
  tiposDocumentoKeys,
} from '@/services/tipos-documento'
import type { TipoDocLote } from '@/services/types'
import { useUiStore } from '@/stores/ui-store'

/*
 * Tipos de documento do lote (22/10/2026): a lista única, o nome de cada um no idioma da tela e
 * "não está na lista? crie aqui mesmo" (Configurações do cliente).
 */

/** Os do sistema (rótulo em `lotes.documentos.tipos.<codigo>`). */
export const TIPOS_DOC_SISTEMA = ['escopo', 'nota_fiscal', 'mtr', 'cdf', 'foto', 'outro'] as const
type TipoDoSistema = (typeof TIPOS_DOC_SISTEMA)[number]

const ehDoSistema = (codigo: string): codigo is TipoDoSistema =>
  (TIPOS_DOC_SISTEMA as readonly string[]).includes(codigo)

export const useTiposDocumento = () =>
  useQuery({
    queryKey: tiposDocumentoKeys.lista,
    queryFn: ({ signal }) => listarTiposDocumento(signal),
    staleTime: 5 * 60_000,
  })

/** O nome de um tipo pelo código (os criados vêm da lista; sem a lista, o código). */
export function useNomeDoTipo() {
  const { t } = useTranslation()
  const idioma = useUiStore((s) => s.language)
  const { data } = useTiposDocumento()
  return useCallback(
    (codigo: string, nome?: LocalizedText | null) => {
      if (ehDoSistema(codigo)) return t(`lotes.documentos.tipos.${codigo}`)
      const texto = nome ?? data?.find((x) => x.codigo === codigo)?.nome
      return texto ? textoNoIdioma(texto, idioma).texto : codigo
    },
    [t, idioma, data],
  )
}

export function useCriarTipoDocumento() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: criarTipoDocumento,
    onSuccess: (novo) => {
      qc.setQueryData<TipoDocLote[]>(tiposDocumentoKeys.lista, (l) => [...(l ?? []), novo])
    },
    onError: (e) =>
      toast.error(t('clientes.config.documentos.erroCriar'), { description: apiErrorMessage(e) }),
  })
}
