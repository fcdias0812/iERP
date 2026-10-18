import * as React from 'react'
import { cn } from '@/lib/utils'

/** Bloco de "esqueleto" enquanto o conteúdo carrega. Decorativo: anuncie o carregamento à parte. */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}

export { Skeleton }
