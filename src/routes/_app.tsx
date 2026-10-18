import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/layout/AppShell'
import { AppError } from '@/features/system/ErrorPages'
import { useSessionStore } from '@/stores/session-store'

/**
 * Layout (sem caminho próprio) com o shell do ERP. Toda tela interna fica em
 * src/routes/_app/. Telas públicas (login, acesso pendente, manutenção) ficam fora.
 * Sem sessão → login; acesso ainda não liberado → acesso pendente.
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: ({ location }) => {
    const { status } = useSessionStore.getState()
    if (status === 'signedOut')
      throw redirect({ to: '/login', search: { redirect: location.href } })
    if (status === 'pending') throw redirect({ to: '/acesso-pendente' })
  },
  component: AppShell,
  // Erro numa tela interna: mostra o 500 dentro do shell (menu continua utilizável).
  errorComponent: AppError,
})
