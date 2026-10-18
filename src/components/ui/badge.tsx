import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/utils'

/*
 * Selo genérico / contador. Status de negócio usam o StatusBadge (fase 3),
 * que sai do statusMap. Aqui:
 *  - default = neutro (contadores de pendência no menu);
 *  - info    = azul-petróleo (novidade, informação);
 *  - solid   = azul-petróleo sólido (contador do sino);
 *  - danger  = vermelho, só quando o número é de ERRO;
 *  - outline = contorno neutro.
 */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-1.5 py-0.5 type-caption font-medium whitespace-nowrap num [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-inactive-subtle text-inactive-subtle-foreground',
        info: 'bg-info-subtle text-info-subtle-foreground',
        solid: 'bg-primary text-primary-foreground',
        danger: 'bg-danger text-danger-foreground',
        outline: 'border-border-strong text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
