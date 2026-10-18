import * as React from 'react'
import { Progress as ProgressPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'
import type { StatusTone } from '@/lib/status/tones'

const INDICATOR: Record<StatusTone, string> = {
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  alert: 'bg-alert',
  danger: 'bg-danger',
  inactive: 'bg-inactive',
}

/**
 * Barra de progresso. `value` de 0 a 100 (sem valor = indeterminada).
 * Tom padrão `info`; use `success` só quando o fim significa sucesso.
 */
function Progress({
  className,
  value,
  tone = 'info',
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { tone?: StatusTone }) {
  const indeterminate = value == null
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          'h-full rounded-full transition-[width] duration-200 ease-standard',
          INDICATOR[tone],
          indeterminate && 'w-1/3 animate-pulse',
        )}
        style={indeterminate ? undefined : { width: `${value}%` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
