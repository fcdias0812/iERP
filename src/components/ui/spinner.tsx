import { useTranslation } from 'react-i18next'
import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpinnerProps {
  className?: string
  /** Texto para leitores de tela. Padrão: "Carregando…". Use `decorative` dentro de botões. */
  label?: string
  decorative?: boolean
}

/** Indicador de carregamento (gira; para com prefers-reduced-motion). */
export function Spinner({ className, label, decorative = false }: SpinnerProps) {
  const { t } = useTranslation()
  return (
    <span
      role={decorative ? undefined : 'status'}
      className={cn('inline-flex items-center justify-center', className)}
    >
      <LoaderCircle className="size-[1em] animate-spin" aria-hidden />
      {!decorative && <span className="sr-only">{label ?? t('common.loading')}</span>}
    </span>
  )
}
