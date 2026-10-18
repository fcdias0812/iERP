import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toneStyles, type StatusTone } from '@/lib/status/tones'
import { Avatar, AvatarFallback } from './avatar'
import { RelativeTime } from './metadata'
import { initials } from '@/stores/session-store'

export interface AuditChange {
  field: string
  before?: React.ReactNode
  after?: React.ReactNode
}

export interface TimelineEvent {
  id: string
  /** Quem fez. */
  actor: string
  /** Quando (ISO). */
  at: string
  /** O quê (frase curta, já traduzida). */
  action: string
  /** Tom do marcador (opcional): sucesso, alerta… */
  tone?: StatusTone
  icon?: React.ComponentType<{ className?: string }>
  /** Antes → depois, por campo. */
  changes?: AuditChange[]
  /** Comentário livre. */
  note?: string
}

/** Linha do tempo de auditoria: quem, quando, o quê e antes → depois. Mais recente primeiro. */
export function Timeline({ events, className }: { events: TimelineEvent[]; className?: string }) {
  const { t } = useTranslation()
  return (
    <ol className={cn('relative flex flex-col', className)}>
      {events.map((ev, i) => {
        const Icon = ev.icon ?? (ev.tone ? toneStyles[ev.tone].icon : undefined)
        return (
          <li key={ev.id} className="relative flex gap-3 pb-6 last:pb-0">
            {i < events.length - 1 && (
              <span aria-hidden className="absolute top-8 bottom-0 left-3.5 w-px bg-border" />
            )}
            {Icon ? (
              <span
                className={cn(
                  'relative flex size-7 shrink-0 items-center justify-center rounded-full border',
                  ev.tone ? toneStyles[ev.tone].subtle : 'bg-muted text-muted-foreground',
                )}
              >
                <Icon className="size-3.5" aria-hidden />
              </span>
            ) : (
              <Avatar size="sm" className="mt-0.5 size-7">
                <AvatarFallback className="text-12">{initials(ev.actor)}</AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
              <p className="type-body">
                <span className="font-medium">{ev.actor}</span>{' '}
                <span className="text-muted-foreground">{ev.action}</span>
                <span className="text-muted-foreground"> · </span>
                <RelativeTime value={ev.at} className="type-caption text-muted-foreground" />
              </p>
              {ev.changes && ev.changes.length > 0 && (
                <dl className="flex flex-col gap-1 rounded-md border bg-muted px-3 py-2 type-caption">
                  {ev.changes.map((c) => (
                    <div key={c.field} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <dt className="font-medium text-foreground">{c.field}:</dt>
                      <dd className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground line-through">
                          <span className="sr-only">{t('timeline.before')} </span>
                          {c.before ?? '—'}
                        </span>
                        <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
                        <span className="text-foreground">
                          <span className="sr-only">{t('timeline.after')} </span>
                          {c.after ?? '—'}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {ev.note && <p className="type-body text-muted-foreground">“{ev.note}”</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
