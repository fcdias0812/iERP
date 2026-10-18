import { useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FALLBACK_ICON, type NavItem, type NavSection } from '@/config/navigation'
import { can, type Role } from '@/config/permissions'
import { useCurrentContext } from '@/hooks/use-can'
import { useSessionStore } from '@/stores/session-store'
import { AppLink } from './AppLink'

/** Filtra itens pela permissão do papel; módulo sem filhos visíveis some. */
function visibleItems(items: NavItem[], role: Role): NavItem[] {
  return items.flatMap((item) => {
    if (!can(role, item.permission)) return []
    if (!item.children) return [item]
    const children = visibleItems(item.children, role)
    return children.length ? [{ ...item, children }] : []
  })
}

function containsPath(item: NavItem, pathname: string): boolean {
  return item.to === pathname || Boolean(item.children?.some((c) => containsPath(c, pathname)))
}

function sumBadges(item: NavItem): number {
  return (item.badge ?? 0) + (item.children ?? []).reduce((acc, c) => acc + sumBadges(c), 0)
}

interface SidebarNavProps {
  collapsed?: boolean
  /** Chamado ao navegar (fecha a gaveta no celular). */
  onNavigate?: () => void
}

/** Lista de seções e módulos do contexto atual. Usada no menu lateral e na gaveta do celular. */
export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const { t } = useTranslation()
  const ctx = useCurrentContext()
  const role = useSessionStore((s) => s.role)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const sections: NavSection[] = ctx.sections
    .map((s) => ({ ...s, items: visibleItems(s.items, role) }))
    .filter((s) => s.items.length > 0)

  return (
    <nav
      aria-label={t('shell.mainMenu')}
      className={cn('flex flex-col py-3', collapsed && 'gap-1')}
    >
      {sections.map((section, i) => (
        <div key={section.id} className={cn(!collapsed && 'mb-3')}>
          {collapsed ? (
            i > 0 && <div className="mx-3 my-2 h-px bg-border" aria-hidden />
          ) : (
            <p className="truncate px-5 pt-1 pb-1.5 type-overline text-muted-foreground">
              {t(section.labelKey)}
            </p>
          )}
          <ul className={cn('flex flex-col gap-0.5', collapsed ? 'items-center px-2' : 'px-3')}>
            {section.items.map((item) => (
              <li key={item.id} className={cn(collapsed && 'w-full')}>
                {collapsed ? (
                  <CollapsedItem item={item} pathname={pathname} onNavigate={onNavigate} />
                ) : (
                  <ExpandedItem item={item} pathname={pathname} onNavigate={onNavigate} />
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

// ---------------------------------------------------------------- expandido

const rowBase =
  'relative flex h-control-sm w-full cursor-pointer items-center gap-2.5 rounded-md px-2 type-body transition-colors duration-150'
const rowIdle = 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
const rowActive =
  'bg-selected font-medium text-selected-foreground before:absolute before:inset-y-1.5 before:-left-1 before:w-0.5 before:rounded-full before:bg-primary'

function ItemBadge({ count, label }: { count?: number; label: string }) {
  const { t } = useTranslation()
  if (!count) return null
  return (
    <Badge className="ml-auto" aria-label={t('shell.pendingCount', { count, label })}>
      {count}
    </Badge>
  )
}

function ExpandedItem({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  onNavigate?: () => void
}) {
  const { t } = useTranslation()
  const Icon = item.icon ?? FALLBACK_ICON
  const label = t(item.labelKey)
  const activeBranch = containsPath(item, pathname)
  const [open, setOpen] = useState(activeBranch)
  // Ao navegar para uma tela deste módulo (ex.: pela busca), o submenu abre sozinho.
  const [prevActive, setPrevActive] = useState(activeBranch)
  if (activeBranch !== prevActive) {
    setPrevActive(activeBranch)
    if (activeBranch) setOpen(true)
  }

  if (!item.children) {
    const active = item.to === pathname
    return (
      <AppLink
        to={item.to ?? '/'}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={cn(rowBase, active ? rowActive : rowIdle)}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
        <ItemBadge count={item.badge} label={label} />
      </AppLink>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(rowBase, rowIdle, activeBranch && 'font-medium text-foreground')}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
        {/* Submenu fechado: mostra o total de pendências das telas dentro dele. */}
        {!open && <ItemBadge count={sumBadges(item)} label={label} />}
        <ChevronRight
          className={cn(
            'size-4 shrink-0 transition-transform duration-150',
            (open || !sumBadges(item)) && 'ml-auto',
            open && 'rotate-90',
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-0.5 ml-[1.0625rem] flex flex-col gap-0.5 border-l pl-2">
          {item.children.map((child) => {
            const active = child.to === pathname
            const childLabel = t(child.labelKey)
            return (
              <li key={child.id}>
                <AppLink
                  to={child.to ?? '/'}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(rowBase, 'gap-2', active ? rowActive : rowIdle)}
                >
                  <span className="truncate">{childLabel}</span>
                  <ItemBadge count={child.badge} label={childLabel} />
                </AppLink>
              </li>
            )
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ---------------------------------------------------------------- recolhido

const iconBase =
  'relative mx-auto flex size-(--control-h) cursor-pointer items-center justify-center rounded-md transition-colors duration-150'

function CollapsedItem({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  onNavigate?: () => void
}) {
  const { t } = useTranslation()
  const Icon = item.icon ?? FALLBACK_ICON
  const label = t(item.labelKey)
  const activeBranch = containsPath(item, pathname)
  const pending = sumBadges(item)
  const dot = pending > 0 && (
    <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" aria-hidden />
  )
  const a11yLabel = pending ? t('shell.pendingCount', { count: pending, label }) : label

  if (!item.children) {
    const active = item.to === pathname
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <AppLink
            to={item.to ?? '/'}
            onClick={onNavigate}
            aria-label={a11yLabel}
            aria-current={active ? 'page' : undefined}
            className={cn(iconBase, active ? 'bg-selected text-selected-foreground' : rowIdle)}
          >
            <Icon className="size-4" aria-hidden />
            {dot}
          </AppLink>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  // Módulo com submenu: o ícone abre um menu flutuante com as telas.
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            aria-label={a11yLabel}
            className={cn(
              iconBase,
              activeBranch ? 'bg-selected text-selected-foreground' : rowIdle,
              'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {dot}
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="right" align="start" className="w-56">
        <DropdownMenuLabel className="text-muted-foreground">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {item.children.map((child) => {
          const active = child.to === pathname
          return (
            <DropdownMenuItem
              key={child.id}
              asChild
              className={cn(active && 'bg-selected font-medium text-selected-foreground')}
            >
              <AppLink
                to={child.to ?? '/'}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
              >
                <span className="truncate">{t(child.labelKey)}</span>
                {child.badge ? (
                  <Badge className="ml-auto" aria-hidden>
                    {child.badge}
                  </Badge>
                ) : null}
              </AppLink>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
