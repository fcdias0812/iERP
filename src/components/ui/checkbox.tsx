import * as React from 'react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { CheckIcon, MinusIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Caixa de seleção (aceita `checked="indeterminate"`). */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer group/checkbox size-4 shrink-0 cursor-pointer rounded-sm border border-input bg-card text-primary-foreground transition-colors duration-150 hover:border-border-strong disabled:cursor-not-allowed disabled:bg-muted aria-invalid:border-danger-border data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center"
      >
        <CheckIcon className="size-3.5 group-data-[state=indeterminate]/checkbox:hidden" />
        <MinusIcon className="hidden size-3.5 group-data-[state=indeterminate]/checkbox:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
