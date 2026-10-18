import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { isMac, useHotkey } from '@/hooks/use-hotkey'
import { useShellStore } from '@/stores/shell-store'

const SHORTCUTS = [
  { id: 'search', keys: ['mod', 'K'] },
  { id: 'toggleSidebar', keys: ['mod', 'B'] },
  { id: 'newRecord', keys: ['N'] },
  { id: 'save', keys: ['mod', 'S'] },
  { id: 'shortcuts', keys: ['?'] },
  { id: 'close', keys: ['Esc'] },
] as const

/** Lista de atalhos de teclado (abre com "?"). */
export function ShortcutsDialog() {
  const { t } = useTranslation()
  const open = useShellStore((s) => s.shortcutsOpen)
  const setOpen = useShellStore((s) => s.setShortcutsOpen)
  useHotkey({ key: '?' }, () => setOpen(true))
  const mod = isMac() ? '⌘' : 'Ctrl'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('shortcuts.title')}</DialogTitle>
          <DialogDescription>{t('shortcuts.description')}</DialogDescription>
        </DialogHeader>
        <dl className="divide-y rounded-lg border">
          {SHORTCUTS.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-4 px-3 py-2.5">
              <dt className="type-body">{t(`shortcuts.items.${s.id}`)}</dt>
              <dd>
                <KbdGroup>
                  {s.keys.map((k, i) => (
                    <Fragment key={k}>
                      {i > 0 && <span className="type-caption text-muted-foreground">+</span>}
                      <Kbd>{k === 'mod' ? mod : k}</Kbd>
                    </Fragment>
                  ))}
                </KbdGroup>
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
