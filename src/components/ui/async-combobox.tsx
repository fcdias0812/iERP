import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounced } from '@/hooks/use-debounced'
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
import { Spinner } from './spinner'
import type { Option } from './multi-select'
import type { FieldControlProps } from './form-field'

interface AsyncComboboxProps extends Partial<FieldControlProps> {
  /** Chave do cache (TanStack Query), ex.: 'clientes'. */
  queryKey: string
  /** Busca as opções no serviço (camada services/). */
  loadOptions: (search: string) => Promise<Option[]>
  value?: Option | null
  onValueChange: (option: Option | null) => void
  placeholder?: string
  /** Mínimo de caracteres para buscar. */
  minChars?: number
  className?: string
}

/** Combobox com busca assíncrona (debounce + cache do TanStack Query). */
export function AsyncCombobox({
  queryKey,
  loadOptions,
  value,
  onValueChange,
  placeholder,
  minChars = 0,
  className,
  ...field
}: AsyncComboboxProps) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const debounced = useDebounced(search)
  const enabled = open && debounced.length >= minChars
  const query = useQuery({
    queryKey: ['combobox', queryKey, debounced],
    queryFn: () => loadOptions(debounced),
    enabled,
    staleTime: 60_000,
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          {...field}
          className={cn(
            fieldBase,
            'cursor-pointer items-center justify-between gap-2 text-left',
            className,
          )}
        >
          <span className={cn('truncate', !value && 'text-placeholder')}>
            {value?.label ?? placeholder ?? t('field.selectOne')}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-60 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={t('field.typeToSearch')}
            className="h-10"
          />
          <CommandList aria-busy={query.isFetching || undefined}>
            {debounced.length < minChars ? (
              <p className="px-3 py-6 text-center type-body text-muted-foreground">
                {t('field.minChars', { count: minChars })}
              </p>
            ) : query.isFetching && !query.data ? (
              <div className="flex items-center justify-center gap-2 py-6 type-body text-muted-foreground">
                <Spinner decorative />
                {t('common.loading')}
              </div>
            ) : query.isError ? (
              <p
                role="alert"
                className="px-3 py-6 text-center type-body text-danger-subtle-foreground"
              >
                {t('field.loadError')}
              </p>
            ) : (
              <>
                <CommandEmpty>{t('field.noOptions')}</CommandEmpty>
                <CommandGroup>
                  {query.data?.map((o) => (
                    <CommandItem
                      key={o.value}
                      value={o.value}
                      onSelect={() => {
                        onValueChange(o.value === value?.value ? null : o)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          'size-4',
                          o.value === value?.value ? 'opacity-100' : 'opacity-0',
                        )}
                        aria-hidden
                      />
                      <span className="truncate">{o.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
