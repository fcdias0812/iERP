import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useShellStore } from '@/stores/shell-store'
import { useUiStore } from '@/stores/ui-store'
import { BrandLogo } from './BrandLogo'
import { ContextSwitcher } from './ContextSwitcher'
import { SidebarNav } from './SidebarNav'

/**
 * Menu lateral fixo (a partir de md). Expandido = ícone + nome; recolhido = só ícone.
 * Fundo verde-escuro da marca nos dois temas: `dark surface-sidebar` (ver theme.css).
 */
export function AppSidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'dark surface-sidebar fixed top-(--navbar-h) bottom-0 left-0 z-30 hidden flex-col border-r bg-card text-foreground transition-[width] duration-200 ease-standard md:flex',
        collapsed ? 'w-(--sidebar-w-collapsed)' : 'w-(--sidebar-w)',
      )}
    >
      <ScrollArea className="min-h-0 flex-1">
        <SidebarNav collapsed={collapsed} />
      </ScrollArea>
      <div className="border-t p-2">
        <ContextSwitcher collapsed={collapsed} />
      </div>
    </aside>
  )
}

/** Gaveta do celular: o mesmo menu, aberto pelo botão da navbar. */
export function MobileNav() {
  const { t } = useTranslation()
  const open = useShellStore((s) => s.mobileNavOpen)
  const setOpen = useShellStore((s) => s.setMobileNavOpen)
  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        className="dark surface-sidebar w-72 gap-0 bg-card p-0 text-foreground sm:max-w-72"
      >
        <SheetHeader className="border-b p-3 pr-12">
          <SheetTitle className="sr-only">{t('shell.mainMenu')}</SheetTitle>
          <SheetDescription className="sr-only">{t('shell.mainMenuDescription')}</SheetDescription>
          <BrandLogo variant="full" className="h-7" />
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <SidebarNav onNavigate={close} />
        </ScrollArea>
        <div className="border-t p-2">
          <ContextSwitcher onSwitch={close} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
