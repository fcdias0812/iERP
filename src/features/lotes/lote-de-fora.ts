import { useTranslation } from 'react-i18next'
import { useEspelhoDoLote } from '@/features/ordens/use-ordens'
import type { Ordem } from '@/services/types'

/* Lote que veio de outro sistema (Gerenciamento de Projetos): hooks usados pelas abas do lote. */

/** Nome do sistema de onde o lote veio. */
export function useNomeDoSistema(o: Ordem) {
  const { t } = useTranslation()
  const codigo = o.externo?.sistema ?? ''
  return t(`integracao.sistemas.${codigo}`, { defaultValue: codigo })
}

/** O espelho do lote (buscado lá, ao vivo) — só quando o lote é de fora. */
export const useEspelho = (o: Ordem) => useEspelhoDoLote(o.id, Boolean(o.externo))

/** Totais do recebimento lá (para os cards do Progresso). */
export function usePesadoDeFora(o: Ordem) {
  const q = useEspelho(o)
  return { carregando: q.isPending && Boolean(o.externo), pesado: q.data?.pesado ?? null }
}
