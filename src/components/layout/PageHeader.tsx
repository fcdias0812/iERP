import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  /** Descrição curta (uma linha). */
  description?: string
  /** Selo de status (telas de detalhe). */
  status?: ReactNode
  /** Ações principais, à direita (a principal por último, em `variant="default"`). */
  actions?: ReactNode
  /** Conteúdo extra abaixo da descrição. */
  children?: ReactNode
  className?: string
}

/** Cabeçalho padrão de toda página: título, descrição, status e ações. */
export function PageHeader({
  title,
  description,
  status,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="type-page-title break-words">{title}</h1>
            {status}
          </div>
          {description && (
            <p className="max-w-3xl type-body text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  )
}
