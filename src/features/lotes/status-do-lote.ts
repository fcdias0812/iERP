import type { TFunction } from 'i18next'
import type { OrdemResumo } from '@/services/types'

/* Texto do status do lote — com a fase do sistema de fora (MoonShot) no "Processo". */

export type LoteComStatus = Pick<OrdemResumo, 'status' | 'processamento'>

/** O texto do status (com a fase do sistema de fora, quando houver). */
export function rotuloDoStatus(t: TFunction, lote: LoteComStatus): string {
  const p = lote.processamento
  if (lote.status === 'processo' && p?.indice != null)
    return p.etapa
      ? t('lotes.processamento.rotulo', { i: p.indice, n: p.total ?? '?', etapa: p.etapa })
      : t('lotes.processamento.rotuloSemEtapa', { i: p.indice, n: p.total ?? '?' })
  return t(`status.${lote.status}`)
}
