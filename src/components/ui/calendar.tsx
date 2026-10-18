import * as React from 'react'
import { DayPicker, type DayPickerProps } from 'react-day-picker'
import { enUS, ptBR, zhTW } from 'react-day-picker/locale'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIME_ZONE } from '@/lib/format'
import { buttonVariants } from './button'
import type { Language } from '@/stores/ui-store'

const LOCALES = { 'pt-BR': ptBR, en: enUS, 'zh-TW': zhTW } as const

/**
 * Calendário de seleção (react-day-picker 10), base dos campos de data.
 * Idioma do sistema e fuso America/Sao_Paulo. Dia de hoje com contorno; selecionado em azul-petróleo.
 */
export function Calendar({ className, classNames, ...props }: DayPickerProps) {
  const { i18n } = useTranslation()
  const locale = LOCALES[(i18n.language as Language) ?? 'pt-BR'] ?? ptBR

  return (
    <DayPicker
      locale={locale}
      timeZone={TIME_ZONE}
      showOutsideDays
      className={cn('p-3', className)}
      classNames={{
        root: 'relative',
        months: 'relative flex flex-col gap-4 sm:flex-row',
        month: 'flex flex-col gap-3',
        month_caption: 'flex h-control-sm items-center justify-center',
        caption_label: 'type-label capitalize',
        nav: 'absolute inset-x-0 top-0 z-10 flex items-center justify-between',
        button_previous: cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' })),
        button_next: cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' })),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 type-caption font-medium text-muted-foreground',
        week: 'mt-1 flex w-full',
        day: 'group/day relative size-9 p-0 text-center',
        day_button:
          'flex size-9 cursor-pointer items-center justify-center rounded-md type-body num transition-colors duration-150 hover:bg-accent group-data-[selected=true]/day:hover:bg-primary-hover',
        today: '[&>button]:border [&>button]:border-primary [&>button]:font-semibold',
        selected:
          '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary-hover',
        range_start: 'rounded-l-md bg-selected',
        range_end: 'rounded-r-md bg-selected',
        range_middle:
          'bg-selected [&>button]:bg-transparent! [&>button]:text-selected-foreground! [&>button]:hover:bg-accent!',
        outside: 'text-muted-foreground [&>button]:text-muted-foreground',
        disabled:
          '[&>button]:cursor-not-allowed [&>button]:text-disabled-foreground [&>button]:hover:bg-transparent',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className="size-4" aria-hidden />
          ) : (
            <ChevronRight className="size-4" aria-hidden />
          ),
      }}
      {...props}
    />
  )
}

export type { DateRange } from 'react-day-picker'
export type CalendarProps = React.ComponentProps<typeof Calendar>
