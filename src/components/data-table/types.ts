import type { ReactNode } from 'react'

/*
 * Tipos do DataTable. O TIPO da coluna define filtro, ordenação e alinhamento:
 *  - unique-text: código, serial, lote, ID, nome → filtro "contém"; ordena por texto
 *  - enum:        status de cadastro, categoria, setor, tipo, responsável → multisseleção com contagem
 *  - status:      status de negócio (statusMap) → multisseleção; ordena pela ORDEM DO FLUXO
 *  - number / currency: faixa "a partir de / até"; alinhado à direita; totais no rodapé
 *  - date:        período "de / até" (o "até" inclui o dia inteiro)
 *  - boolean:     três estados (todos, sim, não)
 */
export type ColumnType =
  'unique-text' | 'enum' | 'status' | 'number' | 'currency' | 'date' | 'boolean'

export interface ColumnOption {
  value: string
  label: string
}

export interface DataTableColumn<T> {
  id: string
  /** Rótulo já traduzido. */
  header: string
  type: ColumnType
  /** Valor bruto usado para filtrar, ordenar e exportar. Datas: ISO string ou Date. */
  accessor: (row: T) => unknown
  /** Renderização da célula (padrão: formato pelo tipo). */
  cell?: (row: T) => ReactNode
  /** Rótulos dos valores de `enum` (status usam o statusMap). */
  options?: ColumnOption[]
  sortable?: boolean
  filterable?: boolean
  /** Pode ser ocultada pelo usuário (padrão: sim). */
  hideable?: boolean
  /** Começa oculta. */
  hidden?: boolean
  /** Largura inicial em px. */
  size?: number
  minSize?: number
  /** Soma no rodapé (number/currency). */
  total?: boolean
  /** Papel no card do celular. Padrão: aparece como chave-valor. */
  mobile?: 'title' | 'badge' | 'hidden'
  /** Texto para exportar (padrão: valor formatado pelo tipo). */
  exportValue?: (row: T) => string | number | null
}

export interface SortItem {
  id: string
  desc: boolean
}

/** Filtro por coluna (no título da coluna). */
export type ColumnFilter =
  | { id: string; kind: 'text'; value: string }
  | { id: string; kind: 'in'; values: string[] }
  | { id: string; kind: 'range'; min?: number; max?: number }
  | { id: string; kind: 'dateRange'; from?: string; to?: string }
  | { id: string; kind: 'bool'; value: boolean }

export type Operator =
  'eq' | 'neq' | 'contains' | 'startsWith' | 'gt' | 'lt' | 'between' | 'empty' | 'notEmpty'

/** Condição do filtro avançado. Datas em `yyyy-mm-dd`. */
export interface Condition {
  id: string
  columnId: string
  op: Operator
  value?: string | number | boolean | string[]
  value2?: string | number
}

export interface AdvancedFilter {
  logic: 'and' | 'or'
  conditions: Condition[]
}

/** Estado completo da consulta — o mesmo no modo cliente e no modo servidor (e na URL). */
export interface TableQuery {
  search: string
  sort: SortItem[]
  filters: ColumnFilter[]
  advanced: AdvancedFilter
  page: number
  pageSize: number
}

export const DEFAULT_PAGE_SIZE = 20
export const PAGE_SIZES = [10, 20, 50, 100, 500]

export const EMPTY_QUERY: TableQuery = {
  search: '',
  sort: [],
  filters: [],
  advanced: { logic: 'and', conditions: [] },
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
}

/** Resultado de uma página (o servidor devolve o mesmo formato). */
export interface TablePage<T> {
  rows: T[]
  total: number
  /** Totais das colunas numéricas sobre TODOS os resultados filtrados. */
  totals: Record<string, number>
}

/** Preferências de colunas (visões salvas). */
export interface ColumnsState {
  visibility: Record<string, boolean>
  order: string[]
  sizing: Record<string, number>
  pinned: string[]
}

export const OPERATORS_BY_TYPE: Record<ColumnType, Operator[]> = {
  'unique-text': ['contains', 'eq', 'neq', 'startsWith', 'empty', 'notEmpty'],
  enum: ['eq', 'neq', 'empty', 'notEmpty'],
  status: ['eq', 'neq'],
  number: ['eq', 'neq', 'gt', 'lt', 'between', 'empty', 'notEmpty'],
  currency: ['eq', 'neq', 'gt', 'lt', 'between', 'empty', 'notEmpty'],
  date: ['eq', 'gt', 'lt', 'between', 'empty', 'notEmpty'],
  boolean: ['eq'],
}
