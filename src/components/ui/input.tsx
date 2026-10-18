import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Classes base de todo campo (texto, select, data…). Altura pela densidade,
 * borda `input` (3:1), erro com `aria-invalid`, somente leitura com fundo `muted`.
 */
export const fieldBase =
  'flex h-control w-full min-w-0 rounded-md border border-input bg-card px-(--control-px) type-body text-foreground transition-colors duration-150 placeholder:text-placeholder hover:border-border-strong focus-visible:border-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-disabled-foreground aria-invalid:border-danger-border read-only:bg-muted read-only:hover:border-input'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldBase,
        'file:mr-3 file:border-0 file:bg-transparent file:type-label file:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
