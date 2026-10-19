import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { ParseKeys } from 'i18next'
import {
  Box,
  Building2,
  CarFront,
  IdCard,
  Keyboard,
  Layers,
  LoaderCircle,
  MapPin,
  Package,
  PanelLeft,
  Recycle,
  ShieldUser,
  SunMoon,
  Truck,
  UserRound,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
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
import { usePermissoes } from '@/hooks/use-can'
import { useCurrentContext } from '@/hooks/use-can'
import { useDebounced } from '@/hooks/use-debounced'
import { isMac, useHotkey } from '@/hooks/use-hotkey'
import { textoEm } from '@/lib/localized-text'
import { buscaGlobal, sistemaKeys } from '@/services/sistema'
import type { ResultadoBusca, TipoBusca } from '@/services/types'
import { useShellStore } from '@/stores/shell-store'
import { useUiStore } from '@/stores/ui-store'

interface Screen {
  item: NavItem
  /** Módulo pai (para mostrar "Comercial › Pedidos de venda"). */
  parent?: NavItem
}

/**
 * Tipo do registro da busca global → rótulo, ícone, página que precisa poder ver e link. Busca
 * "absolutamente tudo" (pedido do usuário, 19/10/2026); o que o perfil não vê não aparece.
 */
const KINDS: Record<
  TipoBusca,
  { label: ParseKeys; icon: LucideIcon; permissao: string; rota: (r: ResultadoBusca) => string }
> = {
  cliente: {
    label: 'command.records.customer',
    icon: Building2,
    permissao: 'clientes.ver',
    rota: (r) => `/clientes/${r.id}`,
  },
  site: {
    label: 'command.records.site',
    icon: MapPin,
    permissao: 'clientes.ver',
    rota: (r) => `/clientes/${r.paiId}?aba=logistica`,
  },
  lote: {
    label: 'command.records.lot',
    icon: Package,
    permissao: 'ordens.lotes.ver',
    rota: (r) => `/ordens/lotes/${r.id}`,
  },
  caixote: {
    label: 'command.records.crate',
    icon: Box,
    permissao: 'cadastros.caixotes.ver',
    rota: (r) => `/cadastros/caixotes?aberto=${r.id}`,
  },
  pallet: {
    label: 'command.records.pallet',
    icon: Layers,
    permissao: 'cadastros.pallets.ver',
    rota: (r) => `/cadastros/pallets?aberto=${r.id}`,
  },
  transportadora: {
    label: 'command.records.carrier',
    icon: Truck,
    permissao: 'transportadoras.ver',
    rota: (r) => `/transportadoras/${r.id}`,
  },
  motorista: {
    label: 'command.records.driver',
    icon: IdCard,
    permissao: 'motoristas.ver',
    rota: (r) => `/motoristas?aberto=${r.id}`,
  },
  veiculo: {
    label: 'command.records.vehicle',
    icon: CarFront,
    permissao: 'veiculos.ver',
    rota: (r) => `/veiculos?aberto=${r.id}`,
  },
  material: {
    label: 'command.records.material',
    icon: Recycle,
    permissao: 'cadastros.materiais.ver',
    rota: (r) => `/cadastros/materiais?aberto=${r.id}`,
  },
  area: {
    label: 'command.records.area',
    icon: Warehouse,
    permissao: 'cadastros.areas.ver',
    rota: (r) => `/cadastros/areas?aberto=${r.id}`,
  },
  usuario: {
    label: 'command.records.user',
    icon: UserRound,
    permissao: 'admin.usuarios.ver',
    rota: (r) => `/admin/usuarios/${r.id}`,
  },
  perfil: {
    label: 'command.records.profile',
    icon: ShieldUser,
    permissao: 'admin.perfis.ver',
    rota: (r) => `/admin/perfis?aberto=${r.id}`,
  },
}

/** Paleta de comandos (Ctrl+K / ⌘K): telas, registros e ações. */
export function CommandPalette() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const router = useRouter()
  const idioma = useUiStore((s) => s.language)
  const ctx = useCurrentContext()
  const permissoes = usePermissoes()
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
  // Só o que o perfil pode ver. Lote: em Ordens ou, sem acesso a Ordens, em Operação.
  const podeVer = (r: ResultadoBusca) =>
    can(permissoes, KINDS[r.tipo].permissao) ||
    (r.tipo === 'lote' && can(permissoes, 'operacao.lotes.ver'))
  const rotaDe = (r: ResultadoBusca) =>
    r.tipo === 'lote' && !can(permissoes, 'ordens.lotes.ver')
      ? `/operacao/lotes/${r.id}`
      : KINDS[r.tipo].rota(r)
  const registros = termo.length >= 2 ? (busca.data ?? []).filter(podeVer) : []
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
      if (!can(permissoes, item.permission)) continue
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
  // Registro: o link pode ter parâmetros (`?aberto=`, `?aba=`) — vai direto pelo histórico.
  const abrirRegistro = (to: string) => run(() => router.history.push(to))

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
                  onSelect={() => abrirRegistro(rotaDe(r))}
                >
                  <Icon aria-hidden />
                  <span className="min-w-0 truncate">
                    <span className="text-muted-foreground">{t(kind.label)} </span>
                    {r.codigo && <span className="font-mono num">{r.codigo} · </span>}
                    <span>{r.tituloTraduzido ? textoEm(r.tituloTraduzido, idioma) : r.titulo}</span>
                    {r.detalhe && <span className="text-muted-foreground"> · {r.detalhe}</span>}
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
