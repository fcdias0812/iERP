import * as React from 'react'
import { cn } from '@/lib/utils'

/*
 * Card: superfície `card`, borda decorativa, raio 8px, sombra `card`.
 * Card clicável: `<Card interactive>` (ganha hover); envolva num link/botão para o foco.
 */

function Card({
  className,
  interactive = false,
  ...props
}: React.ComponentProps<'div'> & { interactive?: boolean }) {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex flex-col rounded-lg border bg-card text-card-foreground shadow-card',
        interactive &&
          'cursor-pointer transition-colors duration-150 hover:border-border-strong hover:bg-accent',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex items-start justify-between gap-3 px-4 pt-4', className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 data-slot="card-title" className={cn('type-card-title', className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('type-caption text-muted-foreground', className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('p-4', className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center gap-2 border-t px-4 py-3', className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
