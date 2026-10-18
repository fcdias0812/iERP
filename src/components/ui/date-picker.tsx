import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { Calendar, type DateRange } from './calendar'
import { fieldBase } from './input'
import { TimeInput } from './masked-input'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import type { FieldControlProps } from './form-field'

type ControlProps = Partial<FieldControlProps> & { className?: string; placeholder?: string }

/**
 * O gatilho é um botão: `aria-required`/`required` não valem em botão (o "* obrigatório" do
 * rótulo do FormField já informa) — saem do gatilho.
 */
function semObrigatorio<T extends { required?: boolean; 'aria-required'?: unknown }>(field: T) {
  return { ...field, required: undefined, 'aria-required': undefined }
}

/**
 * Nome acessível do gatilho: com `aria-label`, vira "rótulo: texto visível" — o nome contém o que
 * se vê (WCAG 2.5.3, rótulo no nome) e o leitor de tela ouve o valor atual.
 */
const nomeComTexto = (rotulo: string | undefined, texto: string) =>
  rotulo ? `${rotulo}: ${texto}` : undefined

const triggerClass = cn(
  fieldBase,
  'cursor-pointer items-center gap-2 text-left data-[empty=true]:text-placeholder',
)

/** Botão "limpar", ao lado do gatilho (botão dentro de botão não é permitido). */
function ClearButton({ onClear, disabled }: { onClear: () => void; disabled?: boolean }) {
  const { t } = useTranslation()
  if (disabled) return null
  return (
    <button
      type="button"
      aria-label={t('field.clearDate')}
      onClick={onClear}
      className="absolute inset-y-0 right-1.5 my-auto inline-flex size-6 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <XIcon className="size-3.5" aria-hidden />
    </button>
  )
}

/* ------------------------------------------------------------ data */

interface DatePickerProps extends ControlProps {
  /** Rótulo para leitor de tela quando não há <label> (o texto visível é somado a ele). */
  'aria-label'?: string
  value?: Date
  onValueChange: (date: Date | undefined) => void
  /** Datas fora do intervalo ficam desabilitadas. */
  fromDate?: Date
  toDate?: Date
}

/** Data (dd/mm/aaaa no pt-BR), com calendário no popover. */
export function DatePicker({
  value,
  onValueChange,
  fromDate,
  toDate,
  className,
  placeholder,
  ...field
}: DatePickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const texto = value ? formatDate(value) : (placeholder ?? t('field.pickDate'))
  const disabledDays = [
    ...(fromDate ? [{ before: fromDate }] : []),
    ...(toDate ? [{ after: toDate }] : []),
  ]
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn('relative', className)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            {...semObrigatorio(field)}
            aria-label={nomeComTexto(field['aria-label'], texto)}
            data-empty={!value}
            className={cn(triggerClass, 'pr-9')}
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate num">{texto}</span>
          </button>
        </PopoverTrigger>
        {value && (
          <ClearButton onClear={() => onValueChange(undefined)} disabled={field.disabled} />
        )}
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          defaultMonth={value}
          disabled={disabledDays}
          onSelect={(d) => {
            onValueChange(d)
            setOpen(false)
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

/* ------------------------------------------------------------ período */

interface DateRangePickerProps extends ControlProps {
  /** Rótulo para leitor de tela quando não há <label> (o texto visível é somado a ele). */
  'aria-label'?: string
  value?: DateRange
  onValueChange: (range: DateRange | undefined) => void
}

/** Período de/até (dois meses lado a lado). O "até" deve ser tratado como o dia inteiro. */
export function DateRangePicker({
  value,
  onValueChange,
  className,
  placeholder,
  ...field
}: DateRangePickerProps) {
  const { t } = useTranslation()
  const label = value?.from
    ? `${formatDate(value.from)} – ${value.to ? formatDate(value.to) : '…'}`
    : (placeholder ?? t('field.pickRange'))
  return (
    <Popover>
      <div className={cn('relative', className)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            {...semObrigatorio(field)}
            aria-label={nomeComTexto(field['aria-label'], label)}
            data-empty={!value?.from}
            className={cn(triggerClass, 'pr-9')}
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate num">{label}</span>
          </button>
        </PopoverTrigger>
        {value?.from && (
          <ClearButton onClear={() => onValueChange(undefined)} disabled={field.disabled} />
        )}
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          defaultMonth={value?.from}
          onSelect={onValueChange}
          numberOfMonths={2}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

/* ------------------------------------------------------------ data e hora */

interface DateTimePickerProps extends ControlProps {
  value?: Date
  onValueChange: (date: Date | undefined) => void
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Data + hora. A hora é aplicada sobre a data escolhida. */
export function DateTimePicker({ value, onValueChange, className, ...field }: DateTimePickerProps) {
  const { t } = useTranslation()
  const time = value ? `${pad(value.getHours())}:${pad(value.getMinutes())}` : ''
  const merge = (date: Date | undefined, hhmm: string) => {
    if (!date) return onValueChange(undefined)
    const [h, m] = hhmm.split(':').map(Number)
    const next = new Date(date)
    next.setHours(Number.isFinite(h) ? h! : 0, Number.isFinite(m) ? m! : 0, 0, 0)
    onValueChange(next)
  }
  return (
    <div className={cn('flex gap-2', className)}>
      <DatePicker
        {...field}
        value={value}
        onValueChange={(d) => merge(d, time || '00:00')}
        className="flex-1"
      />
      <TimeInput
        value={time}
        disabled={field.disabled || !value}
        aria-label={t('field.time')}
        onValueChange={(v) => v.length === 5 && merge(value, v)}
      />
    </div>
  )
}
