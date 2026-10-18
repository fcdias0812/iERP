import * as React from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

/** Abas (setas do teclado navegam; aria correto pelo Radix). Aba ativa = sublinhado azul-petróleo. */

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-4', className)}
      {...props}
    />
  )
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'flex w-full items-center gap-1 overflow-x-auto border-b text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative -mb-px inline-flex h-control shrink-0 cursor-pointer items-center justify-center gap-1.5 border-b-2 border-transparent px-3 type-label whitespace-nowrap transition-colors duration-150 hover:text-foreground disabled:pointer-events-none disabled:text-disabled-foreground data-[state=active]:border-primary data-[state=active]:text-foreground [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
