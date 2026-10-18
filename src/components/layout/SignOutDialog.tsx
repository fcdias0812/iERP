import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useSessionStore } from '@/stores/session-store'
import { useShellStore } from '@/stores/shell-store'

/** Confirmação de saída. Sai da sessão (simulada) e vai para o login. */
export function SignOutDialog() {
  const { t } = useTranslation()
  const open = useShellStore((s) => s.signOutOpen)
  const setOpen = useShellStore((s) => s.setSignOutOpen)
  const signOut = useSessionStore((s) => s.signOut)
  const navigate = useNavigate()

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('user.signOutTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('user.signOutDescription')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              signOut()
              void navigate({ to: '/login' })
            }}
          >
            {t('user.signOut')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
