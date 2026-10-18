import type { ReactNode } from 'react'
import { StatusBadge } from '@/components/ui/status-badge'
import { EMPTY, formatCurrency, formatDate, formatNumber } from '@/lib/format'
import type { StatusId } from '@/lib/status/statusMap'
import { displayText, isEmpty } from './engine'
import type { ColumnType, DataTableColumn } from './types'

/** Colunas numéricas ficam alinhadas à direita. */
export function isNumeric(type: ColumnType) {
  return type === 'number' || type === 'currency'
}

/** Texto do valor formatado pelo tipo (exportação, chips, cards). */
export function formatValue<T>(col: DataTableColumn<T>, v: unknown): string {
  if (isEmpty(v)) return EMPTY
  switch (col.type) {
    case 'currency':
      return formatCurrency(Number(v))
    case 'number':
      return formatNumber(Number(v))
    case 'date':
      return formatDate(v as string)
    default:
      return displayText(col, v)
  }
}

/** Célula padrão pelo tipo (quando a coluna não define `cell`). */
export function renderCell<T>(col: DataTableColumn<T>, row: T): ReactNode {
  if (col.cell) return col.cell(row)
  const v = col.accessor(row)
  if (isEmpty(v)) return <span className="text-muted-foreground">{EMPTY}</span>
  if (col.type === 'status') return <StatusBadge status={v as StatusId} size="sm" />
  if (col.type === 'unique-text') return <span className="font-medium">{String(v)}</span>
  return formatValue(col, v)
}
