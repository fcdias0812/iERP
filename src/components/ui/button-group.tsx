import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './dropdown-menu'

/** Botões colados (ações irmãs: Dia/Semana/Mês, Anterior/Próximo). */
export function ButtonGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="group"
      data-slot="button-group"
      className={cn(
        'inline-flex w-fit items-stretch [&>*]:rounded-none [&>*:first-child]:rounded-l-md [&>*:focus-visible]:z-10 [&>*:last-child]:rounded-r-md [&>*:not(:first-child)]:-ml-px',
        className,
      )}
      {...props}
    />
  )
}

interface SplitButtonProps {
  /** Ação principal (clique no corpo do botão). */
  children: React.ReactNode
  onClick?: () => void
  /** Itens do menu (`DropdownMenuItem`). */
  menu: React.ReactNode
  variant?: 'default' | 'secondary'
  disabled?: boolean
  /** Rótulo acessível do botão da seta. Padrão: "Mais opções". */
  menuLabel?: string
}

/** Botão com menu (split): a ação mais comum no corpo, as variações na seta. */
export function SplitButton({
  children,
  onClick,
  menu,
  variant = 'default',
  disabled,
  menuLabel,
}: SplitButtonProps) {
  const { t } = useTranslation()
  return (
    <ButtonGroup>
      <Button variant={variant} onClick={onClick} disabled={disabled}>
        {children}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size="icon"
            disabled={disabled}
            aria-label={menuLabel ?? t('common.moreOptions')}
            className={cn(variant === 'default' && 'border-l border-l-primary-hover')}
          >
            <ChevronDownIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">{menu}</DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  )
}
