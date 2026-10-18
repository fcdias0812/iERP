import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EMPTY, formatDateTime, formatRelative } from '@/lib/format'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'
import { toast } from './sonner'

/* ------------------------------------------------------------ chave-valor */

export interface KeyValueItem {
  label: string
  value: React.ReactNode
  /** Ocupa a linha toda (textos longos). */
  full?: boolean
}

/** Bloco chave-valor (detalhes de um registro). Valor vazio vira "—". */
export function KeyValueList({
  items,
  columns = 2,
  className,
}: {
  items: KeyValueItem[]
  columns?: 1 | 2 | 3
  className?: string
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-x-6 gap-y-4',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={cn('min-w-0 space-y-0.5', item.full && 'sm:col-span-full')}
        >
          <dt className="type-caption text-muted-foreground">{item.label}</dt>
          <dd className="type-body break-words">
            {item.value === null || item.value === undefined || item.value === '' ? (
              <span className="text-muted-foreground">{EMPTY}</span>
            ) : (
              item.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* ------------------------------------------------------------ data relativa */

/** "há 5 minutos", com a data completa no tooltip e no `<time dateTime>`. */
export function RelativeTime({ value, className }: { value: string | Date; className?: string }) {
  const iso = value instanceof Date ? value.toISOString() : value
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time dateTime={iso} tabIndex={0} className={cn('rounded-sm', className)}>
          {formatRelative(iso)}
        </time>
      </TooltipTrigger>
      <TooltipContent>{formatDateTime(iso)}</TooltipContent>
    </Tooltip>
  )
}

/* ------------------------------------------------------------ criado / alterado */

/** "Criado por X em …" e "Alterado por Y …" (rodapé de cards e detalhes). */
export function AuditInfo({
  createdBy,
  createdAt,
  updatedBy,
  updatedAt,
  className,
}: {
  createdBy: string
  createdAt: string
  updatedBy?: string
  updatedAt?: string
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex flex-col gap-0.5 type-caption text-muted-foreground', className)}>
      <span>
        {t('meta.createdBy', { name: createdBy })} <RelativeTime value={createdAt} />
      </span>
      {updatedBy && updatedAt && (
        <span>
          {t('meta.updatedBy', { name: updatedBy })} <RelativeTime value={updatedAt} />
        </span>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ ID copiável */

/** Código/ID em fonte mono com botão copiar (e toast de confirmação). */
export function CopyableId({ value, className }: { value: string; className?: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = React.useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(t('meta.copied', { value }))
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error(t('meta.copyFailed'))
    }
  }

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="font-mono type-body num">{value}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={copy}
            aria-label={t('meta.copy', { value })}
            className="inline-flex size-6 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
          >
            {copied ? (
              <Check className="size-3.5 text-success-subtle-foreground" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{copied ? t('meta.copiedShort') : t('meta.copyShort')}</TooltipContent>
      </Tooltip>
    </span>
  )
}
