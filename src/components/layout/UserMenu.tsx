import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  Keyboard,
  Languages,
  LogOut,
  Rows3,
  Settings,
  ShieldUser,
  SunMoon,
  UserRound,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useNomePerfil, usePerfis } from '@/hooks/use-can'
import { textoEm } from '@/lib/localized-text'
import { initials, useSessionStore } from '@/stores/session-store'
import { useShellStore } from '@/stores/shell-store'
import { useUiStore, type Density, type Language, type ThemePreference } from '@/stores/ui-store'
import { AppLink } from './AppLink'

const LANGUAGES: Language[] = ['pt-BR', 'en', 'zh-TW']
const THEMES: ThemePreference[] = ['light', 'dark', 'system']
const DENSITIES: Density[] = ['comfortable', 'compact']

const THEME_KEYS = {
  light: 'preferences.themeLight',
  dark: 'preferences.themeDark',
  system: 'preferences.themeSystem',
} as const
const DENSITY_KEYS = {
  comfortable: 'preferences.densityComfortable',
  compact: 'preferences.densityCompact',
} as const

/** Usuário na navbar: avatar, nome e cargo, com o menu de preferências. */
export function UserMenu() {
  const { t } = useTranslation()
  const { user, perfilId, setPerfil } = useSessionStore()
  const nomePerfil = useNomePerfil()
  const perfis = usePerfis()
  const idiomaTela = useUiStore((s) => s.language)
  const { theme, density, language, setTheme, setDensity, setLanguage } = useUiStore()
  const setShortcutsOpen = useShellStore((s) => s.setShortcutsOpen)
  const setSignOutOpen = useShellStore((s) => s.setSignOutOpen)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-control cursor-pointer items-center gap-2 rounded-md px-1 transition-colors duration-150 hover:bg-accent data-[state=open]:bg-accent lg:px-2">
        {/* Nome acessível = "Menu do usuário" + o texto visível (WCAG 2.5.3, rótulo no nome). */}
        <span className="sr-only">{t('user.menuPrefix')}</span>
        <Avatar aria-hidden>
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
        <span className="sr-only lg:hidden">{user.name}</span>
        <span className="hidden max-w-40 min-w-0 text-left lg:block">
          <span className="block truncate type-label text-foreground">{user.name}</span>
          <span className="block truncate type-caption text-muted-foreground">{user.jobTitle}</span>
        </span>
        <ChevronDown className="hidden size-4 text-muted-foreground lg:block" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-3 py-2 font-normal">
          <Avatar size="lg">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate type-label text-foreground">{user.name}</span>
            <span className="block truncate type-caption text-muted-foreground">{user.email}</span>
            <span className="block truncate type-caption text-muted-foreground">
              {user.jobTitle}
            </span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <AppLink to="/perfil">
              <UserRound aria-hidden />
              {t('nav.perfil')}
            </AppLink>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <AppLink to="/configuracoes">
              <Settings aria-hidden />
              {t('nav.configuracoes')}
            </AppLink>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Languages aria-hidden />
              <span>{t('preferences.language')}</span>
              <span className="ml-auto type-caption text-muted-foreground">
                {t(`languages.${language}`)}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={language}
                onValueChange={(v) => setLanguage(v as Language)}
              >
                {LANGUAGES.map((l) => (
                  <DropdownMenuRadioItem key={l} value={l} lang={l}>
                    {t(`languages.${l}`)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <SunMoon aria-hidden />
              <span>{t('preferences.theme')}</span>
              <span className="ml-auto type-caption text-muted-foreground">
                {t(THEME_KEYS[theme])}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(v) => setTheme(v as ThemePreference)}
              >
                {THEMES.map((v) => (
                  <DropdownMenuRadioItem key={v} value={v}>
                    {t(THEME_KEYS[v])}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Rows3 aria-hidden />
              <span>{t('preferences.density')}</span>
              <span className="ml-auto type-caption text-muted-foreground">
                {t(DENSITY_KEYS[density])}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={density}
                onValueChange={(v) => setDensity(v as Density)}
              >
                {DENSITIES.map((v) => (
                  <DropdownMenuRadioItem key={v} value={v}>
                    {t(DENSITY_KEYS[v])}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ShieldUser aria-hidden />
              <span>{t('user.role')}</span>
              <span className="ml-auto type-caption text-muted-foreground">{nomePerfil}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-60">
              <DropdownMenuLabel className="type-caption font-normal text-muted-foreground">
                {t('user.roleHint')}
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup value={perfilId} onValueChange={setPerfil}>
                {(perfis.data ?? [])
                  .filter((p) => p.status === 'ativo')
                  .map((p) => (
                    <DropdownMenuRadioItem key={p.id} value={p.id}>
                      {textoEm(p.nome, idiomaTela)}
                    </DropdownMenuRadioItem>
                  ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
          <Keyboard aria-hidden />
          {t('shortcuts.title')}
          <DropdownMenuShortcut>?</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setSignOutOpen(true)}>
          <LogOut aria-hidden />
          {t('user.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
