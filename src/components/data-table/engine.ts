import i18n from '@/i18n'
import { TIME_ZONE } from '@/lib/format'
import { STATUS_MAP, type StatusId } from '@/lib/status/statusMap'
import type {
  ColumnFilter,
  Condition,
  DataTableColumn,
  SortItem,
  TablePage,
  TableQuery,
} from './types'

/*
 * MOTOR DE CONSULTA do DataTable — funções puras, sem React.
 * Usado no modo cliente (no navegador) e pelo servidor simulado (MSW, fase 6),
 * para que filtro, ordenação e paginação tenham EXATAMENTE a mesma regra nos dois.
 *
 * Regras:
 *  - ordena pelo VALOR (número, data, status pela ordem do fluxo, texto no idioma);
 *  - vazios sempre no fim, nas duas direções;
 *  - desempate estável pelo ID;
 *  - filtra e ordena a lista inteira ANTES de paginar;
 *  - período de datas compara o DIA no fuso de São Paulo; o "até" inclui o dia inteiro.
 */

export type EngineColumn<T> = Pick<DataTableColumn<T>, 'id' | 'type' | 'accessor' | 'options'>

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Valor vazio: null, undefined, '' ou NaN. */
export function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))
}

/** Dia (yyyy-mm-dd) no fuso da empresa. Aceita Date, ISO ou "yyyy-mm-dd". */
export function dayKey(v: unknown): string | null {
  if (isEmpty(v)) return null
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const d = v instanceof Date ? v : new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : dayFormatter.format(d)
}

