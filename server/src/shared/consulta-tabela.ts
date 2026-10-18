import { sql, type RawBuilder, type SqlBool } from 'kysely'
import { z } from 'zod'
import { diaSeguinte, ehDia, inicioDoDia } from './datas.js'
import { escaparLike, normalizar } from './texto.js'

/*
 * CONSULTA DE TABELA (lado servidor do DataTable do frontend).
 *
 * O frontend manda o estado da tabela no formato compacto da URL
 * (src/components/data-table/url-state.ts):
 *   q=busca  s=-coluna,outra  f={...}  a={"l":"and","c":[[col,op,valor,valor2]]}  p=1  ps=20
 * Aqui ele vira SQL (WHERE / ORDER BY / LIMIT) com a MESMA semântica do motor do frontend
 * (src/components/data-table/engine.ts):
 *  - texto: "contém", sem diferenciar maiúsculas;
 *  - datas: por DIA no fuso da empresa ("até" inclui o dia inteiro);
 *  - vazios sempre no fim da ordenação; desempate pelo id;
 *  - status ordena pela ordem do fluxo (mapa `ordem` da coluna).
 * Diferença: a busca geral (q) usa a coluna `busca` (texto normalizado) da tabela.
 */

export type TipoColuna =
  'unique-text' | 'enum' | 'status' | 'number' | 'currency' | 'date' | 'boolean'

export interface ColunaConsulta {
  /** Id da coluna na tela = nome do campo (camelCase; o plugin converte para o banco). */
  id: string
  tipo: TipoColuna
  /** status: ordem do fluxo (código → posição). Sem mapa, ordena pelo código. */
  ordem?: Record<string, number>
}

export type Filtro =
  | { id: string; kind: 'text'; value: string }
  | { id: string; kind: 'in'; values: string[] }
  | { id: string; kind: 'range'; min?: number; max?: number }
  | { id: string; kind: 'dateRange'; from?: string; to?: string }
  | { id: string; kind: 'bool'; value: boolean }

export type Operador =
  'eq' | 'neq' | 'contains' | 'startsWith' | 'gt' | 'lt' | 'between' | 'empty' | 'notEmpty'

export interface Condicao {
  columnId: string
  op: Operador
  value?: unknown
  value2?: unknown
}

export interface ConsultaTabela {
  search: string
  sort: { id: string; desc: boolean }[]
  filters: Filtro[]
  advanced: { logic: 'and' | 'or'; conditions: Condicao[] }
  page: number
  pageSize: number
}

export const TAMANHO_PADRAO = 20
/** Exportação pede todos os resultados de uma vez. */
export const TAMANHO_MAXIMO = 100_000

