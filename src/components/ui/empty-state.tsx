import * as React from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  description?: string
  /** Ação principal (ex.: "Novo pedido") ou "Limpar filtros". */
  action?: React.ReactNode
  /** Ícone no lugar da ilustração (estados secundários: sem resultado, sem permissão). */
  icon?: React.ReactNode
  /** `sm` para dentro de cards e tabelas. */
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Estado vazio: ilustração própria + título + descrição + ação.
 * A ilustração é um dos poucos lugares onde as cores da marca aparecem
 * (tokens `--illustration-*`).
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  size = 'md',
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center text-center',
        size === 'md' ? 'gap-3 px-6 py-12' : 'gap-2 px-4 py-8',
        className,
      )}
    >
      {icon ? (
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6">
          {icon}
        </span>
      ) : (
        <EmptyIllustration className={size === 'md' ? 'h-28' : 'h-20'} />
      )}
      <h3 className={size === 'md' ? 'type-section-title' : 'type-card-title'}>{title}</h3>
      {description && <p className="max-w-md type-body text-muted-foreground">{description}</p>}
      {action && <div className="flex flex-wrap justify-center gap-2 pt-1">{action}</div>}
    </div>
  )
}

/** Caixa aberta com a órbita do globo da marca. Decorativa. */
export function EmptyIllustration({ className }: { className?: string }) {
  const id = React.useId()
  return (
    <svg viewBox="0 0 200 140" className={cn('w-auto', className)} aria-hidden focusable="false">
      <defs>
        <linearGradient id={`${id}-orbit`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--illustration-4)" />
          <stop offset="0.3" stopColor="var(--illustration-3)" />
          <stop offset="0.65" stopColor="var(--illustration-2)" />
          <stop offset="1" stopColor="var(--illustration-1)" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="122" rx="62" ry="8" fill="var(--illustration-surface)" />
      {/* caixa */}
      <path
        d="M52 62 L100 78 L148 62 L148 112 L100 128 L52 112 Z"
        fill="var(--illustration-surface)"
        stroke="var(--illustration-line)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M100 78 L100 128" stroke="var(--illustration-line)" strokeWidth="2" />
      <path
        d="M52 62 L36 80 L84 96 L100 78 Z"
        fill="var(--illustration-surface)"
        stroke="var(--illustration-line)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M148 62 L164 80 L116 96 L100 78 Z"
        fill="var(--illustration-surface)"
        stroke="var(--illustration-line)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* órbita da marca */}
      <path
        d="M40 48 C 70 10, 140 6, 166 34"
        fill="none"
        stroke={`url(#${id}-orbit)`}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="166" cy="34" r="6" fill="var(--illustration-1)" />
      <circle cx="40" cy="48" r="4" fill="var(--illustration-4)" />
    </svg>
  )
}
