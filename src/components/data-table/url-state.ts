import { z } from 'zod'
import type { ColumnFilter, ColumnType, Condition, Operator, TableQuery } from './types'
import { DEFAULT_PAGE_SIZE, EMPTY_QUERY, PAGE_SIZES } from './types'

/*
 * Estado da tabela na URL (link compartilhável), em formato compacto:
 *   ?q=busca
 *   &s=-total,cliente            ← ordenação ("-" = decrescente; vírgula = várias colunas)
 *   &f={"status":["aprovado"],"total":[100,null],"emissao":["2026-01-01",""],"cliente":"tech","urgente":true}
 *   &a={"l":"or","c":[["total","gt",1000],["status","eq",["atrasado"]]]}
 *   &p=2&ps=50
 * O TanStack Router serializa objetos em JSON sozinho. Valores padrão não vão para a URL.
 */

const filterValue = z.union([
  z.string(),
  z.boolean(),
  z.array(z.string()),
  z.tuple([z.number().nullable(), z.number().nullable()]),
])

const conditionTuple = z.union([
  z.tuple([z.string(), z.string()]),
  z.tuple([z.string(), z.string(), z.unknown()]),
  z.tuple([z.string(), z.string(), z.unknown(), z.unknown()]),
])

/** Esquema para `validateSearch` da rota (aceita só o que é válido; o resto cai fora). */
export const tableSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  s: z.string().optional().catch(undefined),
  f: z.record(z.string(), filterValue).optional().catch(undefined),
  a: z
    .object({ l: z.enum(['and', 'or']), c: z.array(conditionTuple) })
    .optional()
    .catch(undefined),
  p: z.number().int().min(1).optional().catch(undefined),
  ps: z
    .number()
    .int()
    .refine((n) => PAGE_SIZES.includes(n))
    .optional()
    .catch(undefined),
})

export type TableSearch = z.infer<typeof tableSearchSchema>

type ColumnTypes = Record<string, ColumnType>

const OPS: Operator[] = [
  'eq',
  'neq',
  'contains',
  'startsWith',
  'gt',
  'lt',
  'between',
  'empty',
  'notEmpty',
]

/** Consulta → parâmetros de busca (só o que difere do padrão). */
export function queryToSearch(query: TableQuery): TableSearch {
  const out: TableSearch = {}
  if (query.search) out.q = query.search
  if (query.sort.length) out.s = query.sort.map((s) => (s.desc ? '-' : '') + s.id).join(',')
  if (query.filters.length) {
    const f: NonNullable<TableSearch['f']> = {}
    for (const flt of query.filters) {
      switch (flt.kind) {
        case 'text':
          if (flt.value) f[flt.id] = flt.value
          break
        case 'in':
          if (flt.values.length) f[flt.id] = flt.values
          break
        case 'range':
          if (flt.min !== undefined || flt.max !== undefined)
            f[flt.id] = [flt.min ?? null, flt.max ?? null]
          break
        case 'dateRange':
          if (flt.from || flt.to) f[flt.id] = [flt.from ?? '', flt.to ?? '']
          break
        case 'bool':
          f[flt.id] = flt.value
          break
      }
    }
    if (Object.keys(f).length) out.f = f
  }
  if (query.advanced.conditions.length) {
    out.a = {
      l: query.advanced.logic,
      c: query.advanced.conditions.map((c) => {
        const t: unknown[] = [c.columnId, c.op]
        if (c.value !== undefined || c.value2 !== undefined) t.push(c.value ?? null)
        if (c.value2 !== undefined) t.push(c.value2)
        return t as [string, string]
      }),
    }
  }
  if (query.page > 1) out.p = query.page
  if (query.pageSize !== DEFAULT_PAGE_SIZE) out.ps = query.pageSize
  return out
}

/** Parâmetros de busca → consulta. Colunas desconhecidas são ignoradas. */
export function searchToQuery(search: TableSearch, types: ColumnTypes): TableQuery {
  const sort = (search.s ?? '')
    .split(',')
    .filter(Boolean)
    .map((part) => ({ id: part.replace(/^-/, ''), desc: part.startsWith('-') }))
    .filter((s) => s.id in types)

  const filters: ColumnFilter[] = []
  for (const [id, raw] of Object.entries(search.f ?? {})) {
    const type = types[id]
    if (!type) continue
    if (type === 'boolean' && typeof raw === 'boolean')
      filters.push({ id, kind: 'bool', value: raw })
    else if ((type === 'enum' || type === 'status') && Array.isArray(raw))
      filters.push({ id, kind: 'in', values: raw.map(String) })
    else if ((type === 'number' || type === 'currency') && Array.isArray(raw) && raw.length === 2) {
      const [min, max] = raw as (number | null)[]
      filters.push({ id, kind: 'range', min: min ?? undefined, max: max ?? undefined })
    } else if (type === 'date' && Array.isArray(raw) && raw.length === 2) {
      const [from, to] = raw as string[]
      filters.push({ id, kind: 'dateRange', from: from || undefined, to: to || undefined })
    } else if (type === 'unique-text' && typeof raw === 'string')
      filters.push({ id, kind: 'text', value: raw })
  }

  const conditions: Condition[] = (search.a?.c ?? [])
    .filter(([col, op]) => col in types && OPS.includes(op as Operator))
    .map(([columnId, op, value, value2], i) => ({
      id: `c${i}`,
      columnId,
      op: op as Operator,
      value: (value ?? undefined) as Condition['value'],
      value2: (value2 ?? undefined) as Condition['value2'],
    }))

  return {
    search: search.q ?? '',
    sort,
    filters,
    advanced: { logic: search.a?.l ?? 'and', conditions },
    page: search.p ?? 1,
    pageSize: search.ps ?? EMPTY_QUERY.pageSize,
  }
}
