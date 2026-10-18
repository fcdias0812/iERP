import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ListFilter, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DatePicker, DateRangePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput, NumberInput } from '@/components/ui/masked-input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
import { useDebounced } from '@/hooks/use-debounced'
import { formatNumber } from '@/lib/format'
import { columnOptions, parseDay, toDay } from './filter-utils'
import {
  OPERATORS_BY_TYPE,
  type ColumnFilter,
  type Condition,
  type DataTableColumn,
  type Operator,
} from './types'

/* ------------------------------------------------------------ editor por tipo */

interface FilterEditorProps<T> {
  column: DataTableColumn<T>
  filter?: ColumnFilter
  onChange: (filter: ColumnFilter | undefined) => void
  /** Contagem por valor (enum/status). */
  counts?: Map<string, number>
}

/** Controles de filtro de UMA coluna, conforme o tipo. Usado no popover e na gaveta do celular. */
export function FilterEditor<T>({ column, filter, onChange, counts }: FilterEditorProps<T>) {
  const { t } = useTranslation()
  const id = React.useId()

  if (column.type === 'unique-text') {
    return <TextFilter column={column} filter={filter} onChange={onChange} />
  }

  if (column.type === 'enum' || column.type === 'status') {
    const values = filter?.kind === 'in' ? filter.values : []
    return (
      <FacetList
        options={columnOptions(column)}
        values={values}
        counts={counts}
        onChange={(next) =>
          onChange(next.length ? { id: column.id, kind: 'in', values: next } : undefined)
        }
      />
    )
  }

  if (column.type === 'number' || column.type === 'currency') {
    const f = filter?.kind === 'range' ? filter : { id: column.id, kind: 'range' as const }
    const Field = column.type === 'currency' ? CurrencyInput : NumberInput
    const set = (patch: { min?: number | null; max?: number | null }) => {
      const min = patch.min === undefined ? f.min : (patch.min ?? undefined)
      const max = patch.max === undefined ? f.max : (patch.max ?? undefined)
      onChange(
        min === undefined && max === undefined
          ? undefined
          : { id: column.id, kind: 'range', min, max },
      )
    }
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-min`}>{t('dataTable.from')}</Label>
          <Field
            id={`${id}-min`}
            value={f.min ?? null}
            onValueChange={(v) => set({ min: v })}
            scale={2}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-max`}>{t('dataTable.to')}</Label>
          <Field
            id={`${id}-max`}
            value={f.max ?? null}
            onValueChange={(v) => set({ max: v })}
            scale={2}
          />
        </div>
      </div>
    )
  }

  if (column.type === 'date') {
    const f = filter?.kind === 'dateRange' ? filter : undefined
    return (
      <div className="space-y-1">
        <Label htmlFor={`${id}-range`}>{t('dataTable.period')}</Label>
        <DateRangePicker
          id={`${id}-range`}
          value={f?.from || f?.to ? { from: parseDay(f.from), to: parseDay(f.to) } : undefined}
          onValueChange={(r) =>
            onChange(
              r?.from || r?.to
                ? { id: column.id, kind: 'dateRange', from: toDay(r.from), to: toDay(r.to) }
                : undefined,
            )
          }
        />
        <p className="type-caption text-muted-foreground">{t('dataTable.untilInclusive')}</p>
      </div>
    )
  }

  // boolean: três estados
  const current = filter?.kind === 'bool' ? (filter.value ? 'yes' : 'no') : 'all'
  return (
    <RadioGroup
      value={current}
      onValueChange={(v) =>
        onChange(v === 'all' ? undefined : { id: column.id, kind: 'bool', value: v === 'yes' })
      }
      aria-label={column.header}
    >
      {(['all', 'yes', 'no'] as const).map((v) => (
        <div key={v} className="flex items-center gap-2">
          <RadioGroupItem value={v} id={`${id}-${v}`} />
          <Label htmlFor={`${id}-${v}`} className="font-normal">
            {t(`dataTable.${v}`)}
          </Label>
        </div>
      ))}
    </RadioGroup>
  )
}

function TextFilter<T>({ column, filter, onChange }: FilterEditorProps<T>) {
  const { t } = useTranslation()
  const [text, setText] = React.useState(filter?.kind === 'text' ? filter.value : '')
  const debounced = useDebounced(text, 300)
  const onChangeRef = React.useRef(onChange)
  React.useEffect(() => {
    onChangeRef.current = onChange
  })
  React.useEffect(() => {
    onChangeRef.current(debounced ? { id: column.id, kind: 'text', value: debounced } : undefined)
  }, [debounced, column.id])
  return (
    <Input
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder={t('dataTable.contains')}
      aria-label={t('dataTable.filterBy', { column: column.header })}
      autoFocus
    />
  )
}

