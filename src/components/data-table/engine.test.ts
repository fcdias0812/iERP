import { beforeAll, describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { dayKey, facetCounts, filterRows, runQuery, sortRows, type EngineColumn } from './engine'
import { queryToSearch, searchToQuery, tableSearchSchema } from './url-state'
import { EMPTY_QUERY, type TableQuery } from './types'

interface Row {
  id: string
  code: string
  status: string
  total: number | null
  date: string | null
  urgent: boolean
  seller: string | null
}

const rows: Row[] = [
  {
    id: 'r3',
    code: 'PV-003',
    status: 'entregue',
    total: 300,
    date: '2026-10-15T23:30:00-03:00',
    urgent: false,
    seller: 'b',
  },
  {
    id: 'r1',
    code: 'PV-001',
    status: 'rascunho',
    total: null,
    date: '2026-10-14T10:00:00-03:00',
    urgent: true,
    seller: 'a',
  },
  {
    id: 'r2',
    code: 'PV-002',
    status: 'aprovado',
    total: 100,
    date: null,
    urgent: false,
    seller: null,
  },
  {
    id: 'r4',
    code: 'PV-010',
    status: 'aprovado',
    total: 100,
    date: '2026-10-16T00:30:00-03:00',
    urgent: true,
    seller: 'a',
  },
]

const cols: (EngineColumn<Row> & { total?: boolean })[] = [
  { id: 'code', type: 'unique-text', accessor: (r) => r.code },
  { id: 'status', type: 'status', accessor: (r) => r.status },
  { id: 'total', type: 'currency', accessor: (r) => r.total, total: true },
  { id: 'date', type: 'date', accessor: (r) => r.date },
  { id: 'urgent', type: 'boolean', accessor: (r) => r.urgent },
  {
    id: 'seller',
    type: 'enum',
    accessor: (r) => r.seller,
    options: [
      { value: 'a', label: 'Zélia' },
      { value: 'b', label: 'Ana' },
    ],
  },
]
const id = (r: Row) => r.id
const q = (patch: Partial<TableQuery>): TableQuery => ({ ...EMPTY_QUERY, ...patch })
const ids = (list: Row[]) => list.map((r) => r.id)

beforeAll(async () => {
  await i18n.changeLanguage('pt-BR')
})

describe('ordenação', () => {
  it('vazios ficam no fim nas duas direções', () => {
    expect(ids(sortRows(rows, cols, [{ id: 'total', desc: false }], id)).at(-1)).toBe('r1')
    expect(ids(sortRows(rows, cols, [{ id: 'total', desc: true }], id)).at(-1)).toBe('r1')
    expect(ids(sortRows(rows, cols, [{ id: 'date', desc: true }], id)).at(-1)).toBe('r2')
  })

  it('desempate estável pelo ID', () => {
    // r2 e r4 têm o mesmo total: r2 vem antes (ID) nas duas direções.
    expect(ids(sortRows(rows, cols, [{ id: 'total', desc: false }], id))).toEqual([
      'r2',
      'r4',
      'r3',
      'r1',
    ])
    expect(ids(sortRows(rows, cols, [{ id: 'total', desc: true }], id))).toEqual([
      'r3',
      'r2',
      'r4',
      'r1',
    ])
  })

  it('status pela ordem do fluxo, não pelo texto', () => {
    // rascunho (10) → aprovado (60) → entregue (100)
    expect(ids(sortRows(rows, cols, [{ id: 'status', desc: false }], id))).toEqual([
      'r1',
      'r2',
      'r4',
      'r3',
    ])
  })

  it('enum pelo rótulo e texto com números naturais', () => {
    expect(ids(sortRows(rows, cols, [{ id: 'seller', desc: false }], id))).toEqual([
      'r3',
      'r1',
      'r4',
      'r2',
    ])
    expect(ids(sortRows(rows, cols, [{ id: 'code', desc: true }], id))).toEqual([
      'r4',
      'r3',
      'r2',
      'r1',
    ])
  })

  it('várias colunas', () => {
    const sorted = sortRows(
      rows,
      cols,
      [
        { id: 'urgent', desc: true },
        { id: 'code', desc: false },
      ],
      id,
    )
    expect(ids(sorted)).toEqual(['r1', 'r4', 'r2', 'r3'])
  })
})

describe('filtros', () => {
  it('período: o "até" inclui o dia inteiro (fuso de São Paulo)', () => {
    expect(dayKey('2026-10-16T02:30:00Z')).toBe('2026-10-15')
    const f = filterRows(
      rows,
      cols,
      q({ filters: [{ id: 'date', kind: 'dateRange', to: '2026-10-15' }] }),
    )
    expect(ids(f)).toEqual(['r3', 'r1'])
  })

  it('faixa numérica, multisseleção, texto e sim/não', () => {
    expect(
      ids(
        filterRows(
          rows,
          cols,
          q({ filters: [{ id: 'total', kind: 'range', min: 100, max: 200 }] }),
        ),
      ),
    ).toEqual(['r2', 'r4'])
    expect(
      ids(
        filterRows(
          rows,
          cols,
          q({ filters: [{ id: 'status', kind: 'in', values: ['aprovado'] }] }),
        ),
      ),
    ).toEqual(['r2', 'r4'])
    expect(
      ids(filterRows(rows, cols, q({ filters: [{ id: 'code', kind: 'text', value: '01' }] }))),
    ).toEqual(['r1', 'r4'])
    expect(
      ids(filterRows(rows, cols, q({ filters: [{ id: 'urgent', kind: 'bool', value: true }] }))),
    ).toEqual(['r1', 'r4'])
  })

  it('busca geral usa o texto exibido (rótulo do status)', () => {
    expect(ids(filterRows(rows, cols, q({ search: 'entreg' })))).toEqual(['r3'])
  })

  it('filtro avançado: operadores e E/OU', () => {
    const adv = (logic: 'and' | 'or', conditions: TableQuery['advanced']['conditions']) =>
      ids(filterRows(rows, cols, q({ advanced: { logic, conditions } })))
    expect(adv('and', [{ id: '1', columnId: 'total', op: 'gt', value: 100 }])).toEqual(['r3'])
    expect(adv('and', [{ id: '1', columnId: 'total', op: 'empty' }])).toEqual(['r1'])
    expect(adv('and', [{ id: '1', columnId: 'seller', op: 'notEmpty' }])).toEqual([
      'r3',
      'r1',
      'r4',
    ])
    expect(adv('and', [{ id: '1', columnId: 'code', op: 'startsWith', value: 'pv-01' }])).toEqual([
      'r4',
    ])
    expect(
      adv('and', [{ id: '1', columnId: 'total', op: 'between', value: 50, value2: 150 }]),
    ).toEqual(['r2', 'r4'])
    expect(adv('and', [{ id: '1', columnId: 'status', op: 'neq', value: ['aprovado'] }])).toEqual([
      'r3',
      'r1',
    ])
    expect(
      adv('or', [
        { id: '1', columnId: 'total', op: 'gt', value: 200 },
        { id: '2', columnId: 'urgent', op: 'eq', value: true },
      ]),
    ).toEqual(['r3', 'r1', 'r4'])
    expect(
      adv('and', [
        { id: '1', columnId: 'total', op: 'gt', value: 50 },
        { id: '2', columnId: 'urgent', op: 'eq', value: true },
      ]),
    ).toEqual(['r4'])
    // condição incompleta é ignorada
    expect(adv('and', [{ id: '1', columnId: 'total', op: 'gt' }])).toHaveLength(4)
  })

  it('contagem por valor considera os demais filtros', () => {
    const counts = facetCounts(
      rows,
      cols,
      q({ filters: [{ id: 'urgent', kind: 'bool', value: true }] }),
      'status',
    )
    expect(Object.fromEntries(counts)).toEqual({ rascunho: 1, aprovado: 1 })
  })
})

describe('consulta completa', () => {
  it('ordena antes de paginar e soma os totais de todos os resultados', () => {
    const page = runQuery(
      rows,
      cols,
      q({ sort: [{ id: 'code', desc: true }], page: 2, pageSize: 2 }),
      id,
    )
    expect(ids(page.rows)).toEqual(['r2', 'r1'])
    expect(page.total).toBe(4)
    expect(page.totals.total).toBe(500)
  })
})

describe('estado na URL', () => {
  const types = {
    code: 'unique-text',
    status: 'status',
    total: 'currency',
    date: 'date',
    urgent: 'boolean',
    seller: 'enum',
  } as const

  it('ida e volta sem perda', () => {
    const query: TableQuery = {
      search: 'tech',
      sort: [
        { id: 'total', desc: true },
        { id: 'code', desc: false },
      ],
      filters: [
        { id: 'status', kind: 'in', values: ['aprovado', 'entregue'] },
        { id: 'total', kind: 'range', min: 100 },
        { id: 'date', kind: 'dateRange', from: '2026-01-01', to: '2026-01-31' },
        { id: 'code', kind: 'text', value: 'PV' },
        { id: 'urgent', kind: 'bool', value: false },
      ],
      advanced: {
        logic: 'or',
        conditions: [
          { id: 'c0', columnId: 'total', op: 'between', value: 1, value2: 9 },
          { id: 'c1', columnId: 'seller', op: 'empty' },
        ],
      },
      page: 3,
      pageSize: 50,
    }
    const search = queryToSearch(query)
    expect(search.s).toBe('-total,code')
    // Passa pelo validador da rota, como o router faz.
    const parsed = tableSearchSchema.parse(JSON.parse(JSON.stringify(search)))
    expect(searchToQuery(parsed, types)).toEqual(query)
  })

  it('consulta padrão não suja a URL; lixo é descartado', () => {
    expect(queryToSearch(EMPTY_QUERY)).toEqual({})
    const parsed = tableSearchSchema.parse({
      p: -1,
      ps: 7,
      s: '-nao_existe,total',
      f: { x: ['a'] },
    })
    expect(searchToQuery(parsed, types)).toEqual({
      ...EMPTY_QUERY,
      sort: [{ id: 'total', desc: false }],
    })
  })
})
