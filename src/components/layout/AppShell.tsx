import { Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useHotkey } from '@/hooks/use-hotkey'
import { useUiStore } from '@/stores/ui-store'
import { AlertaEmergencias } from '@/features/viagens/AlertaEmergencias'
import { AppBreadcrumb } from './AppBreadcrumb'
import { AppSidebar, MobileNav } from './AppSidebar'
import { CommandPalette } from './CommandPalette'
import { Navbar } from './Navbar'
import { ShortcutsDialog } from './ShortcutsDialog'
import { SignOutDialog } from './SignOutDialog'

/**
 * Shell do ERP: navbar fixa, menu lateral (gaveta no celular) e área de conteúdo
 * com breadcrumb. Toda tela interna é renderizada no <Outlet />.
 */
export function AppShell() {
  const { t } = useTranslation()
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

  // Ctrl/⌘+B recolhe/expande o menu (o Firefox usa Ctrl+B para favoritos; a página intercepta).
  useHotkey({ key: 'b', mod: true }, toggleSidebar)

  return (
    <>
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 type-label text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('shell.skipToContent')}
      </a>
      <Navbar />
      <AppSidebar />
      <MobileNav />

      <main
        id="conteudo"
        tabIndex={-1}
        className={cn(
          'min-h-dvh pt-(--navbar-h) transition-[padding] duration-200 ease-standard outline-none',
          collapsed ? 'md:pl-(--sidebar-w-collapsed)' : 'md:pl-(--sidebar-w)',
        )}
      >
        <div className="mx-auto flex max-w-(--content-max-w) flex-col gap-4 px-(--page-px) py-6">
          <AppBreadcrumb />
          <AlertaEmergencias />
          <Outlet />
        </div>
      </main>

      <CommandPalette />
      <ShortcutsDialog />
      <SignOutDialog />
    </>
  )
}
