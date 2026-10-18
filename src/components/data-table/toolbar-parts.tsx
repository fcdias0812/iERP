import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Bookmark,
  BookmarkCheck,
  Columns3,
  Download,
  FileSpreadsheet,
  FileText,
  FileType,
  GripVertical,
  Pin,
  PinOff,
  Star,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tag } from '@/components/ui/tag'
import { toast } from '@/components/ui/sonner'
import { formatCurrency, formatDate, formatNumber } from '@/lib/format'
import { columnOptions, parseDay } from './filter-utils'
import type { ExportFormat } from './export'
import type { SavedView } from './views-store'
import type { ColumnFilter, Condition, DataTableColumn, TableQuery } from './types'

/* ------------------------------------------------------------ chips de filtros ativos */

function describeFilter<T>(
  col: DataTableColumn<T>,
  f: ColumnFilter,
  t: (k: string, o?: object) => string,
) {
  const num = (n: number) => (col.type === 'currency' ? formatCurrency(n) : formatNumber(n))
  switch (f.kind) {
    case 'text':
      return t('dataTable.chip.contains', { value: f.value })
    case 'in': {
      const labels = columnOptions(col)
        .filter((o) => f.values.includes(o.value))
        .map((o) => o.label)
      return labels.length > 2
        ? t('dataTable.chip.many', { first: labels[0], count: labels.length - 1 })
        : labels.join(', ')
    }
    case 'range':
      if (f.min !== undefined && f.max !== undefined) return `${num(f.min)} – ${num(f.max)}`
      return f.min !== undefined ? `≥ ${num(f.min)}` : `≤ ${num(f.max!)}`
    case 'dateRange':
      if (f.from && f.to) return `${formatDate(parseDay(f.from))} – ${formatDate(parseDay(f.to))}`
      return f.from ? `≥ ${formatDate(parseDay(f.from))}` : `≤ ${formatDate(parseDay(f.to))}`
    case 'bool':
      return f.value ? t('dataTable.yes') : t('dataTable.no')
  }
}

function describeCondition<T>(
  col: DataTableColumn<T>,
  c: Condition,
  t: (k: string, o?: object) => string,
) {
  const fmt = (v: unknown) => {
    if (v === undefined || v === null || v === '') return '…'
    if (Array.isArray(v))
      return columnOptions(col)
        .filter((o) => v.includes(o.value))
        .map((o) => o.label)
        .join(', ')
    if (col.type === 'currency') return formatCurrency(Number(v))
    if (col.type === 'number') return formatNumber(Number(v))
    if (col.type === 'date') return formatDate(parseDay(String(v)))
    if (col.type === 'boolean') return v ? t('dataTable.yes') : t('dataTable.no')
    return `“${String(v)}”`
  }
  const op = t(`dataTable.ops.${c.op}`)
  if (c.op === 'empty' || c.op === 'notEmpty') return `${col.header} ${op}`
  if (c.op === 'between')
    return `${col.header} ${op} ${fmt(c.value)} ${t('dataTable.and')} ${fmt(c.value2)}`
  return `${col.header} ${op} ${fmt(c.value)}`
}

