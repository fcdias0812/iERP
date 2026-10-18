import { useTranslation } from 'react-i18next'
import { CircleQuestionMark, Keyboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useShellStore } from '@/stores/shell-store'

/** Ajuda da navbar: atalhos de teclado. */
export function HelpMenu() {
  const { t } = useTranslation()
  const setShortcutsOpen = useShellStore((s) => s.setShortcutsOpen)

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('help.title')}>
              <CircleQuestionMark aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('help.title')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-muted-foreground">{t('help.title')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
          <Keyboard aria-hidden />
          {t('shortcuts.title')}
          <DropdownMenuShortcut>?</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
