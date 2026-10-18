import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowExpandingFeature,
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ExpandedState,
  type RowData,
  type RowSelectionState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  CircleAlert,
  MoreHorizontal,
  Plus,
  Rows3,
  Rows4,
  SearchX,
  SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DateRangePicker } from '@/components/ui/date-picker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchInput } from '@/components/ui/input-variants'
import { Pagination } from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDebounced } from '@/hooks/use-debounced'
import { useHotkey } from '@/hooks/use-hotkey'
import { useMediaQuery } from '@/hooks/use-media-query'
import { formatCurrency, formatNumber } from '@/lib/format'
import { useUiStore } from '@/stores/ui-store'
import { facetCounts, runQuery } from './engine'
import { exportRows, type ExportFormat } from './export'
import { AdvancedFilterSheet, ColumnFilterPopover, FilterEditor } from './filters'
import { parseDay, toDay } from './filter-utils'
import { formatValue, isNumeric, renderCell } from './format'
import { ColumnsMenu, ExportMenu, FilterChips, ViewsMenu } from './toolbar-parts'
import { useViewsStore, type SavedView } from './views-store'
import {
  PAGE_SIZES,
  type ColumnFilter,
  type ColumnsState,
  type DataTableColumn,
  type SortItem,
  type TablePage,
  type TableQuery,
} from './types'

/*
 * DataTable — componente ÚNICO de todas as listas do sistema.
 *
 * Modo cliente: passe `data` (a tabela filtra, ordena e pagina com o motor `engine.ts`).
 * Modo servidor: passe `page` (resultado da API para a `query` atual) — mesma interface;
 * o servidor usa o mesmo motor (MSW na fase 6) ou a API real.
 * A `query` é controlada por quem usa (normalmente a URL: `useUrlTableQuery`).
 */

const features = tableFeatures({
  columnVisibilityFeature,
  columnOrderingFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnPinningFeature,
  rowSelectionFeature,
  rowExpandingFeature,
})
type Features = typeof features

const SELECT = '__select'
const EXPAND = '__expand'
const ACTIONS = '__actions'
const VIRTUAL_THRESHOLD = 100

export interface TableSelection<T> {
  count: number
  /** IDs selecionados (em modo servidor com "todos os resultados", vem vazio: use `query`). */
  ids: string[]
  rows: T[]
  allMatching: boolean
  query: TableQuery
  clear: () => void
}

export interface DataTableProps<T> {
  /** Identificador estável (visões salvas e layout de colunas). */
  id: string
  /** Nome acessível da tabela e título da exportação. */
  title: string
  columns: DataTableColumn<T>[]
  getRowId: (row: T) => string
  query: TableQuery
  onQueryChange: (query: TableQuery) => void
  /** Modo cliente: todos os registros. */
  data?: T[]
  /** Modo servidor: a página atual (+ contagens por valor, se o servidor souber). */
  page?: TablePage<T> & { facets?: Record<string, Record<string, number>> }
  /** Modo servidor: busca todos os resultados filtrados (para exportar). */
  fetchAll?: () => Promise<T[]>
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  onRowClick?: (row: T) => void
  /** Itens do menu ⋯ de cada linha (`DropdownMenuItem`). */
  rowActions?: (row: T) => React.ReactNode
  /** Ações em massa para a seleção (botões). Sem isto, não há seleção. */
  bulkActions?: (selection: TableSelection<T>) => React.ReactNode
  /** Conteúdo da linha expandida. */
  renderExpanded?: (row: T) => React.ReactNode
  /** Botão "Novo" (e atalho N). Envolva com <Can> fora, se depender de perfil. */
  onCreate?: () => void
  createLabel?: string
  /** Botões extras na barra. */
  toolbar?: React.ReactNode
  /** Estado vazio (sem nenhum registro). */
  empty?: { title: string; description?: string; action?: React.ReactNode }
  /** Prefixo do arquivo exportado. */
  exportName?: string
}

function defaultLayout<T>(columns: DataTableColumn<T>[]): ColumnsState {
  return {
    order: columns.map((c) => c.id),
    visibility: Object.fromEntries(columns.filter((c) => c.hidden).map((c) => [c.id, false])),
    sizing: {},
    pinned: columns[0] ? [columns[0].id] : [],
  }
}

/** Mesma consulta (ignorando a página)? Compara campo a campo, em ordem fixa. */
const sameQuery = (a: Omit<TableQuery, 'page'>, b: TableQuery) => {
  const norm = (q: Omit<TableQuery, 'page'>) =>
    JSON.stringify([
      q.search,
      q.sort,
      q.filters,
      q.advanced.logic,
      q.advanced.conditions.map((c) => [c.columnId, c.op, c.value, c.value2]),
      q.pageSize,
    ])
  return norm(a) === norm(b)
}