/** Lista de valores com busca, checkbox e contagem (filtro de colunas que se repetem). */
export function FacetList({
  options,
  values,
  counts,
  onChange,
}: {
  options: { value: string; label: string }[]
  values: string[]
  counts?: Map<string, number>
  onChange: (values: string[]) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = React.useState('')
  const visible = options.filter((o) =>
    o.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  )
  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v])
  return (
    <div className="space-y-2">
      {options.length > 6 && (
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('field.search')}
          className="h-control-sm"
          aria-label={t('field.search')}
        />
      )}
      <ul className="max-h-64 space-y-0.5 overflow-y-auto" role="listbox" aria-multiselectable>
        {visible.map((o) => {
          const checked = values.includes(o.value)
          const count = counts?.get(o.value) ?? (counts ? 0 : undefined)
          return (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggle(o.value)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left type-body hover:bg-accent"
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-sm border border-input',
                    checked && 'border-primary bg-primary text-primary-foreground',
                  )}
                >
                  {checked && <Check className="size-3" />}
                </span>
                <span className="truncate">{o.label}</span>
                {count !== undefined && (
                  <span className="ml-auto type-caption text-muted-foreground num">
                    {formatNumber(count)}
                  </span>
                )}
              </button>
            </li>
          )
        })}
        {visible.length === 0 && (
          <li className="px-2 py-3 type-body text-muted-foreground">{t('field.noOptions')}</li>
        )}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------ popover do título */

