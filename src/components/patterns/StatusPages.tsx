import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { BrandLogo } from '@/components/layout/BrandLogo'

/**
 * Molde das telas FORA do shell (login, acesso pendente, manutenção, erro 500):
 * logo completa centralizada + detalhe discreto do degradê da marca.
 */
export function AuthLayout({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      {/* Detalhe da marca: faixa fina no topo (um dos poucos lugares onde o degradê aparece). */}
      <div className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" aria-hidden />
      <main className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandLogo variant="login" className="h-14" />
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-modal sm:p-8">{children}</div>
        <p className="mt-6 text-center type-caption text-muted-foreground">
          {footer ?? t('auth.footer', { year: new Date().getFullYear() })}
        </p>
      </main>
    </div>
  )
}

interface StatusPageProps {
  /** Código grande (403, 404, 500) ou ícone. */
  code?: string
  icon?: ReactNode
  title: string
  description: string
  actions?: ReactNode
  /** Detalhe técnico (ex.: mensagem do erro), recolhido. */
  details?: string
  className?: string
}

/** Conteúdo padrão de 403, 404, 500, acesso pendente e manutenção. */
export function StatusPage({
  code,
  icon,
  title,
  description,
  actions,
  details,
  className,
}: StatusPageProps) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex flex-col items-center gap-3 text-center', className)}>
      {icon && (
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6">
          {icon}
        </span>
      )}
      {code && <p className="type-display text-muted-foreground num">{code}</p>}
      <h1 className="type-page-title">{title}</h1>
      <p className="max-w-md type-body text-muted-foreground">{description}</p>
      {actions && <div className="flex flex-wrap justify-center gap-2 pt-2">{actions}</div>}
      {details && (
        <details className="mt-2 w-full max-w-md text-left">
          <summary className="cursor-pointer type-caption text-muted-foreground">
            {t('errors.technical')}
          </summary>
          <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 type-caption whitespace-pre-wrap">
            {details}
          </pre>
        </details>
      )}
    </div>
  )
}