function toTime(v: unknown): number | null {
  if (isEmpty(v)) return null
  const d = v instanceof Date ? v : new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

function toNumber(v: unknown): number | null {
  if (isEmpty(v)) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isNaN(n) ? null : n
}

/** Texto exibido do valor (usado na busca geral e nos rótulos). */
export function displayText<T>(col: EngineColumn<T>, v: unknown): string {
  if (isEmpty(v)) return ''
  if (col.type === 'status') return i18n.t(`status.${v as StatusId}`)
  if (col.type === 'enum') return col.options?.find((o) => o.value === v)?.label ?? String(v)
  if (col.type === 'boolean') return v ? i18n.t('dataTable.yes') : i18n.t('dataTable.no')
  return String(v)
}

/* ------------------------------------------------------------ ordenação */

let collator = new Intl.Collator(i18n.language, { numeric: true, sensitivity: 'base' })
i18n.on('languageChanged', (lng) => {
  collator = new Intl.Collator(lng, { numeric: true, sensitivity: 'base' })
})

/** Compara dois valores NÃO vazios de uma coluna. */
export function compareValues<T>(col: EngineColumn<T>, a: unknown, b: unknown): number {
  switch (col.type) {
    case 'number':
    case 'currency':
      return (toNumber(a) ?? 0) - (toNumber(b) ?? 0)
    case 'date':
      return (toTime(a) ?? 0) - (toTime(b) ?? 0)
    case 'status':
      return (
        (STATUS_MAP[a as StatusId]?.flowOrder ?? 9999) -
        (STATUS_MAP[b as StatusId]?.flowOrder ?? 9999)
      )
    case 'boolean':
      return Number(Boolean(a)) - Number(Boolean(b))
    case 'enum':
      return collator.compare(displayText(col, a), displayText(col, b))
    default:
      return collator.compare(String(a), String(b))
  }
}

export function sortRows<T>(
  rows: T[],
  columns: EngineColumn<T>[],
  sort: SortItem[],
  getId: (row: T) => string,
): T[] {
  const active = sort
    .map((s) => ({ s, col: columns.find((c) => c.id === s.id) }))
    .filter((x): x is { s: SortItem; col: EngineColumn<T> } => Boolean(x.col))
  return [...rows].sort((ra, rb) => {
    for (const { s, col } of active) {
      const a = col.accessor(ra)
      const b = col.accessor(rb)
      const ea = isEmpty(a)
      const eb = isEmpty(b)
      if (ea && eb) continue
      // Vazios no fim nas duas direções (não inverte com `desc`).
      if (ea) return 1
      if (eb) return -1
      const c = compareValues(col, a, b)
      if (c !== 0) return s.desc ? -c : c
    }
    // Desempate estável pelo ID.
    return collator.compare(getId(ra), getId(rb))
  })
}

/* ------------------------------------------------------------ filtros */

function matchesColumnFilter<T>(col: EngineColumn<T>, f: ColumnFilter, v: unknown): boolean {
  switch (f.kind) {
    case 'text':
      return (
        !f.value ||
        (!isEmpty(v) && String(v).toLocaleLowerCase().includes(f.value.toLocaleLowerCase()))
      )
    case 'in':
      return f.values.length === 0 || (!isEmpty(v) && f.values.includes(String(v)))
    case 'range': {
      if (f.min === undefined && f.max === undefined) return true
      const n = toNumber(v)
      if (n === null) return false
      return (f.min === undefined || n >= f.min) && (f.max === undefined || n <= f.max)
    }
    case 'dateRange': {
      if (!f.from && !f.to) return true
      const d = dayKey(v)
      if (!d) return false
      // Comparação por DIA: o "até" inclui o dia inteiro.
      return (!f.from || d >= f.from) && (!f.to || d <= f.to)
    }
    case 'bool':
      return Boolean(v) === f.value
    default:
      return col.type !== undefined
  }
}

function matchesCondition<T>(col: EngineColumn<T>, c: Condition, v: unknown): boolean {
  if (c.op === 'empty') return isEmpty(v)
  if (c.op === 'notEmpty') return !isEmpty(v)
  if (isEmpty(v)) return c.op === 'neq'

  if (col.type === 'date') {
    const d = dayKey(v)!
    const a = String(c.value ?? '')
    const b = String(c.value2 ?? '')
    switch (c.op) {
      case 'eq':
        return d === a
      case 'neq':
        return d !== a
      case 'gt':
        return d > a
      case 'lt':
        return d < a
      case 'between':
        return d >= a && d <= b
      default:
        return true
    }
  }
  if (col.type === 'number' || col.type === 'currency') {
    const n = toNumber(v)!
    const a = Number(c.value)
    const b = Number(c.value2)
    switch (c.op) {
      case 'eq':
        return n === a
      case 'neq':
        return n !== a
      case 'gt':
        return n > a
      case 'lt':
        return n < a
      case 'between':
        return n >= a && n <= b
      default:
        return true
    }
  }
  if (col.type === 'boolean') return Boolean(v) === Boolean(c.value)
  if (col.type === 'enum' || col.type === 'status') {
    const values = Array.isArray(c.value) ? c.value : c.value === undefined ? [] : [String(c.value)]
    const hit = values.includes(String(v))
    return c.op === 'neq' ? !hit : hit
  }
  // texto
  const text = String(v).toLocaleLowerCase()
  const q = String(c.value ?? '').toLocaleLowerCase()
  switch (c.op) {
    case 'eq':
      return text === q
    case 'neq':
      return text !== q
    case 'startsWith':
      return text.startsWith(q)
    default:
      return text.includes(q)
  }
}

/** Condição completa o bastante para valer (as incompletas são ignoradas). */
export function isConditionReady(c: Condition): boolean {
  if (c.op === 'empty' || c.op === 'notEmpty') return true
  if (c.value === undefined || c.value === '' || (Array.isArray(c.value) && c.value.length === 0))
    return false
  if (c.op === 'between') return c.value2 !== undefined && c.value2 !== ''
  return true
}

export function filterRows<T>(rows: T[], columns: EngineColumn<T>[], query: TableQuery): T[] {
  const byId = new Map(columns.map((c) => [c.id, c]))
  const search = query.search.trim().toLocaleLowerCase()
  const filters = query.filters.filter((f) => byId.has(f.id))
  const conditions = query.advanced.conditions.filter(
    (c) => byId.has(c.columnId) && isConditionReady(c),
  )

  return rows.filter((row) => {
    if (search) {
      const hit = columns.some((col) =>
        displayText(col, col.accessor(row)).toLocaleLowerCase().includes(search),
      )
      if (!hit) return false
    }
    for (const f of filters) {
      const col = byId.get(f.id)!
      if (!matchesColumnFilter(col, f, col.accessor(row))) return false
    }
    if (conditions.length) {
      const results = conditions.map((c) => {
        const col = byId.get(c.columnId)!
        return matchesCondition(col, c, col.accessor(row))
      })
      const ok = query.advanced.logic === 'and' ? results.every(Boolean) : results.some(Boolean)
      if (!ok) return false
    }
    return true
  })
}

/** Soma das colunas numéricas sobre os resultados filtrados. */
export function computeTotals<T>(rows: T[], columns: (EngineColumn<T> & { total?: boolean })[]) {
  const totals: Record<string, number> = {}
  for (const col of columns) {
    if (!col.total) continue
    totals[col.id] = rows.reduce((acc, r) => acc + (toNumber(col.accessor(r)) ?? 0), 0)
  }
  return totals
}

/** Contagem por valor (filtro de multisseleção), considerando os DEMAIS filtros. */
export function facetCounts<T>(
  rows: T[],
  columns: EngineColumn<T>[],
  query: TableQuery,
  columnId: string,
): Map<string, number> {
  const others = { ...query, filters: query.filters.filter((f) => f.id !== columnId) }
  const col = columns.find((c) => c.id === columnId)
  const counts = new Map<string, number>()
  if (!col) return counts
  for (const row of filterRows(rows, columns, others)) {
    const v = col.accessor(row)
    if (isEmpty(v)) continue
    const k = String(v)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return counts
}

/** Filtra, ordena e pagina — a consulta completa. */
export function runQuery<T>(
  rows: T[],
  columns: (EngineColumn<T> & { total?: boolean })[],
  query: TableQuery,
  getId: (row: T) => string,
): TablePage<T> & { all: T[] } {
  const filtered = filterRows(rows, columns, query)
  const sorted = sortRows(filtered, columns, query.sort, getId)
  const start = (query.page - 1) * query.pageSize
  return {
    rows: sorted.slice(start, start + query.pageSize),
    total: sorted.length,
    totals: computeTotals(sorted, columns),
    all: sorted,
  }
}
