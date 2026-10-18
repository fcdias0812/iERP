import { beforeAll, describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { toCsv } from './export'
import type { DataTableColumn } from './types'

interface Row {
  code: string
  name: string
  total: number | null
  status: string
}

const cols: DataTableColumn<Row>[] = [
  { id: 'code', header: 'Pedido', type: 'unique-text', accessor: (r) => r.code },
  { id: 'name', header: 'Cliente', type: 'unique-text', accessor: (r) => r.name },
  { id: 'total', header: 'Total', type: 'currency', accessor: (r) => r.total },
  { id: 'status', header: 'Status', type: 'status', accessor: (r) => r.status },
]

beforeAll(async () => {
  await i18n.changeLanguage('pt-BR')
})

describe('exportar CSV', () => {
  it('usa ";", escapa aspas e ponto e vírgula, formata pelo tipo e começa com BOM', () => {
    const csv = toCsv(cols, [
      { code: 'PV-1', name: 'Silva; Souza "Ltda"', total: 1234.5, status: 'aprovado' },
      { code: 'PV-2', name: 'Atlas', total: null, status: 'cancelado' },
    ])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.slice(1).split(String.fromCharCode(13, 10))
    expect(lines[0]).toBe('Pedido;Cliente;Total;Status')
    expect(lines[1]!.replace(/\s/g, ' ')).toBe('PV-1;"Silva; Souza ""Ltda""";R$ 1.234,50;Aprovado')
    expect(lines[2]).toBe('PV-2;Atlas;;Cancelado')
  })
})
