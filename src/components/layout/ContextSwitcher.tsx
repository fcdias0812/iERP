import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Building, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CONTEXTS } from '@/config/navigation'
import { useCurrentContext } from '@/hooks/use-can'
import { useSessionStore } from '@/stores/session-store'

interface ContextSwitcherProps {
  collapsed?: boolean
  onSwitch?: () => void
}

/**
 * Seletor de contexto (cliente/unidade/empresa), no canto inferior esquerdo.
 * Trocar o contexto troca o conjunto de menus e volta ao Início.
 * Com um contexto só, não aparece.
 */
export function ContextSwitcher({ collapsed = false, onSwitch }: ContextSwitcherProps) {
  const { t } = useTranslation()
  const ctx = useCurrentContext()
  const setContext = useSessionStore((s) => s.setContext)
  const navigate = useNavigate()

  if (CONTEXTS.length <= 1) return null

  const change = (id: string) => {
    if (id === ctx.id) return
    setContext(id)
    onSwitch?.()
    void navigate({ to: '/' })
  }

  const triggerLabel = t('context.current', {
    kind: t(`context.kinds.${ctx.kind}`),
    name: ctx.name,
  })

  const trigger = (
    <DropdownMenuTrigger
      // Recolhido não há texto visível: o rótulo vem do aria-label. Aberto, do próprio texto
      // (+ "trocar contexto" para leitor de tela) — o nome contém o que se vê (WCAG 2.5.3).
      aria-label={collapsed ? triggerLabel : undefined}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2.5 rounded-md text-left transition-colors duration-150 hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent',
        collapsed ? 'mx-auto size-(--control-h) justify-center' : 'p-2',
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
        <Building className="size-4" aria-hidden />
      </span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate type-label text-foreground">{ctx.name}</span>
            <span className="block truncate type-caption text-muted-foreground">
              {t(`context.kinds.${ctx.kind}`)}
            </span>
          </span>
          <span className="sr-only">— {t('context.switch')}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </>
      )}
    </DropdownMenuTrigger>
  )

  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="right">{ctx.name}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <DropdownMenuContent side={collapsed ? 'right' : 'top'} align="start" className="w-72">
        <DropdownMenuLabel className="text-muted-foreground">
          {t('context.switch')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={ctx.id} onValueChange={change}>
          {CONTEXTS.map((c) => (
            <DropdownMenuRadioItem key={c.id} value={c.id} className="items-start">
              <span className="min-w-0">
                <span className="block truncate">{c.name}</span>
                <span className="block type-caption text-muted-foreground">
                  {t(`context.kinds.${c.kind}`)} ·{' '}
                  <span className="font-mono num">{c.document}</span>
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
