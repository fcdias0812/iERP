import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Building, Hourglass, LogIn, RefreshCw, Wrench } from 'lucide-react'
import { AuthLayout, StatusPage } from '@/components/patterns/StatusPages'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RhfField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/input-variants'
import { toast } from '@/components/ui/sonner'
import { z } from '@/lib/zod-i18n'
import { useSessionStore } from '@/stores/session-store'

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  remember: z.boolean(),
})

/** Só aceita voltar para caminhos internos (evita redirecionamento para fora). */
function safeRedirect(target: string | undefined) {
  return target && target.startsWith('/') && !target.startsWith('//') ? target : '/'
}

/** LOGIN (fora do shell): logo completa + detalhe do degradê. */
export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { redirect?: string }
  const signIn = useSessionStore((s) => s.signIn)
  const [sso, setSso] = useState(false)
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: true },
    mode: 'onTouched',
  })
  const remember = useWatch({ control: form.control, name: 'remember' })

  const enter = (email: string) => {
    const status = signIn(email)
    if (status === 'pending') void navigate({ to: '/acesso-pendente' })
    else void navigate({ href: safeRedirect(search.redirect) })
  }

  const submit = form.handleSubmit(async (values) => {
    await new Promise((r) => window.setTimeout(r, 600))
    enter(values.email)
  })

  return (
    <AuthLayout>
      <div className="space-y-1 text-center">
        <h1 className="type-page-title">{t('auth.loginTitle')}</h1>
        <p className="type-body text-muted-foreground">{t('auth.loginSubtitle')}</p>
      </div>
      <form onSubmit={submit} noValidate className="mt-6 grid grid-cols-1 gap-4">
        <RhfField control={form.control} name="email" label={t('ds.c.f.email')} required>
          {({ field, control }) => (
            <Input {...control} {...field} type="email" autoComplete="username" autoFocus />
          )}
        </RhfField>
        <RhfField control={form.control} name="password" label={t('ds.c.f.password')} required>
          {({ field, control }) => (
            <PasswordInput {...control} {...field} autoComplete="current-password" />
          )}
        </RhfField>
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 type-body">
            <Checkbox
              checked={remember}
              onCheckedChange={(c) => form.setValue('remember', c === true)}
            />
            {t('auth.remember')}
          </label>
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0"
            onClick={() => toast.info(t('auth.forgotInfo'))}
          >
            {t('auth.forgot')}
          </Button>
        </div>
        <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
          {!form.formState.isSubmitting && <LogIn aria-hidden />}
          {t('auth.signIn')}
        </Button>
        <div className="flex items-center gap-3 type-caption text-muted-foreground" aria-hidden>
          <span className="h-px flex-1 bg-border" />
          {t('auth.or')}
          <span className="h-px flex-1 bg-border" />
        </div>
        <Button
          variant="secondary"
          size="lg"
          loading={sso}
          onClick={async () => {
            setSso(true)
            await new Promise((r) => window.setTimeout(r, 700))
            enter('')
          }}
        >
          {!sso && <Building aria-hidden />}
          {t('auth.sso')}
        </Button>
      </form>
      <Alert tone="info" className="mt-6">
        {t('auth.demoHint')}
      </Alert>
    </AuthLayout>
  )
}

/** ACESSO PENDENTE: entrou, mas ainda não foi liberado por um administrador. */
export function PendingAccessPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, signOut, signIn } = useSessionStore()
  return (
    <AuthLayout>
      <StatusPage
        icon={<Hourglass />}
        title={t('auth.pendingTitle')}
        description={t('auth.pendingDescription', { email: user.email })}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                signOut()
                void navigate({ to: '/login' })
              }}
            >
              {t('auth.useOtherAccount')}
            </Button>
            <Button
              onClick={() => {
                // Demonstração: simula a liberação do acesso.
                signIn('mariana.albuquerque@exemplo.com.br')
                toast.success(t('auth.accessGranted'))
                void navigate({ to: '/' })
              }}
            >
              <RefreshCw aria-hidden />
              {t('auth.checkAgain')}
            </Button>
          </>
        }
      />
    </AuthLayout>
  )
}

/** MANUTENÇÃO: sistema fora do ar de forma programada. */
export function MaintenancePage() {
  const { t } = useTranslation()
  return (
    <AuthLayout>
      <StatusPage
        icon={<Wrench />}
        title={t('auth.maintenanceTitle')}
        description={t('auth.maintenanceDescription')}
        actions={
          <Button variant="secondary" onClick={() => window.location.assign('/')}>
            <RefreshCw aria-hidden />
            {t('common.tryAgain')}
          </Button>
        }
      />
    </AuthLayout>
  )
}