export function FilterChips<T>({
  columns,
  query,
  onChange,
}: {
  columns: DataTableColumn<T>[]
  query: TableQuery
  onChange: (q: TableQuery) => void
}) {
  const { t } = useTranslation()
  const tt = t as unknown as (k: string, o?: object) => string
  const byId = new Map(columns.map((c) => [c.id, c]))
  const chips: { key: string; label: string; remove: () => void }[] = []
  if (query.search)
    chips.push({
      key: 'search',
      label: t('dataTable.chip.search', { value: query.search }),
      remove: () => onChange({ ...query, search: '', page: 1 }),
    })
  for (const f of query.filters) {
    const col = byId.get(f.id)
    if (!col) continue
    chips.push({
      key: `f-${f.id}`,
      label: `${col.header}: ${describeFilter(col, f, tt)}`,
      remove: () =>
        onChange({ ...query, filters: query.filters.filter((x) => x.id !== f.id), page: 1 }),
    })
  }
  for (const c of query.advanced.conditions) {
    const col = byId.get(c.columnId)
    if (!col) continue
    chips.push({
      key: `a-${c.id}`,
      label: describeCondition(col, c, tt),
      remove: () =>
        onChange({
          ...query,
          advanced: {
            ...query.advanced,
            conditions: query.advanced.conditions.filter((x) => x.id !== c.id),
          },
          page: 1,
        }),
    })
  }
  if (!chips.length) return null
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      aria-label={t('dataTable.activeFilters')}
      role="group"
    >
      {query.advanced.conditions.length > 1 && (
        <span className="type-caption text-muted-foreground">
          {query.advanced.logic === 'and'
            ? t('dataTable.allConditions')
            : t('dataTable.anyCondition')}
        </span>
      )}
      {chips.map((c) => (
        <Tag key={c.key} onRemove={c.remove} removeLabel={c.label} className="max-w-80">
          {c.label}
        </Tag>
      ))}
      <Button
        variant="link"
        size="sm"
        className="h-auto px-1"
        onClick={() =>
          onChange({
            ...query,
            search: '',
            filters: [],
            advanced: { logic: 'and', conditions: [] },
            page: 1,
          })
        }
      >
        {t('dataTable.clearAll')}
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------ colunas */

interface ColumnsMenuProps<T> {
  columns: DataTableColumn<T>[]
  order: string[]
  visibility: Record<string, boolean>
  pinned: string[]
  onOrderChange: (order: string[]) => void
  onVisibilityChange: (id: string, visible: boolean) => void
  onPinChange: (id: string, pinned: boolean) => void
  onReset: () => void
}

/** Mostrar/ocultar, reordenar (arrastar ou teclado) e fixar colunas. */
export function ColumnsMenu<T>(props: ColumnsMenuProps<T>) {
  const { t } = useTranslation()
  const { columns, order, onOrderChange } = props
  const byId = new Map(columns.map((c) => [c.id, c]))
  const ordered = order.filter((id) => byId.has(id))
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    onOrderChange(
      arrayMove(ordered, ordered.indexOf(String(active.id)), ordered.indexOf(String(over.id))),
    )
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" aria-label={t('dataTable.columns')}>
          <Columns3 aria-hidden />
          <span className="hidden lg:inline">{t('dataTable.columns')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <p className="px-2 py-1 type-label">{t('dataTable.columns')}</p>
        <p className="px-2 pb-2 type-caption text-muted-foreground">{t('dataTable.columnsHint')}</p>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            screenReaderInstructions: { draggable: t('dataTable.reorderInstructions') },
          }}
        >
          <SortableContext items={ordered} strategy={verticalListSortingStrategy}>
            <ul className="max-h-80 space-y-0.5 overflow-y-auto">
              {ordered.map((id) => (
                <ColumnRow key={id} column={byId.get(id)!} {...props} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <div className="mt-2 border-t pt-2">
          <Button variant="ghost" size="sm" onClick={props.onReset}>
            {t('dataTable.resetColumns')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ColumnRow<T>({
  column,
  visibility,
  pinned,
  onVisibilityChange,
  onPinChange,
}: { column: DataTableColumn<T> } & ColumnsMenuProps<T>) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  })
  const visible = visibility[column.id] !== false
  const isPinned = pinned.includes(column.id)
  const id = React.useId()
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-1 rounded-sm px-1 py-0.5 hover:bg-accent',
        isDragging && 'bg-elevated shadow-popover',
      )}
    >
      <button
        type="button"
        className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-sm text-muted-foreground"
        aria-label={t('dataTable.reorder', { column: column.header })}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <Checkbox
        id={id}
        checked={visible}
        disabled={column.hideable === false}
        onCheckedChange={(c) => onVisibilityChange(column.id, c === true)}
      />
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer truncate type-body">
        {column.header}
      </label>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-pressed={isPinned}
        aria-label={
          isPinned
            ? t('dataTable.unpin', { column: column.header })
            : t('dataTable.pin', { column: column.header })
        }
        onClick={() => onPinChange(column.id, !isPinned)}
        className={cn(isPinned && 'text-primary')}
      >
        {isPinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
      </Button>
    </li>
  )
}

