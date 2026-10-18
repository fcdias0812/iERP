import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Building2, Keyboard, LoaderCircle, PanelLeft, SunMoon, UserRound } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { EXTRA_PAGES, FALLBACK_ICON, type NavItem } from '@/config/navigation'
import { can } from '@/config/permissions'
import { useCurrentContext } from '@/hooks/use-can'
import { useDebounced } from '@/hooks/use-debounced'
import { isMac, useHotkey } from '@/hooks/use-hotkey'
import { buscaGlobal, sistemaKeys } from '@/services/sistema'
import { useSessionStore } from '@/stores/session-store'
import { useShellStore } from '@/stores/shell-store'
import { useUiStore } from '@/stores/ui-store'

interface Screen {
  item: NavItem
  /** Módulo pai (para mostrar "Comercial › Pedidos de venda"). */
  parent?: NavItem
}

/** Tipo do registro da busca global → rótulo e ícone. */
const KINDS = {
  cliente: { label: 'command.records.customer', icon: Building2 },
  usuario: { label: 'command.records.user', icon: UserRound },
} as const

/** Paleta de comandos (Ctrl+K / ⌘K): telas, registros e ações. */
export function CommandPalette() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ctx = useCurrentContext()
  const role = useSessionStore((s) => s.role)
  const open = useShellStore((s) => s.commandOpen)
  const setOpen = useShellStore((s) => s.setCommandOpen)
  const setShortcutsOpen = useShellStore((s) => s.setShortcutsOpen)
  const { theme, setTheme, toggleSidebar } = useUiStore()

  const [search, setSearch] = useState('')
  const termo = useDebounced(search.trim(), 250)
  // Registros vêm da API (a partir de 2 letras); telas e ações são filtradas aqui mesmo.
  const busca = useQuery({
    queryKey: sistemaKeys.busca(termo),
    queryFn: ({ signal }) => buscaGlobal(termo, signal),
    enabled: open && termo.length >= 2,
    staleTime: 30_000,
  })
  const registros = termo.length >= 2 ? (busca.data ?? []) : []
  const buscando = search.trim().length >= 2 && (termo !== search.trim() || busca.isFetching)

  // Quando os registros chegam, o primeiro fica selecionado (Enter abre direto).
  const valorRegistro = (r: { tipo: string; id: string }) => `registro ${r.tipo} ${r.id}`
  const primeiro = registros[0] ? valorRegistro(registros[0]) : ''
  const [selected, setSelected] = useState('')
  const [ultimoPrimeiro, setUltimoPrimeiro] = useState('')
  if (primeiro !== ultimoPrimeiro) {
    setUltimoPrimeiro(primeiro)
    if (primeiro) setSelected(primeiro)
  }

  useHotkey({ key: 'k', mod: true }, () => setOpen(!useShellStore.getState().commandOpen))

  const screens: Screen[] = []
  const collect = (items: NavItem[], parent?: NavItem) => {
    for (const item of items) {
      if (!can(role, item.permission)) continue
      if (item.children) collect(item.children, item)
      else if (item.to) screens.push({ item, parent })
    }
  }
  ctx.sections.forEach((s) => collect(s.items))
  collect(EXTRA_PAGES)

  const changeOpen = (o: boolean) => {
    setOpen(o)
    if (!o) setSearch('')
  }
  const run = (fn: () => void) => {
    changeOpen(false)
    fn()
  }
  const go = (to: string) =>
    run(() => void navigate({ to: '/$', params: { _splat: to.replace(/^\//, '') } }))

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const mod = isMac() ? '⌘' : 'Ctrl'

  return (
    <CommandDialog
      open={open}
      onOpenChange={changeOpen}
      commandProps={{ value: selected, onValueChange: setSelected }}
      title={t('command.title')}
      description={t('command.description')}
    >
      <CommandInput
        placeholder={t('command.placeholder')}
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {!registros.length && !buscando && <CommandEmpty>{t('command.empty')}</CommandEmpty>}

        {(registros.length > 0 || buscando || busca.isError) && search.trim().length >= 2 && (
          <CommandGroup heading={t('command.groups.records')} forceMount>
            {buscando && !registros.length && (
              <p
                className="flex items-center gap-2 px-2 py-1.5 type-body text-muted-foreground"
                role="status"
              >
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                {t('command.searching')}
              </p>
            )}
            {busca.isError && !buscando && (
              <p className="px-2 py-1.5 type-body text-muted-foreground" role="status">
                {t('command.searchFailed')}
              </p>
            )}
            {registros.map((r) => {
              const kind = KINDS[r.tipo]
              const Icon = kind.icon
              return (
                <CommandItem
                  key={`${r.tipo}-${r.id}`}
                  value={valorRegistro(r)}
                  forceMount
                  onSelect={() => go(r.rota)}
                >
                  <Icon aria-hidden />
                  <span className="min-w-0 truncate">
                    <span className="text-muted-foreground">{t(kind.label)} </span>
                    <span className="font-mono num">{r.codigo}</span>
                    <span className="text-muted-foreground"> · {r.titulo}</span>
                  </span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        <CommandGroup heading={t('command.groups.screens')}>
          {screens.map(({ item, parent }) => {
            const Icon = parent?.icon ?? item.icon ?? FALLBACK_ICON
            const label = t(item.labelKey)
            const parentLabel = parent ? t(parent.labelKey) : undefined
            return (
              <CommandItem
                key={item.id}
                value={`${item.id} ${parentLabel ?? ''} ${label}`}
                keywords={item.keywords}
                onSelect={() => go(item.to!)}
              >
                <Icon aria-hidden />
                <span className="truncate">
                  {parentLabel && <span className="text-muted-foreground">{parentLabel} › </span>}
                  {label}
                </span>
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading={t('command.groups.actions')}>
          <CommandItem
            value={isDark ? t('command.actions.lightTheme') : t('command.actions.darkTheme')}
            keywords={[t('preferences.theme')]}
            onSelect={() => run(() => setTheme(isDark ? 'light' : 'dark'))}
          >
            <SunMoon aria-hidden />
            {isDark ? t('command.actions.lightTheme') : t('command.actions.darkTheme')}
          </CommandItem>
          <CommandItem
            value={t('shortcuts.items.toggleSidebar')}
            onSelect={() => run(toggleSidebar)}
          >
            <PanelLeft aria-hidden />
            {t('shortcuts.items.toggleSidebar')}
            <CommandShortcut>{mod}+B</CommandShortcut>
          </CommandItem>
          <CommandItem
            value={t('shortcuts.title')}
            onSelect={() => run(() => setShortcutsOpen(true))}
          >
            <Keyboard aria-hidden />
            {t('shortcuts.title')}
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
          <CommandItem value={t('nav.perfil')} onSelect={() => go('/perfil')}>
            <UserRound aria-hidden />
            {t('nav.perfil')}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
