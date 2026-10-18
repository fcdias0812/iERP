import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toneStyles, type StatusTone } from '@/lib/status/tones'

interface AlertProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  /** Tom pelo significado: info, success, warning, alert, danger, inactive. */
  tone?: StatusTone
  title?: React.ReactNode
  /** Ações (botões/links) à direita ou abaixo. */
  action?: React.ReactNode
  /** Mostra o X para dispensar. */
  onDismiss?: () => void
  /** `banner` = faixa de página inteira (topo do conteúdo, sem raio lateral). */
  variant?: 'inline' | 'banner'
}

/**
 * Alerta inline (dentro de um formulário/seção) ou banner de página.
 * Fundo tingido + texto e borda no tom forte + ícone do tom (cor nunca é o único sinal).
 * `danger`/`alert` são anunciados de imediato (role="alert"); os demais, com educação (status).
 */
export function Alert({
  tone = 'info',
  title,
  action,
  onDismiss,
  variant = 'inline',
  className,
  children,
  ...props
}: AlertProps) {
  const { t } = useTranslation()
  const s = toneStyles[tone]
  const Icon = s.icon
  const urgent = tone === 'danger' || tone === 'alert'

  return (
    <div
      role={urgent ? 'alert' : 'status'}
      data-slot="alert"
      data-tone={tone}
      className={cn(
        'flex items-start gap-3 border px-4 py-3',
        variant === 'inline' ? 'rounded-lg' : 'rounded-none border-x-0 sm:rounded-lg sm:border-x',
        s.subtle,
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="type-label">{title}</p>}
        {children && <div className="type-body">{children}</div>}
        {action && <div className="flex flex-wrap gap-2 pt-1">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="-m-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors duration-150 hover:bg-card"
        >
          <XIcon className="size-4" aria-hidden />
          <span className="sr-only">{t('common.dismiss')}</span>
        </button>
      )}
    </div>
  )
}