export function DataTable<T extends RowData>(props: DataTableProps<T>) {
  const {
    id,
    title,
    columns,
    getRowId,
    query,
    onQueryChange,
    data,
    page: serverPage,
    fetchAll,
    loading,
    error,
    onRetry,
    onRowClick,
    rowActions,
    bulkActions,
    renderExpanded,
    onCreate,
    createLabel,
    toolbar,
    empty,
    exportName,
  } = props
  const { t } = useTranslation()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const clientMode = data !== undefined
  const density = useUiStore((s) => s.density)
  const setDensity = useUiStore((s) => s.setDensity)

  /* ---------------- consulta e resultado */
  const setQuery = React.useCallback(
    (patch: Partial<TableQuery>, keepPage = false) =>
      onQueryChange({
        ...query,
        ...patch,
        page: keepPage ? (patch.page ?? query.page) : (patch.page ?? 1),
      }),
    [query, onQueryChange],
  )
  const client = React.useMemo(
    () => (clientMode ? runQuery(data, columns, query, getRowId) : undefined),
    [clientMode, data, columns, query, getRowId],
  )
  const result: TablePage<T> = client ?? serverPage ?? { rows: [], total: 0, totals: {} }
  const pageCount = Math.max(1, Math.ceil(result.total / query.pageSize))

  // Página além do fim (ex.: filtro reduziu os resultados) → volta para a última.
  React.useEffect(() => {
    if (!loading && result.total > 0 && query.page > pageCount)
      onQueryChange({ ...query, page: pageCount })
  }, [loading, result.total, query, pageCount, onQueryChange])

  const getCounts = (columnId: string) => {
    if (client) return facetCounts(data!, columns, query, columnId)
    const f = serverPage?.facets?.[columnId]
    return f ? new Map(Object.entries(f)) : undefined
  }
  const hasFilters = Boolean(
    query.search || query.filters.length || query.advanced.conditions.length,
  )

  /* ---------------- layout de colunas (salvo por tabela) */
  const savedLayout = useViewsStore((s) => s.layouts[id])
  const saveLayout = useViewsStore((s) => s.saveLayout)
  const [layout, setLayout] = React.useState<ColumnsState>(() => {
    const base = defaultLayout(columns)
    if (!savedLayout) return base
    // Colunas novas (que não existiam no layout salvo) entram no fim.
    const known = new Set(savedLayout.order)
    return {
      ...savedLayout,
      order: [
        ...savedLayout.order.filter((c) => base.order.includes(c)),
        ...base.order.filter((c) => !known.has(c)),
      ],
    }
  })
  React.useEffect(() => saveLayout(id, layout), [id, layout, saveLayout])

  /* ---------------- seleção e expansão */
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [allMatching, setAllMatching] = React.useState(false)
  const [expanded, setExpanded] = React.useState<ExpandedState>({})
  const filterKey = JSON.stringify([query.search, query.filters, query.advanced])
  const [prevFilterKey, setPrevFilterKey] = React.useState(filterKey)
  if (filterKey !== prevFilterKey) {
    // Mudou o filtro: a seleção antiga não vale mais.
    setPrevFilterKey(filterKey)
    setRowSelection({})
    setAllMatching(false)
  }
  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k])
  const selectedCount = allMatching ? result.total : selectedIds.length
  const clearSelection = () => {
    setRowSelection({})
    setAllMatching(false)
  }
  const selection: TableSelection<T> = {
    count: selectedCount,
    ids: allMatching ? (client ? client.all.map(getRowId) : []) : selectedIds,
    rows: allMatching
      ? (client?.all ?? result.rows)
      : client
        ? data!.filter((r) => rowSelection[getRowId(r)])
        : result.rows.filter((r) => rowSelection[getRowId(r)]),
    allMatching,
    query,
    clear: clearSelection,
  }

  /* ---------------- TanStack Table (colunas, seleção, expansão) */
  const byId = React.useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns])
  const defs = React.useMemo<ColumnDef<Features, T>[]>(() => {
    const list: ColumnDef<Features, T>[] = []
    if (bulkActions) list.push({ id: SELECT, size: 44, enableResizing: false, enableHiding: false })
    if (renderExpanded)
      list.push({ id: EXPAND, size: 44, enableResizing: false, enableHiding: false })
    for (const c of columns)
      list.push({
        id: c.id,
        accessorFn: (row: T) => c.accessor(row) as never,
        size: c.size ?? (isNumeric(c.type) ? 140 : c.type === 'status' ? 170 : 180),
        minSize: c.minSize ?? 80,
        enableHiding: c.hideable !== false,
      })
    if (rowActions) list.push({ id: ACTIONS, size: 52, enableResizing: false, enableHiding: false })
    return list
  }, [columns, bulkActions, renderExpanded, rowActions])

  const table = useTable({
    features,
    columns: defs,
    data: result.rows,
    getRowId,
    columnResizeMode: 'onChange',
    enableRowSelection: Boolean(bulkActions),
    getRowCanExpand: () => Boolean(renderExpanded),
    state: {
      columnVisibility: layout.visibility,
      columnOrder: [SELECT, EXPAND, ...layout.order, ACTIONS],
      columnSizing: layout.sizing,
      columnPinning: {
        start: [SELECT, EXPAND, ...layout.pinned].filter((c) =>
          c === SELECT
            ? bulkActions
            : c === EXPAND
              ? renderExpanded
              : layout.visibility[c] !== false,
        ),
        end: rowActions ? [ACTIONS] : [],
      },
      rowSelection,
      expanded,
    },
    onColumnVisibilityChange: (u) =>
      setLayout((l) => ({ ...l, visibility: typeof u === 'function' ? u(l.visibility) : u })),
    onColumnSizingChange: (u) =>
      setLayout((l) => ({ ...l, sizing: typeof u === 'function' ? u(l.sizing) : u })),
    onRowSelectionChange: (u) => {
      setAllMatching(false)
      setRowSelection((s) => (typeof u === 'function' ? u(s) : u))
    },
    onExpandedChange: (u) => setExpanded((s) => (typeof u === 'function' ? u(s) : u)),
  })

  /* ---------------- ordenação */
  const toggleSort = (colId: string, multi: boolean) => {
    const current = query.sort.find((s) => s.id === colId)
    // Ciclo: crescente → decrescente → sem ordenação.
    const next: SortItem | undefined = !current
      ? { id: colId, desc: false }
      : !current.desc
        ? { id: colId, desc: true }
        : undefined
    let sort: SortItem[]
    if (multi)
      sort = next
        ? current
          ? query.sort.map((s) => (s.id === colId ? next : s))
          : [...query.sort, next]
        : query.sort.filter((s) => s.id !== colId)
    else sort = next ? [next] : []
    setQuery({ sort })
  }

  const setColumnFilter = (colId: string, filter: ColumnFilter | undefined) =>
    setQuery({
      filters: [...query.filters.filter((f) => f.id !== colId), ...(filter ? [filter] : [])],
    })

  /* ---------------- visões salvas */
  const views = useViewsStore((s) => s.views[id]) ?? []
  const defaultViewId = useViewsStore((s) => s.defaults[id])
  const { saveView, deleteView, setDefault } = useViewsStore()
  const activeView = views.find((v) => sameQuery(v.query, query))
  const applyView = (v: SavedView) => {
    setLayout(v.columns)
    onQueryChange({ ...v.query, page: 1 })
  }
  // Visão padrão do usuário: aplicada ao abrir a tela sem filtros na URL.
  const appliedDefault = React.useRef(false)
  React.useEffect(() => {
    if (appliedDefault.current) return
    appliedDefault.current = true
    const v = views.find((x) => x.id === defaultViewId)
    if (v && !hasFilters && !query.sort.length) applyView(v)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------------- busca geral (com atraso de digitação) */
  const [search, setSearch] = React.useState(query.search)
  const [prevSearch, setPrevSearch] = React.useState(query.search)
  if (query.search !== prevSearch) {
    setPrevSearch(query.search)
    setSearch(query.search)
  }
  const debouncedSearch = useDebounced(search, 300)
  React.useEffect(() => {
    if (debouncedSearch !== query.search) setQuery({ search: debouncedSearch })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  /* ---------------- período (escolher qual data) */
  const dateColumns = columns.filter((c) => c.type === 'date' && c.filterable !== false)
  const [dateColumn, setDateColumn] = React.useState(dateColumns[0]?.id)
  const dateFilter = query.filters.find((f) => f.id === dateColumn && f.kind === 'dateRange')

  /* ---------------- exportar */
  const visibleColumns = layout.order
    .map((c) => byId.get(c)!)
    .filter((c) => c && layout.visibility[c.id] !== false)
  const onExport = async (format: ExportFormat) => {
    const rows = client ? client.all : fetchAll ? await fetchAll() : result.rows
    await exportRows(format, visibleColumns, rows, exportName ?? id, title)
  }

  /* ---------------- outros */
  const [advancedOpen, setAdvancedOpen] = React.useState(false)
  const [mobileFilters, setMobileFilters] = React.useState(false)
  useHotkey({ key: 'n' }, () => onCreate?.(), Boolean(onCreate))

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const rows = table.getRowModel().rows
  // Listas grandes: renderiza só as linhas visíveis (enquanto nenhuma linha está expandida).
  const anyExpanded = expanded === true || Object.values(expanded).some(Boolean)
  const virtual = rows.length > VIRTUAL_THRESHOLD && !anyExpanded
  const virtualizer = useVirtualizer({
    count: virtual ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (density === 'compact' ? 36 : 44),
    overscan: 12,
  })

  const hasTotals = columns.some((c) => c.total) && result.total > 0
  const advancedCount = query.advanced.conditions.length
  const headers = table.getHeaderGroups()[0]?.headers ?? []
  const lastPinned = [...headers].reverse().find((h) => h.column.getIsPinned() === 'start')
    ?.column.id

  /* ================================================================ render */

  const toolbarRow = (
    <div className="flex flex-wrap items-center gap-2 border-b p-3">
      <SearchInput
        value={search}
        onValueChange={setSearch}
        placeholder={t('dataTable.searchPlaceholder')}
        aria-label={t('dataTable.searchLabel', { title })}
        className="h-control-sm w-full sm:w-64"
      />
      {isDesktop && dateColumns.length > 0 && (
        <div className="flex items-center gap-1">
          {dateColumns.length > 1 && (
            <Select value={dateColumn} onValueChange={setDateColumn}>
              <SelectTrigger className="h-control-sm w-auto" aria-label={t('dataTable.whichDate')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateColumns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DateRangePicker
            className="w-60 [&_button]:h-control-sm"
            aria-label={t('dataTable.period')}
            placeholder={
              dateColumns.length === 1
                ? `${dateColumns[0]!.header}: ${t('dataTable.anyPeriod')}`
                : t('dataTable.anyPeriod')
            }
            value={
              dateFilter?.kind === 'dateRange' && (dateFilter.from || dateFilter.to)
                ? { from: parseDay(dateFilter.from), to: parseDay(dateFilter.to) }
                : undefined
            }
            onValueChange={(r) =>
              dateColumn &&
              setColumnFilter(
                dateColumn,
                r?.from || r?.to
                  ? { id: dateColumn, kind: 'dateRange', from: toDay(r.from), to: toDay(r.to) }
                  : undefined,
              )
            }
          />
        </div>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => (isDesktop ? setAdvancedOpen(true) : setMobileFilters(true))}
        aria-haspopup="dialog"
      >
        <SlidersHorizontal aria-hidden />
        {t('dataTable.filters')}
        {advancedCount + (isDesktop ? 0 : query.filters.length) > 0 && (
          <Badge variant="solid">{advancedCount + (isDesktop ? 0 : query.filters.length)}</Badge>
        )}
      </Button>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {toolbar}
        {isDesktop && (
          <>
            <ViewsMenu
              views={views}
              defaultId={defaultViewId}
              activeId={activeView?.id}
              onApply={applyView}
              onSave={(name, asDefault) => {
                const vid =
                  activeView?.name === name ? activeView.id : `v${Date.now().toString(36)}`
                const { page: _page, ...q } = query
                void _page
                saveView(id, { id: vid, name, query: q, columns: layout })
                if (asDefault) setDefault(id, vid)
              }}
              onDelete={(vid) => deleteView(id, vid)}
              onSetDefault={(vid) => setDefault(id, vid)}
              onReset={() => {
                setLayout(defaultLayout(columns))
                onQueryChange({
                  ...query,
                  search: '',
                  sort: [],
                  filters: [],
                  advanced: { logic: 'and', conditions: [] },
                  page: 1,
                })
              }}
            />
            <ColumnsMenu
              columns={columns}
              order={layout.order}
              visibility={layout.visibility}
              pinned={layout.pinned}
              onOrderChange={(order) => setLayout((l) => ({ ...l, order }))}
              onVisibilityChange={(cid, v) =>
                setLayout((l) => ({ ...l, visibility: { ...l.visibility, [cid]: v } }))
              }
              onPinChange={(cid, p) =>
                setLayout((l) => ({
                  ...l,
                  pinned: p
                    ? [...l.pinned.filter((x) => x !== cid), cid]
                    : l.pinned.filter((x) => x !== cid),
                }))
              }
              onReset={() => setLayout(defaultLayout(columns))}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon-sm"
                  aria-label={t('dataTable.compact')}
                  aria-pressed={density === 'compact'}
                  onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
                >
                  {density === 'compact' ? <Rows4 aria-hidden /> : <Rows3 aria-hidden />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('dataTable.compact')}</TooltipContent>
            </Tooltip>
          </>
        )}
        <ExportMenu onExport={onExport} disabled={result.total === 0} />
        {onCreate && (
          <Button size="sm" onClick={onCreate} aria-keyshortcuts="N">
            <Plus aria-hidden />
            {createLabel ?? t('common.new')}
          </Button>
        )}
      </div>
    </div>
  )

  const bulkBar = bulkActions && selectedCount > 0 && (
    <div
      className="flex flex-wrap items-center gap-2 border-b bg-selected px-3 py-2 text-selected-foreground"
      role="region"
      aria-label={t('dataTable.bulkActions')}
    >
      <span className="type-label num" aria-live="polite">
        {allMatching
          ? t('dataTable.allSelected', { count: formatNumber(result.total) })
          : t('dataTable.selectedCount', { count: formatNumber(selectedCount) })}
      </span>
      {!allMatching && result.total > selectedCount && table.getIsAllPageRowsSelected() && (
        <Button
          variant="link"
          size="sm"
          className="h-auto px-1"
          onClick={() => setAllMatching(true)}
        >
          {t('dataTable.selectAllMatching', { count: formatNumber(result.total) })}
        </Button>
      )}
      <Button variant="link" size="sm" className="h-auto px-1" onClick={clearSelection}>
        {t('dataTable.clearSelection')}
      </Button>
      <div className="ml-auto flex flex-wrap gap-2">{bulkActions(selection)}</div>
    </div>
  )

  const stateBlock = (() => {
    if (error)
      return (
        <EmptyState
          size="sm"
          icon={<CircleAlert className="text-danger-subtle-foreground" />}
          title={t('dataTable.errorTitle')}
          description={t('dataTable.errorDescription')}
          action={
            onRetry && (
              <Button variant="secondary" size="sm" onClick={onRetry}>
                {t('common.tryAgain')}
              </Button>
            )
          }
        />
      )
    if (!loading && result.total === 0 && hasFilters)
      return (
        <EmptyState
          size="sm"
          icon={<SearchX />}
          title={t('dataTable.noResultsTitle')}
          description={t('dataTable.noResultsDescription')}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                onQueryChange({
                  ...query,
                  search: '',
                  filters: [],
                  advanced: { logic: 'and', conditions: [] },
                  page: 1,
                })
              }
            >
              {t('common.clearFilters')}
            </Button>
          }
        />
      )
    if (!loading && result.total === 0)
      return (
        <EmptyState
          size="sm"
          title={empty?.title ?? t('dataTable.emptyTitle')}
          description={empty?.description ?? t('dataTable.emptyDescription')}
          action={empty?.action}
        />
      )
    return null
  })()

  const pagination = result.total > 0 && (
    <div className="border-t p-3">
      <Pagination
        page={Math.min(query.page, pageCount)}
        pageSize={query.pageSize}
        total={result.total}
        pageSizes={PAGE_SIZES}
        onPageChange={(p) => setQuery({ page: p }, true)}
        onPageSizeChange={(ps) => setQuery({ pageSize: ps })}
      />
    </div>
  )

  return (
    <section
      aria-label={title}
      className="min-w-0 rounded-lg border bg-card shadow-card"
      aria-busy={loading || undefined}
    >
      {toolbarRow}
      {(hasFilters || query.filters.length > 0) && (
        <div className="border-b px-3 py-2">
          <FilterChips columns={columns} query={query} onChange={onQueryChange} />
        </div>
      )}
      {bulkBar}

      {isDesktop ? (
        <div
          ref={scrollRef}
          role="region"
          aria-label={t('dataTable.scrollRegion', { title })}
          tabIndex={0}
          className="relative max-h-[70vh] overflow-auto focus-visible:outline-offset-[-2px]"
        >
          <table
            className="w-full table-fixed border-separate border-spacing-0 type-body num"
            style={{ minWidth: table.getTotalSize() }}
            aria-rowcount={result.total + 1}
          >
            <caption className="sr-only">
              {title} — {t('dataTable.caption', { count: formatNumber(result.total) })}
            </caption>
            <colgroup>
              {headers.map((h) => (
                <col key={h.id} style={{ width: h.getSize() }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {headers.map((h) => {
                  const colId = h.column.id
                  const col = byId.get(colId)
                  const pinned = h.column.getIsPinned()
                  const sortIdx = query.sort.findIndex((s) => s.id === colId)
                  const sortItem = query.sort[sortIdx]
                  const sortable = col && col.sortable !== false
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={
                        sortable
                          ? sortItem
                            ? sortItem.desc
                              ? 'descending'
                              : 'ascending'
                            : 'none'
                          : undefined
                      }
                      style={{
                        width: h.getSize(),
                        left: pinned === 'start' ? h.column.getStart('start') : undefined,
                        right: pinned === 'end' ? 0 : undefined,
                      }}
                      className={cn(
                        'group/th sticky top-0 z-20 h-(--table-row-h) border-b bg-muted px-(--table-cell-px) text-left type-label whitespace-nowrap text-muted-foreground',
                        pinned && 'z-30',
                        colId === lastPinned && 'border-r',
                        pinned === 'end' && 'border-l',
                        col && isNumeric(col.type) && 'text-right',
                      )}
                    >
                      {colId === SELECT ? (
                        <Checkbox
                          aria-label={t('dataTable.selectPage')}
                          checked={
                            table.getIsAllPageRowsSelected()
                              ? true
                              : table.getIsSomePageRowsSelected()
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={(c) => table.toggleAllPageRowsSelected(c === true)}
                        />
                      ) : colId === EXPAND || colId === ACTIONS ? (
                        <span className="sr-only">
                          {colId === EXPAND ? t('dataTable.expand') : t('dataTable.actions')}
                        </span>
                      ) : col ? (
                        <div
                          className={cn(
                            'flex items-center gap-1',
                            isNumeric(col.type) && 'flex-row-reverse',
                          )}
                        >
                          {sortable ? (
                            <button
                              type="button"
                              onClick={(e) => toggleSort(colId, e.shiftKey)}
                              title={t('dataTable.sortHint')}
                              className={cn(
                                'inline-flex min-w-0 cursor-pointer items-center gap-1 rounded-sm transition-colors duration-150 hover:text-foreground',
                                sortItem && 'text-foreground',
                                isNumeric(col.type) && 'flex-row-reverse',
                              )}
                            >
                              <span className="truncate">{col.header}</span>
                              {sortItem ? (
                                sortItem.desc ? (
                                  <ArrowDown className="size-3.5 shrink-0" aria-hidden />
                                ) : (
                                  <ArrowUp className="size-3.5 shrink-0" aria-hidden />
                                )
                              ) : (
                                <ArrowUpDown
                                  className="size-3.5 shrink-0 opacity-0 transition-opacity group-focus-within/th:opacity-100 group-hover/th:opacity-100"
                                  aria-hidden
                                />
                              )}
                              {sortItem && query.sort.length > 1 && (
                                <span
                                  className="type-caption num"
                                  aria-label={t('dataTable.sortOrder', { n: sortIdx + 1 })}
                                >
                                  {sortIdx + 1}
                                </span>
                              )}
                            </button>
                          ) : (
                            <span className="truncate">{col.header}</span>
                          )}
                          {col.filterable !== false && (
                            <ColumnFilterPopover
                              column={col}
                              filter={query.filters.find((f) => f.id === colId)}
                              onChange={(f) => setColumnFilter(colId, f)}
                              getCounts={() => getCounts(colId)}
                            />
                          )}
                        </div>
                      ) : null}
                      {h.column.getCanResize() && (
                        <div
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={t('dataTable.resize', { column: col?.header ?? colId })}
                          aria-valuenow={h.getSize()}
                          tabIndex={0}
                          onMouseDown={h.getResizeHandler()}
                          onTouchStart={h.getResizeHandler()}
                          onDoubleClick={() => h.column.resetSize()}
                          onKeyDown={(e) => {
                            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                            e.preventDefault()
                            const delta = e.key === 'ArrowRight' ? 16 : -16
                            setLayout((l) => ({
                              ...l,
                              sizing: {
                                ...l.sizing,
                                [colId]: Math.max(
                                  h.column.columnDef.minSize ?? 80,
                                  h.getSize() + delta,
                                ),
                              },
                            }))
                          }}
                          className={cn(
                            'absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-primary focus-visible:bg-primary',
                            h.column.getIsResizing() && 'bg-primary',
                          )}
                        />
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {loading && result.rows.length === 0 ? (
                Array.from({ length: Math.min(query.pageSize, 8) }, (_, i) => (
                  <tr key={i}>
                    {headers.map((h) => (
                      <td key={h.id} className="h-(--table-row-h) border-b px-(--table-cell-px)">
                        <Skeleton className="h-4 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : stateBlock ? (
                <tr>
                  <td colSpan={headers.length}>{stateBlock}</td>
                </tr>
              ) : (
                <>
                  {virtual && virtualizer.getVirtualItems()[0] && (
                    <tr aria-hidden>
                      <td
                        colSpan={headers.length}
                        style={{ height: virtualizer.getVirtualItems()[0]!.start }}
                      />
                    </tr>
                  )}
                  {(virtual ? virtualizer.getVirtualItems().map((v) => rows[v.index]!) : rows).map(
                    (row) => {
                      const original = row.original
                      const selected = allMatching || row.getIsSelected()
                      return (
                        <React.Fragment key={row.id}>
                          <tr
                            data-selected={selected || undefined}
                            tabIndex={onRowClick ? 0 : undefined}
                            onClick={(e) => {
                              if (!onRowClick) return
                              const target = e.target as HTMLElement
                              if (
                                target.closest(
                                  'button,a,input,label,[role=checkbox],[role=menuitem],[data-no-row-click]',
                                )
                              )
                                return
                              onRowClick(original)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.target === e.currentTarget && onRowClick)
                                onRowClick(original)
                            }}
                            className={cn(
                              'group/row',
                              onRowClick &&
                                'cursor-pointer outline-none focus-visible:[&>td]:bg-accent',
                            )}
                          >
                            {row.getVisibleCells().map((cell) => {
                              const colId = cell.column.id
                              const col = byId.get(colId)
                              const pinned = cell.column.getIsPinned()
                              return (
                                <td
                                  key={cell.id}
                                  style={{
                                    left:
                                      pinned === 'start'
                                        ? cell.column.getStart('start')
                                        : undefined,
                                    right: pinned === 'end' ? 0 : undefined,
                                  }}
                                  className={cn(
                                    'h-(--table-row-h) truncate border-b bg-card px-(--table-cell-px) transition-colors duration-150 group-hover/row:bg-accent group-data-[selected]/row:bg-selected',
                                    pinned && 'sticky z-10',
                                    colId === lastPinned && 'border-r',
                                    pinned === 'end' && 'border-l',
                                    col && isNumeric(col.type) && 'text-right',
                                    col?.type === 'unique-text' &&
                                      col === columns[0] &&
                                      'font-medium',
                                  )}
                                >
                                  {colId === SELECT ? (
                                    <Checkbox
                                      aria-label={t('dataTable.selectRow', { id: row.id })}
                                      checked={selected}
                                      onCheckedChange={(c) => {
                                        if (allMatching) {
                                          // Sai de "todos os resultados" mantendo a página marcada.
                                          setAllMatching(false)
                                          setRowSelection(
                                            Object.fromEntries(
                                              rows
                                                .filter((r) => r.id !== row.id)
                                                .map((r) => [r.id, true as const]),
                                            ),
                                          )
                                        } else row.toggleSelected(c === true)
                                      }}
                                    />
                                  ) : colId === EXPAND ? (
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-expanded={row.getIsExpanded()}
                                      aria-label={
                                        row.getIsExpanded()
                                          ? t('dataTable.collapseRow')
                                          : t('dataTable.expandRow')
                                      }
                                      onClick={() => row.toggleExpanded()}
                                    >
                                      <ChevronRight
                                        className={cn(
                                          'transition-transform duration-150',
                                          row.getIsExpanded() && 'rotate-90',
                                        )}
                                        aria-hidden
                                      />
                                    </Button>
                                  ) : colId === ACTIONS ? (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon-sm"
                                          aria-label={t('dataTable.rowActions', { id: row.id })}
                                        >
                                          <MoreHorizontal aria-hidden />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        {rowActions?.(original)}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  ) : col ? (
                                    renderCell(col, original)
                                  ) : null}
                                </td>
                              )
                            })}
                          </tr>
                          {row.getIsExpanded() && renderExpanded && (
                            <tr>
                              <td colSpan={headers.length} className="border-b bg-muted px-4 py-3">
                                {renderExpanded(original)}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    },
                  )}
                  {virtual && virtualizer.getVirtualItems().length > 0 && (
                    <tr aria-hidden>
                      <td
                        colSpan={headers.length}
                        style={{
                          height:
                            virtualizer.getTotalSize() -
                            (virtualizer.getVirtualItems().at(-1)?.end ?? 0),
                        }}
                      />
                    </tr>
                  )}
                </>
              )}
            </tbody>
            {hasTotals && !stateBlock && !(loading && result.rows.length === 0) && (
              <tfoot>
                <tr>
                  {headers.map((h, i) => {
                    const col = byId.get(h.column.id)
                    const pinned = h.column.getIsPinned()
                    const total = col?.total ? result.totals[col.id] : undefined
                    const firstData = headers.findIndex((x) => byId.has(x.column.id)) === i
                    return (
                      <td
                        key={h.id}
                        style={{
                          left: pinned === 'start' ? h.column.getStart('start') : undefined,
                          right: pinned === 'end' ? 0 : undefined,
                        }}
                        className={cn(
                          'sticky bottom-0 z-20 h-(--table-row-h) border-t bg-muted px-(--table-cell-px) type-label whitespace-nowrap',
                          pinned && 'z-30',
                          h.column.id === lastPinned && 'border-r',
                          col && isNumeric(col.type) && 'text-right',
                        )}
                      >
                        {total !== undefined
                          ? col!.type === 'currency'
                            ? formatCurrency(total)
                            : formatNumber(total)
                          : firstData
                            ? t('dataTable.totals')
                            : null}
                      </td>
                    )
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <MobileList
          columns={visibleColumns}
          rows={result.rows}
          getRowId={getRowId}
          loading={loading}
          stateBlock={stateBlock}
          onRowClick={onRowClick}
          rowActions={rowActions}
          selectable={Boolean(bulkActions)}
          isSelected={(rid) => allMatching || Boolean(rowSelection[rid])}
          toggle={(rid) => {
            setAllMatching(false)
            setRowSelection((s) => {
              const { [rid]: was, ...rest } = s
              return was ? rest : { ...s, [rid]: true as const }
            })
          }}
          query={query}
          onSort={(sort) => setQuery({ sort })}
        />
      )}
      {pagination}

      <AdvancedFilterSheet
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        columns={columns}
        value={query.advanced}
        onApply={(advanced) => setQuery({ advanced })}
      />
      {!isDesktop && (
        <Sheet open={mobileFilters} onOpenChange={setMobileFilters}>
          <SheetContent side="bottom" className="max-h-[85dvh]">
            <SheetHeader>
              <SheetTitle>{t('dataTable.filters')}</SheetTitle>
              <SheetDescription>{t('dataTable.mobileFiltersDescription')}</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 overflow-y-auto px-4">
              {columns
                .filter((c) => c.filterable !== false)
                .map((c) => (
                  <fieldset key={c.id} className="space-y-2">
                    <legend className="type-label">{c.header}</legend>
                    <FilterEditor
                      column={c}
                      filter={query.filters.find((f) => f.id === c.id)}
                      onChange={(f) => setColumnFilter(c.id, f)}
                      counts={
                        c.type === 'enum' || c.type === 'status' ? getCounts(c.id) : undefined
                      }
                    />
                  </fieldset>
                ))}
            </div>
            <SheetFooter className="flex-row justify-between border-t">
              <Button
                variant="ghost"
                onClick={() => {
                  setMobileFilters(false)
                  setAdvancedOpen(true)
                }}
              >
                {t('dataTable.advanced')}
              </Button>
              <Button onClick={() => setMobileFilters(false)}>
                {t('dataTable.showResults', { count: formatNumber(result.total) })}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}
    </section>
  )
}

/* ================================================================ celular: cards */

function MobileList<T>({
  columns,
  rows,
  getRowId,
  loading,
  stateBlock,
  onRowClick,
  rowActions,
  selectable,
  isSelected,
  toggle,
  query,
  onSort,
}: {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string
  loading?: boolean
  stateBlock: React.ReactNode
  onRowClick?: (row: T) => void
  rowActions?: (row: T) => React.ReactNode
  selectable: boolean
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  query: TableQuery
  onSort: (sort: SortItem[]) => void
}) {
  const { t } = useTranslation()
  const titleCol = columns.find((c) => c.mobile === 'title') ?? columns[0]
  const badgeCol =
    columns.find((c) => c.mobile === 'badge') ?? columns.find((c) => c.type === 'status')
  const rest = columns
    .filter((c) => c !== titleCol && c !== badgeCol && c.mobile !== 'hidden')
    .slice(0, 4)
  const sortable = columns.filter((c) => c.sortable !== false)
  const current = query.sort[0]

  return (
    <div>
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Select
          value={current?.id ?? '__none'}
          onValueChange={(v) =>
            onSort(v === '__none' ? [] : [{ id: v, desc: current?.desc ?? false }])
          }
        >
          <SelectTrigger className="h-control-sm flex-1" aria-label={t('dataTable.sortBy')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">{t('dataTable.defaultOrder')}</SelectItem>
            {sortable.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.header}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="secondary"
          size="icon-sm"
          disabled={!current}
          aria-label={current?.desc ? t('dataTable.descending') : t('dataTable.ascending')}
          onClick={() => current && onSort([{ ...current, desc: !current.desc }])}
        >
          {current?.desc ? <ArrowDown aria-hidden /> : <ArrowUp aria-hidden />}
        </Button>
      </div>
      {loading && rows.length === 0 ? (
        <ul className="space-y-2 p-3">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="space-y-2 rounded-lg border p-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </li>
          ))}
        </ul>
      ) : stateBlock ? (
        stateBlock
      ) : (
        <ul className="space-y-2 p-3">
          {rows.map((row) => {
            const rid = getRowId(row)
            return (
              <li
                key={rid}
                data-selected={isSelected(rid) || undefined}
                className="rounded-lg border bg-card p-3 data-[selected]:border-primary data-[selected]:bg-selected"
              >
                <div className="flex items-start gap-2">
                  {selectable && (
                    <Checkbox
                      className="mt-0.5"
                      checked={isSelected(rid)}
                      onCheckedChange={() => toggle(rid)}
                      aria-label={t('dataTable.selectRow', { id: rid })}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    {onRowClick ? (
                      <button
                        type="button"
                        onClick={() => onRowClick(row)}
                        className="max-w-full cursor-pointer truncate text-left type-label text-link hover:underline"
                      >
                        {titleCol ? formatValue(titleCol, titleCol.accessor(row)) : rid}
                      </button>
                    ) : (
                      <p className="truncate type-label">
                        {titleCol ? renderCell(titleCol, row) : rid}
                      </p>
                    )}
                  </div>
                  {badgeCol && renderCell(badgeCol, row)}
                  {rowActions && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t('dataTable.rowActions', { id: rid })}
                        >
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">{rowActions(row)}</DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {rest.map((c) => (
                    <div key={c.id} className="min-w-0">
                      <dt className="type-caption text-muted-foreground">{c.header}</dt>
                      <dd className="truncate type-body num">{renderCell(c, row)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
