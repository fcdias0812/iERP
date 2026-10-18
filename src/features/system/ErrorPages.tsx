import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { FileQuestion, House, RefreshCw, ServerCrash, ShieldX } from 'lucide-react'
import { AppLink } from '@/components/layout/AppLink'
import { AuthLayout, StatusPage } from '@/components/patterns/StatusPages'
import { Button } from '@/components/ui/button'
import { useSessionStore } from '@/stores/session-store'

/*
 * Telas de erro do sistema:
 *  - 404 / 403 / 500 DENTRO do shell (menu e navbar continuam);
 *  - 404 / 500 de página inteira (fora do shell, ex.: erro antes de montar o layout).
 */

function HomeButton({ variant = 'default' }: { variant?: 'default' | 'secondary' }) {
  const { t } = useTranslation()
  return (
    <Button asChild variant={variant}>
      <AppLink to="/">
        <House aria-hidden />
        {t('placeholder.backHome')}
      </AppLink>
    </Button>
  )
}

/** 404 dentro do shell. */
export function NotFoundContent() {
  const { t } = useTranslation()
  return (
    <StatusPage
      className="py-16"
      icon={<FileQuestion />}
      code="404"
      title={t('placeholder.notFoundTitle')}
      description={t('placeholder.notFoundDescription')}
      actions={<HomeButton />}
    />
  )
}

/** 403 dentro do shell (perfil sem permissão para a tela). */
export function ForbiddenContent() {
  const { t } = useTranslation()
  const role = useSessionStore((s) => s.role)
  return (
    <StatusPage
      className="py-16"
      icon={<ShieldX />}
      code="403"
      title={t('placeholder.forbiddenTitle')}
      description={t('placeholder.forbiddenDescription', { role: t(`roles.${role}`) })}
      actions={<HomeButton variant="secondary" />}
    />
  )
}

/** 500 dentro do shell (errorComponent da rota _app). */
export function AppError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation()
  const router = useRouter()
  return (
    <StatusPage
      className="py-16"
      icon={<ServerCrash />}
      code="500"
      title={t('errors.serverTitle')}
      description={t('errors.serverDescription')}
      details={error instanceof Error ? error.message : String(error)}
      actions={
        <>
          <Button
            onClick={() => {
              reset()
              void router.invalidate()
            }}
          >
            <RefreshCw aria-hidden />
            {t('common.tryAgain')}
          </Button>
          <HomeButton variant="secondary" />
        </>
      }
    />
  )
}

/** 500 de página inteira. */
export function FullPageError(props: ErrorComponentProps) {
  return (
    <AuthLayout>
      <AppError {...props} />
    </AuthLayout>
  )
}

/** 404 de página inteira. */
export function FullPageNotFound() {
  return (
    <AuthLayout>
      <NotFoundContent />
    </AuthLayout>
  )
}
