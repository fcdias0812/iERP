import { dayKey, isEmpty } from './engine'
import { formatValue, isNumeric } from './format'
import type { DataTableColumn } from './types'

/*
 * Exportação CSV / Excel / PDF das colunas VISÍVEIS, na ordem da tela, de TODOS os
 * resultados filtrados (não só da página). ExcelJS e jsPDF são carregados sob demanda.
 */

export type ExportFormat = 'csv' | 'xlsx' | 'pdf'

function fileName(base: string, ext: string) {
  const today = dayKey(new Date()) ?? 'hoje'
  return `${base}-${today}.${ext}`
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function textOf<T>(col: DataTableColumn<T>, row: T): string {
  if (col.exportValue) {
    const v = col.exportValue(row)
    return v === null ? '' : String(v)
  }
  const v = col.accessor(row)
  return isEmpty(v) ? '' : formatValue(col, v)
}

/** CSV com ";" (padrão do Excel em pt-BR) e BOM para acentos. */
export function toCsv<T>(columns: DataTableColumn<T>[], rows: T[]): string {
  const esc = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const lines = [columns.map((c) => esc(c.header)).join(';')]
  for (const row of rows) lines.push(columns.map((c) => esc(textOf(c, row))).join(';'))
  const BOM = String.fromCharCode(0xfeff)
  const CRLF = String.fromCharCode(13, 10)
  return BOM + lines.join(CRLF)
}

export async function exportRows<T>(
  format: ExportFormat,
  columns: DataTableColumn<T>[],
  rows: T[],
  baseName: string,
  title: string,
) {
  if (format === 'csv') {
    download(
      new Blob([toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' }),
      fileName(baseName, 'csv'),
    )
    return
  }

  if (format === 'xlsx') {
    const { default: ExcelJS } = await import('exceljs')
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(title.slice(0, 31))
    ws.columns = columns.map((c) => ({
      header: c.header,
      key: c.id,
      width: Math.max(12, Math.round((c.size ?? 140) / 7)),
      style:
        c.type === 'currency'
          ? { numFmt: '"R$" #,##0.00' }
          : c.type === 'date'
            ? { numFmt: 'dd/mm/yyyy' }
            : {},
    }))
    ws.getRow(1).font = { bold: true }
    for (const row of rows) {
      const values: Record<string, unknown> = {}
      for (const c of columns) {
        const v = c.accessor(row)
        if (c.exportValue) values[c.id] = c.exportValue(row)
        else if (isEmpty(v)) values[c.id] = null
        else if (isNumeric(c.type)) values[c.id] = Number(v)
        else if (c.type === 'date') values[c.id] = new Date(String(v))
        else values[c.id] = formatValue(c, v)
      }
      ws.addRow(values)
    }
    const buf = await wb.xlsx.writeBuffer()
    download(
      new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      fileName(baseName, 'xlsx'),
    )
    return
  }

  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait' })
  doc.setFontSize(12)
  doc.text(title, 14, 14)
  autoTable(doc, {
    startY: 20,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => textOf(c, r))),
    styles: { fontSize: 8 },
    columnStyles: Object.fromEntries(
      columns.map((c, i) => [i, isNumeric(c.type) ? { halign: 'right' as const } : {}]),
    ),
  })
  doc.save(fileName(baseName, 'pdf'))
}