const OPERADORES: Operador[] = [
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

/* ------------------------------------------------------------ leitura dos parâmetros */

const json = <T extends z.ZodType>(schema: T) =>
  z
    .string()
    .transform((s, ctx) => {
      try {
        return JSON.parse(s) as unknown
      } catch {
        ctx.addIssue({ code: 'custom', message: 'JSON inválido.' })
        return z.NEVER
      }
    })
    .pipe(schema)

const parametros = z.object({
  q: z.string().optional().catch(undefined),
  s: z.string().optional().catch(undefined),
  f: json(
    z.record(
      z.string(),
      z.union([
        z.string(),
        z.boolean(),
        z.array(z.string()),
        z.tuple([z.number().nullable(), z.number().nullable()]),
      ]),
    ),
  )
    .optional()
    .catch(undefined),
  a: json(z.object({ l: z.enum(['and', 'or']), c: z.array(z.array(z.unknown()).min(2).max(4)) }))
    .optional()
    .catch(undefined),
  p: z.coerce.number().int().min(1).optional().catch(undefined),
  ps: z.coerce.number().int().min(1).max(TAMANHO_MAXIMO).optional().catch(undefined),
})

/** Query string → consulta. Colunas e valores desconhecidos são ignorados (como no frontend). */
export function lerConsulta(query: unknown, colunas: ColunaConsulta[]): ConsultaTabela {
  const p = parametros.parse(query ?? {})
  const tipos = new Map(colunas.map((c) => [c.id, c.tipo]))

  const sort = (p.s ?? '')
    .split(',')
    .filter(Boolean)
    .map((parte) => ({ id: parte.replace(/^-/, ''), desc: parte.startsWith('-') }))
    .filter((s) => tipos.has(s.id))

  const filters: Filtro[] = []
  for (const [id, bruto] of Object.entries(p.f ?? {})) {
    const tipo = tipos.get(id)
    if (!tipo) continue
    if (tipo === 'boolean' && typeof bruto === 'boolean')
      filters.push({ id, kind: 'bool', value: bruto })
    else if ((tipo === 'enum' || tipo === 'status') && Array.isArray(bruto))
      filters.push({ id, kind: 'in', values: bruto.map(String) })
    else if (
      (tipo === 'number' || tipo === 'currency') &&
      Array.isArray(bruto) &&
      bruto.length === 2
    ) {
      const [min, max] = bruto as (number | null)[]
      filters.push({ id, kind: 'range', min: min ?? undefined, max: max ?? undefined })
    } else if (tipo === 'date' && Array.isArray(bruto) && bruto.length === 2) {
      const [from, to] = bruto as string[]
      filters.push({
        id,
        kind: 'dateRange',
        from: ehDia(from) ? from : undefined,
        to: ehDia(to) ? to : undefined,
      })
    } else if (tipo === 'unique-text' && typeof bruto === 'string')
      filters.push({ id, kind: 'text', value: bruto })
  }

  const conditions: Condicao[] = (p.a?.c ?? [])
    .filter(([col, op]) => tipos.has(String(col)) && OPERADORES.includes(op as Operador))
    .map(([columnId, op, value, value2]) => ({
      columnId: String(columnId),
      op: op as Operador,
      value: value ?? undefined,
      value2: value2 ?? undefined,
    }))
    .filter(condicaoPronta)

  return {
    search: (p.q ?? '').trim(),
    sort,
    filters,
    advanced: { logic: p.a?.l ?? 'and', conditions },
    page: p.p ?? 1,
    pageSize: p.ps ?? TAMANHO_PADRAO,
  }
}

/** Condição completa o bastante para valer (as incompletas são ignoradas). */
function condicaoPronta(c: Condicao): boolean {
  if (c.op === 'empty' || c.op === 'notEmpty') return true
  if (c.value === undefined || c.value === '' || (Array.isArray(c.value) && !c.value.length))
    return false
  if (c.op === 'between') return c.value2 !== undefined && c.value2 !== ''
  return true
}

/* ------------------------------------------------------------ SQL */

type Cond = RawBuilder<SqlBool>

const VERDADE: Cond = sql<SqlBool>`1 = 1`
const FALSO: Cond = sql<SqlBool>`1 = 0`
const e = (partes: Cond[]): Cond =>
  partes.length ? sql<SqlBool>`(${sql.join(partes, sql` and `)})` : VERDADE
const ou = (partes: Cond[]): Cond =>
  partes.length ? sql<SqlBool>`(${sql.join(partes, sql` or `)})` : FALSO

const ehTexto = (t: TipoColuna) => t === 'unique-text' || t === 'enum' || t === 'status'

function vazio(c: ColunaConsulta): Cond {
  const ref = sql.ref(c.id)
  return ehTexto(c.tipo)
    ? sql<SqlBool>`(${ref} is null or ${ref} = '')`
    : sql<SqlBool>`${ref} is null`
}

const contem = (c: ColunaConsulta, valor: string, inicio = false): Cond =>
  sql<SqlBool>`lower(${sql.ref(c.id)}) like ${`${inicio ? '' : '%'}${escaparLike(valor.toLowerCase())}%`} escape '\\'`

/** Instantes [início, fim) que cobrem os dias de `de` até `ate` no fuso da empresa. */
function entreDias(c: ColunaConsulta, de?: string, ate?: string): Cond {
  const ref = sql.ref(c.id)
  const partes: Cond[] = []
  if (de) partes.push(sql<SqlBool>`${ref} >= ${inicioDoDia(de)}`)
  if (ate) partes.push(sql<SqlBool>`${ref} < ${inicioDoDia(diaSeguinte(ate))}`)
  return e(partes)
}

function filtroSql(c: ColunaConsulta, f: Filtro): Cond {
  const ref = sql.ref(c.id)
  switch (f.kind) {
    case 'text':
      return f.value ? contem(c, f.value) : VERDADE
    case 'in':
      return f.values.length ? sql<SqlBool>`${ref} in (${sql.join(f.values)})` : VERDADE
    case 'range': {
      const partes: Cond[] = []
      if (f.min !== undefined) partes.push(sql<SqlBool>`${ref} >= ${f.min}`)
      if (f.max !== undefined) partes.push(sql<SqlBool>`${ref} <= ${f.max}`)
      return e(partes)
    }
    case 'dateRange':
      return f.from || f.to ? entreDias(c, f.from, f.to) : VERDADE
    case 'bool':
      // Sim/não guardado como 0/1 (portável).
      return sql<SqlBool>`${ref} = ${f.value ? 1 : 0}`
  }
}

function condicaoSql(c: ColunaConsulta, cond: Condicao): Cond {
  const ref = sql.ref(c.id)
  if (cond.op === 'empty') return vazio(c)
  if (cond.op === 'notEmpty') return sql<SqlBool>`not ${vazio(c)}`
  // Vazio só passa em "diferente de" (igual ao frontend).
  const comVazio = (x: Cond) =>
    cond.op === 'neq' ? ou([vazio(c), x]) : e([sql<SqlBool>`not ${vazio(c)}`, x])

  if (c.tipo === 'date') {
    const a = String(cond.value ?? '')
    const b = String(cond.value2 ?? '')
    if (!ehDia(a) || (cond.op === 'between' && !ehDia(b))) return VERDADE
    switch (cond.op) {
      case 'eq':
        return comVazio(entreDias(c, a, a))
      case 'neq':
        return comVazio(sql<SqlBool>`not ${entreDias(c, a, a)}`)
      case 'gt':
        return comVazio(sql<SqlBool>`${ref} >= ${inicioDoDia(diaSeguinte(a))}`)
      case 'lt':
        return comVazio(sql<SqlBool>`${ref} < ${inicioDoDia(a)}`)
      case 'between':
        return comVazio(entreDias(c, a, b))
      default:
        return VERDADE
    }
  }
  if (c.tipo === 'number' || c.tipo === 'currency') {
    const a = Number(cond.value)
    const b = Number(cond.value2)
    switch (cond.op) {
      case 'eq':
        return comVazio(sql<SqlBool>`${ref} = ${a}`)
      case 'neq':
        return comVazio(sql<SqlBool>`${ref} <> ${a}`)
      case 'gt':
        return comVazio(sql<SqlBool>`${ref} > ${a}`)
      case 'lt':
        return comVazio(sql<SqlBool>`${ref} < ${a}`)
      case 'between':
        return comVazio(sql<SqlBool>`${ref} between ${a} and ${b}`)
      default:
        return VERDADE
    }
  }
  if (c.tipo === 'boolean') return sql<SqlBool>`${ref} = ${cond.value ? 1 : 0}`
  if (c.tipo === 'enum' || c.tipo === 'status') {
    const valores = (Array.isArray(cond.value) ? cond.value : [cond.value]).map(String)
    const dentro = sql<SqlBool>`${ref} in (${sql.join(valores)})`
    return comVazio(cond.op === 'neq' ? sql<SqlBool>`not ${dentro}` : dentro)
  }
  // texto
  const q = String(cond.value ?? '').toLowerCase()
  switch (cond.op) {
    case 'eq':
      return comVazio(sql<SqlBool>`lower(${ref}) = ${q}`)
    case 'neq':
      return comVazio(sql<SqlBool>`lower(${ref}) <> ${q}`)
    case 'startsWith':
      return comVazio(contem(c, q, true))
    default:
      return comVazio(contem(c, q))
  }
}

/**
 * WHERE da consulta (busca + filtros + filtro avançado).
 * `semFiltro`: ignora o filtro dessa coluna (contagem das opções do próprio filtro).
 */
export function whereDaConsulta(
  colunas: ColunaConsulta[],
  consulta: ConsultaTabela,
  opcoes: { colunaBusca?: string; semFiltro?: string } = {},
): Cond {
  const porId = new Map(colunas.map((c) => [c.id, c]))
  const partes: Cond[] = []
  if (consulta.search && opcoes.colunaBusca)
    partes.push(
      sql<SqlBool>`${sql.ref(opcoes.colunaBusca)} like ${`%${escaparLike(normalizar(consulta.search))}%`} escape '\\'`,
    )
  for (const f of consulta.filters) {
    const c = porId.get(f.id)
    if (c && f.id !== opcoes.semFiltro) partes.push(filtroSql(c, f))
  }
  const conds = consulta.advanced.conditions.flatMap((cond) => {
    const c = porId.get(cond.columnId)
    return c ? [condicaoSql(c, cond)] : []
  })
  if (conds.length) partes.push(consulta.advanced.logic === 'and' ? e(conds) : ou(conds))
  return e(partes)
}

/** ORDER BY: vazios no fim (nas duas direções), status pela ordem do fluxo, desempate por `id`. */
export function ordemDaConsulta(
  colunas: ColunaConsulta[],
  consulta: ConsultaTabela,
  padrao: { id: string; desc: boolean }[],
): RawBuilder<unknown>[] {
  const porId = new Map(colunas.map((c) => [c.id, c]))
  const itens = (consulta.sort.length ? consulta.sort : padrao).filter((s) => porId.has(s.id))
  const out: RawBuilder<unknown>[] = []
  for (const s of itens) {
    const c = porId.get(s.id)!
    const ref = sql.ref(c.id)
    const dir = sql.raw(s.desc ? 'desc' : 'asc')
    out.push(sql`case when ${vazio(c)} then 1 else 0 end asc`)
    if (c.tipo === 'status' && c.ordem) {
      const casos = Object.entries(c.ordem).map(([k, v]) => sql`when ${k} then ${v}`)
      out.push(sql`case ${ref} ${sql.join(casos, sql` `)} else 9999 end ${dir}`)
    } else if (ehTexto(c.tipo)) out.push(sql`lower(${ref}) ${dir}`)
    else out.push(sql`${ref} ${dir}`)
  }
  out.push(sql`${sql.ref('id')} asc`)
  return out
}
