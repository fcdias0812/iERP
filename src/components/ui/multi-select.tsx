import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command'
import { fieldBase } from './input'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Tag } from './tag'
import type { FieldControlProps } from './form-field'

export interface Option {
  value: string
  label: string
  /** Contagem exibida à direita (filtros com contagem por valor). */
  count?: number
}

interface MultiSelectProps extends Partial<FieldControlProps> {
  options: Option[]
  value: string[]
  onValueChange: (value: string[]) => void
  placeholder?: string
  /** Quantos chips mostrar antes de "+N". */
  maxChips?: number
  className?: string
}

/** Multisseleção com busca e chips removíveis. */
export function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder,
  maxChips = 2,
  className,
  ...field
}: MultiSelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const selected = options.filter((o) => value.includes(o.value))
  const toggle = (v: string) =>
    onValueChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn('relative', className)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            {...field}
            className={cn(
              fieldBase,
              'h-auto min-h-(--control-h) cursor-pointer items-center gap-1 py-1 pr-8 text-left',
            )}
          >
            {selected.length === 0 ? (
              <span className="text-placeholder">{placeholder ?? t('field.selectMany')}</span>
            ) : (
              <span className="flex flex-wrap gap-1">
                {selected.slice(0, maxChips).map((o) => (
                  <Tag key={o.value}>{o.label}</Tag>
                ))}
                {selected.length > maxChips && (
                  <Tag className="text-muted-foreground">+{selected.length - maxChips}</Tag>
                )}
                <span className="sr-only">
                  {t('field.selectedCount', { count: selected.length })}
                </span>
              </span>
            )}
          </button>
        </PopoverTrigger>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      </div>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder={t('field.search')} className="h-10" />
          <CommandList>
            <CommandEmpty>{t('field.noOptions')}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const checked = value.includes(o.value)
                return (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    onSelect={() => toggle(o.value)}
                    aria-checked={checked}
                  >
                    <span
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded-sm border border-input',
                        checked && 'border-primary bg-primary text-primary-foreground',
                      )}
                      aria-hidden
                    >
                      {checked && <Check className="size-3 text-primary-foreground" />}
                    </span>
                    <span className="truncate">{o.label}</span>
                    {o.count !== undefined && (
                      <span className="ml-auto type-caption text-muted-foreground num">
                        {o.count}
                      </span>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
          {value.length > 0 && (
            <div className="border-t p-1">
              <button
                type="button"
                onClick={() => onValueChange([])}
                className="w-full cursor-pointer rounded-sm px-2 py-1.5 text-left type-body text-link hover:bg-accent"
              >
                {t('field.clearSelection')}
              </button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