export function ColumnFilterPopover<T>({
  column,
  filter,
  onChange,
  getCounts,
}: {
  column: DataTableColumn<T>
  filter?: ColumnFilter
  onChange: (filter: ColumnFilter | undefined) => void
  getCounts?: () => Map<string, number> | undefined
}) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const active = Boolean(filter)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            active
              ? t('dataTable.filterActive', { column: column.header })
              : t('dataTable.filterBy', { column: column.header })
          }
          className={cn(
            'inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors duration-150 hover:bg-accent hover:text-foreground',
            active ? 'bg-selected text-selected-foreground' : 'text-muted-foreground',
          )}
        >
          <ListFilter className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-3">
        <p className="type-label">{t('dataTable.filterBy', { column: column.header })}</p>
        {open && (
          <FilterEditor
            column={column}
            filter={filter}
            onChange={onChange}
            counts={column.type === 'enum' || column.type === 'status' ? getCounts?.() : undefined}
          />
        )}
        <div className="flex justify-between gap-2 border-t pt-2">
          <Button variant="ghost" size="sm" disabled={!active} onClick={() => onChange(undefined)}>
            {t('dataTable.clear')}
          </Button>
          <Button size="sm" onClick={() => setOpen(false)}>
            {t('common.close')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ------------------------------------------------------------ filtros avançados */

let seq = 0
const newId = () => `c${Date.now().toString(36)}${seq++}`

export function AdvancedFilterSheet<T>({
  open,
  onOpenChange,
  columns,
  value,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  columns: DataTableColumn<T>[]
  value: { logic: 'and' | 'or'; conditions: Condition[] }
  onApply: (value: { logic: 'and' | 'or'; conditions: Condition[] }) => void
}) {
  const { t } = useTranslation()
  const filterable = columns.filter((c) => c.filterable !== false)
  const [draft, setDraft] = React.useState(value)
  const [prevOpen, setPrevOpen] = React.useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open)
      setDraft(value.conditions.length ? value : { logic: value.logic, conditions: [blank()] })
  }

  function blank(): Condition {
    const col = filterable[0]!
    return { id: newId(), columnId: col.id, op: OPERATORS_BY_TYPE[col.type][0]! }
  }
  const update = (id: string, patch: Partial<Condition>) =>
    setDraft((d) => ({
      ...d,
      conditions: d.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t('dataTable.advanced')}</SheetTitle>
          <SheetDescription>{t('dataTable.advancedDescription')}</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4">
          <div className="flex items-center gap-2 type-body">
            <span>{t('dataTable.matchLabel')}</span>
            <Select
              value={draft.logic}
              onValueChange={(v) => setDraft((d) => ({ ...d, logic: v as 'and' | 'or' }))}
            >
              <SelectTrigger className="h-control-sm w-auto" aria-label={t('dataTable.matchLabel')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="and">{t('dataTable.logicAnd')}</SelectItem>
                <SelectItem value="or">{t('dataTable.logicOr')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ol className="space-y-2">
            {draft.conditions.map((c, i) => {
              const col = filterable.find((x) => x.id === c.columnId) ?? filterable[0]!
              return (
                <li key={c.id} className="space-y-2 rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="type-caption text-muted-foreground">
                      {i === 0
                        ? t('dataTable.where')
                        : draft.logic === 'and'
                          ? t('dataTable.and')
                          : t('dataTable.or')}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('dataTable.removeCondition')}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          conditions: d.conditions.filter((x) => x.id !== c.id),
                        }))
                      }
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Select
                      value={col.id}
                      onValueChange={(v) => {
                        const next = filterable.find((x) => x.id === v)!
                        update(c.id, {
                          columnId: v,
                          op: OPERATORS_BY_TYPE[next.type][0],
                          value: undefined,
                          value2: undefined,
                        })
                      }}
                    >
                      <SelectTrigger aria-label={t('dataTable.column')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {filterable.map((x) => (
                          <SelectItem key={x.id} value={x.id}>
                            {x.header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={c.op} onValueChange={(v) => update(c.id, { op: v as Operator })}>
                      <SelectTrigger aria-label={t('dataTable.operator')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS_BY_TYPE[col.type].map((op) => (
                          <SelectItem key={op} value={op}>
                            {t(`dataTable.ops.${op}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <ConditionValue
                    column={col}
                    condition={c}
                    onChange={(patch) => update(c.id, patch)}
                  />
                </li>
              )
            })}
          </ol>
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => setDraft((d) => ({ ...d, conditions: [...d.conditions, blank()] }))}
          >
            <Plus aria-hidden />
            {t('dataTable.addCondition')}
          </Button>
        </div>
        <SheetFooter className="flex-row justify-end border-t">
          <Button
            variant="ghost"
            onClick={() => {
              onApply({ logic: 'and', conditions: [] })
              onOpenChange(false)
            }}
          >
            {t('dataTable.clear')}
          </Button>
          <Button
            onClick={() => {
              onApply(draft)
              onOpenChange(false)
            }}
          >
            {t('dataTable.apply')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function ConditionValue<T>({
  column,
  condition: c,
  onChange,
}: {
  column: DataTableColumn<T>
  condition: Condition
  onChange: (patch: Partial<Condition>) => void
}) {
  const { t } = useTranslation()
  if (c.op === 'empty' || c.op === 'notEmpty') return null
  const two = c.op === 'between'

  if (column.type === 'enum' || column.type === 'status') {
    const values = Array.isArray(c.value) ? c.value : []
    return (
      <div className="rounded-md border p-1">
        <FacetList
          options={columnOptions(column)}
          values={values}
          onChange={(v) => onChange({ value: v })}
        />
      </div>
    )
  }
  if (column.type === 'boolean') {
    return (
      <Select
        value={c.value === undefined ? undefined : String(c.value)}
        onValueChange={(v) => onChange({ value: v === 'true' })}
      >
        <SelectTrigger aria-label={t('dataTable.value')}>
          <SelectValue placeholder={t('field.selectOne')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">{t('dataTable.yes')}</SelectItem>
          <SelectItem value="false">{t('dataTable.no')}</SelectItem>
        </SelectContent>
      </Select>
    )
  }
  if (column.type === 'date') {
    return (
      <div className={cn('grid grid-cols-1 gap-2', two && 'sm:grid-cols-2')}>
        <DatePicker
          aria-label={t('dataTable.value')}
          value={parseDay(c.value as string | undefined)}
          onValueChange={(d) => onChange({ value: toDay(d) })}
        />
        {two && (
          <DatePicker
            aria-label={t('dataTable.value2')}
            value={parseDay(c.value2 as string | undefined)}
            onValueChange={(d) => onChange({ value2: toDay(d) })}
          />
        )}
      </div>
    )
  }
  if (column.type === 'number' || column.type === 'currency') {
    const Field = column.type === 'currency' ? CurrencyInput : NumberInput
    return (
      <div className={cn('grid grid-cols-1 gap-2', two && 'sm:grid-cols-2')}>
        <Field
          aria-label={t('dataTable.value')}
          scale={2}
          value={typeof c.value === 'number' ? c.value : null}
          onValueChange={(v) => onChange({ value: v ?? undefined })}
        />
        {two && (
          <Field
            aria-label={t('dataTable.value2')}
            scale={2}
            value={typeof c.value2 === 'number' ? c.value2 : null}
            onValueChange={(v) => onChange({ value2: v ?? undefined })}
          />
        )}
      </div>
    )
  }
  return (
    <Input
      aria-label={t('dataTable.value')}
      value={typeof c.value === 'string' ? c.value : ''}
      onChange={(e) => onChange({ value: e.target.value })}
    />
  )
}
