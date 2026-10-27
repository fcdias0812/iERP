import { useTranslation } from 'react-i18next'
import { Menu, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { isMac } from '@/hooks/use-hotkey'
import { useShellStore } from '@/stores/shell-store'
import { useUiStore } from '@/stores/ui-store'
import { AppLink } from './AppLink'
import { BrandLogo } from './BrandLogo'
import { HelpMenu } from './HelpMenu'
import { NotificationsPopover } from './NotificationsPopover'
import { NovidadesButton } from './NovidadesButton'
import { UserMenu } from './UserMenu'

/** Barra superior fixa: menu, logo, busca (Ctrl+K), notificações, ajuda e usuário. */
export function Navbar() {
  const { t } = useTranslation()
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const setMobileNavOpen = useShellStore((s) => s.setMobileNavOpen)
  const setCommandOpen = useShellStore((s) => s.setCommandOpen)
  const mod = isMac() ? '⌘' : 'Ctrl'
  const toggleLabel = collapsed ? t('shell.expandMenu') : t('shell.collapseMenu')

  return (
    // Translúcida com desfoque: o conteúdo passa por baixo (pedido do usuário, 22/10/2026 —
    // "mais transparente e tenha um blur"). Sem suporte a desfoque, fica sólida.
    <header className="fixed inset-x-0 top-0 z-40 h-(--navbar-h) bg-card backdrop-blur-md backdrop-saturate-150 supports-[backdrop-filter]:bg-card/70">
      <div className="flex h-full items-center gap-1 px-2 pb-0.5 sm:gap-3 sm:px-3">
        {/* Celular: abre a gaveta. Desktop: recolhe/expande o menu lateral. */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={t('shell.openMenu')}
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu aria-hidden />
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              aria-label={toggleLabel}
              aria-expanded={!collapsed}
              onClick={toggleSidebar}
            >
              {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {toggleLabel} ({mod}+B)
          </TooltipContent>
        </Tooltip>

        <AppLink
          to="/"
          aria-label={t('shell.home')}
          className="flex shrink-0 items-center rounded-md"
        >
          <BrandLogo variant="responsive" className="h-7 sm:h-8" />
        </AppLink>
        {/* Nome do sistema (chave `app.name`): cada sistema feito com o template troca só ela. */}
        <span className="min-w-0 truncate border-l border-border-strong pl-2 type-label text-foreground sm:pl-3 sm:type-card-title">
          {t('app.name')}
        </span>

        <div className="hidden min-w-0 flex-1 justify-center px-2 sm:flex">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            aria-keyshortcuts={isMac() ? 'Meta+K' : 'Control+K'}
            className="hidden h-control w-full max-w-md cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-left type-body text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:bg-accent sm:flex"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{t('command.placeholder')}</span>
            <KbdGroup className="ml-auto hidden md:inline-flex">
              <Kbd>{mod}</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </button>
        </div>

        <div className="ml-auto flex items-center gap-0.5 sm:ml-0 sm:gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            aria-label={t('command.open')}
            onClick={() => setCommandOpen(true)}
          >
            <Search aria-hidden />
          </Button>
          <NotificationsPopover />
          <NovidadesButton />
          <HelpMenu />
          <UserMenu />
        </div>
      </div>
      {/* Linha fina com o degradê da marca (um dos poucos lugares onde ele aparece). */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-gradient" aria-hidden />
    </header>
  )
}
