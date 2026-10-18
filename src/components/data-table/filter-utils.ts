import { STATUS_IDS, type StatusId } from '@/lib/status/statusMap'
import { displayText } from './engine'
import type { DataTableColumn } from './types'

/* ------------------------------------------------------------ helpers de data */

/** "yyyy-mm-dd" → Date (meio-dia, para não virar o dia anterior por fuso). */
export const parseDay = (s?: string) => (s ? new Date(`${s}T12:00:00`) : undefined)
/** Date → "yyyy-mm-dd" (dia local escolhido no calendário). */
export const toDay = (d?: Date) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : undefined

/** Opções (valor + rótulo) de uma coluna enum/status. */
export function columnOptions<T>(col: DataTableColumn<T>): { value: string; label: string }[] {
  if (col.type === 'status') {
    const ids = col.options?.map((o) => o.value) ?? STATUS_IDS
    return ids.map((v) => ({ value: v, label: displayText(col, v as StatusId) }))
  }
  return col.options ?? []
}
