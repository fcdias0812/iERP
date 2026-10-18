import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TagProps extends React.ComponentProps<'span'> {
  /** Mostra o X; o botão tem rótulo acessível "Remover {rótulo}". */
  onRemove?: () => void
  /** Texto usado no rótulo do botão remover (padrão: o conteúdo, se for texto). */
  removeLabel?: string
  disabled?: boolean
}

/** Etiqueta/chip neutro (filtros ativos, seleção múltipla, categorias livres). Não é status. */
export function Tag({ onRemove, removeLabel, disabled, className, children, ...props }: TagProps) {
  const { t } = useTranslation()
  const label = removeLabel ?? (typeof children === 'string' ? children : '')
  return (
    <span
      data-slot="tag"
      className={cn(
        'inline-flex h-6 max-w-full items-center gap-1 rounded-sm border bg-muted pr-1 pl-2 type-caption font-medium text-foreground',
        !onRemove && 'pr-2',
        disabled && 'text-disabled-foreground',
        className,
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          className="inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground disabled:pointer-events-none"
        >
          <XIcon className="size-3" aria-hidden />
          <span className="sr-only">{t('common.removeItem', { item: label })}</span>
        </button>
      )}
    </span>
  )
}
