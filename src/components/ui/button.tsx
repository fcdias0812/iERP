import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/utils'
import { Spinner } from './spinner'

/*
 * Botão do design system. Regra das cores:
 *  - default (primário) = azul-petróleo — a ação principal da tela;
 *  - secondary/outline  = neutro com contorno;
 *  - ghost              = sem fundo (barras de ferramentas, menus);
 *  - destructive        = vermelho — excluir, ação irreversível;
 *  - success            = verde — SÓ quando confirma um sucesso (Aprovar, Concluir);
 *  - link               = texto de link.
 * Altura segue a densidade (h-control*). Foco: contorno global (:focus-visible).
 * `loading` mostra o spinner, marca `aria-busy` e bloqueia o clique.
 * Botão só com ícone (`size="icon*"`) PRECISA de `aria-label`.
 * Grupo e split: src/components/ui/button-group.tsx.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md type-body font-medium whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-danger-border [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary:
          'border border-border-strong bg-secondary text-secondary-foreground hover:bg-secondary-hover',
        outline:
          'border border-border-strong bg-secondary text-secondary-foreground hover:bg-secondary-hover',
        ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive-hover',
        success: 'bg-success text-success-foreground hover:bg-success-hover',
        link: 'text-link underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-control px-(--control-px)',
        sm: 'h-control-sm gap-1.5 px-2.5',
        lg: 'h-control-lg px-4',
        icon: 'size-(--control-h)',
        'icon-sm': 'size-(--control-h-sm)',
        'icon-lg': 'size-(--control-h-lg)',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  loading = false,
  disabled,
  type,
  children,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      // Padrão "button" (não "submit") para não enviar formulário por engano.
      type={asChild ? type : (type ?? 'button')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }), loading && 'cursor-wait')}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Spinner decorative className="text-16" />}
          {children}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