/* ------------------------------------------------------------ visões salvas */

export function ViewsMenu({
  views,
  defaultId,
  activeId,
  onApply,
  onSave,
  onDelete,
  onSetDefault,
  onReset,
}: {
  views: SavedView[]
  defaultId?: string
  activeId?: string
  onApply: (view: SavedView) => void
  onSave: (name: string, asDefault: boolean) => void
  onDelete: (id: string) => void
  onSetDefault: (id: string | undefined) => void
  onReset: () => void
}) {
  const { t } = useTranslation()
  const [dialog, setDialog] = React.useState(false)
  const [name, setName] = React.useState('')
  const [asDefault, setAsDefault] = React.useState(false)
  const active = views.find((v) => v.id === activeId)
  const defaultCheckId = React.useId()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            aria-label={active ? `${t('dataTable.views')}: ${active.name}` : t('dataTable.views')}
          >
            {active ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
            <span className="hidden max-w-40 truncate lg:inline">
              {active?.name ?? t('dataTable.views')}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-muted-foreground">
            {t('dataTable.savedViews')}
          </DropdownMenuLabel>
          {views.length === 0 && (
            <p className="px-2 py-1.5 type-caption text-muted-foreground">
              {t('dataTable.noViews')}
            </p>
          )}
          {views.map((v) => (
            <DropdownMenuSub key={v.id}>
              <DropdownMenuSubTrigger>
                {v.id === activeId ? (
                  <BookmarkCheck className="text-primary" aria-hidden />
                ) : (
                  <Bookmark aria-hidden />
                )}
                <span className="truncate">{v.name}</span>
                {v.id === defaultId && (
                  <span className="ml-auto inline-flex items-center gap-1 type-caption text-muted-foreground">
                    <Star className="size-3 fill-current" aria-hidden />
                    {t('dataTable.default')}
                  </span>
                )}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onSelect={() => onApply(v)}>
                  {t('dataTable.applyView')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => onSetDefault(v.id === defaultId ? undefined : v.id)}
                >
                  <Star aria-hidden />
                  {v.id === defaultId
                    ? t('dataTable.unsetDefaultShort')
                    : t('dataTable.setDefaultShort')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onDelete(v.id)}>
                  <Trash2 aria-hidden />
                  {t('common.delete')}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setName(active?.name ?? '')
              setAsDefault(false)
              setDialog(true)
            }}
          >
            <Bookmark aria-hidden />
            {t('dataTable.saveView')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onReset}>{t('dataTable.resetView')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dataTable.saveView')}</DialogTitle>
            <DialogDescription>{t('dataTable.saveViewDescription')}</DialogDescription>
          </DialogHeader>
          <form
            className="grid grid-cols-1 gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim()) return
              onSave(name.trim(), asDefault)
              setDialog(false)
              toast.success(t('dataTable.viewSaved', { name: name.trim() }))
            }}
          >
            <FormField label={t('dataTable.viewName')} required>
              {(p) => (
                <Input
                  {...p}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  autoFocus
                />
              )}
            </FormField>
            <div className="flex items-center gap-2">
              <Checkbox
                id={defaultCheckId}
                checked={asDefault}
                onCheckedChange={(c) => setAsDefault(c === true)}
              />
              <label htmlFor={defaultCheckId} className="type-body">
                {t('dataTable.useAsDefault')}
              </label>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={!name.trim()}>
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ------------------------------------------------------------ exportar */

export function ExportMenu({
  onExport,
  disabled,
}: {
  onExport: (f: ExportFormat) => Promise<void>
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = React.useState(false)
  const run = async (f: ExportFormat) => {
    setBusy(true)
    try {
      await onExport(f)
      toast.success(t('dataTable.exported'))
    } catch {
      toast.error(t('dataTable.exportFailed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          loading={busy}
          disabled={disabled}
          aria-label={t('common.export')}
        >
          {!busy && <Download aria-hidden />}
          <span className="hidden lg:inline">{t('common.export')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void run('csv')}>
          <FileText aria-hidden />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run('xlsx')}>
          <FileSpreadsheet aria-hidden />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run('pdf')}>
          <FileType aria-hidden />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
