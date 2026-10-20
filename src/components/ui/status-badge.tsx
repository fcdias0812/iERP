import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { STATUS_MAP, type StatusId } from '@/lib/status/statusMap'
import { toneStyles } from '@/lib/status/tones'

interface StatusBadgeProps {
  status: StatusId
  /** `subtle` (padrão, tingido) ou `solid` (destaque forte, use pouco). */
  variant?: 'subtle' | 'solid'
  size?: 'sm' | 'md'
  className?: string
  /** Texto no lugar do rótulo padrão (cor e ícone continuam os do status). */
  label?: string
}

/** Selo de status de negócio. Cor, ícone e rótulo vêm SEMPRE do statusMap. */
export function StatusBadge({
  status,
  variant = 'subtle',
  size = 'md',
  className,
  label,
}: StatusBadgeProps) {
  const { t } = useTranslation()
  const def = STATUS_MAP[status]
  const s = toneStyles[def.tone]
  const Icon = def.icon

  return (
    <span
      data-slot="status-badge"
      data-status={status}
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1 rounded-sm border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-px type-caption' : 'px-2 py-0.5 type-caption',
        variant === 'subtle' ? s.subtle : cn(s.solid, 'border-transparent'),
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} aria-hidden />
      {label ?? t(`status.${status}`)}
    </span>
  )
}
