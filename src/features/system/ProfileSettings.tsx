import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Bell, Camera, Info, Palette, Save, ShieldCheck, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SettingsLayout } from '@/components/patterns/SettingsLayout'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { RhfField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/input-variants'
import { Label } from '@/components/ui/label'
import { MaskedInput } from '@/components/ui/masked-input'
import { KeyValueList } from '@/components/ui/metadata'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from '@/components/ui/sonner'
import { StatusBadge } from '@/components/ui/status-badge'
import { Switch } from '@/components/ui/switch'
import { Timeline } from '@/components/ui/timeline'
import { CONTEXTS } from '@/config/navigation'
import { formatDateTime } from '@/lib/format'
import { apiErrorMessage } from '@/lib/api-errors'
import { isValidPhone } from '@/lib/validators/br'
import { enviarFotoPerfil, FOTO_MAX_BYTES, FOTO_TIPOS, removerFotoPerfil } from '@/services/perfil'
import { z } from '@/lib/zod-i18n'
import { useNomePerfil } from '@/hooks/use-can'
import { initials, useSessionStore } from '@/stores/session-store'
import { useUiStore, type Density, type Language, type ThemePreference } from '@/stores/ui-store'

/* ================================================================ PERFIL */

const profileSchema = z.object({
  name: z.string().trim().min(3).max(80),
  phone: z.string().refine((v) => !v || isValidPhone(v), 'validation.phone'),
})

/** Foto de perfil: trocar (JPG, PNG ou WebP até 5 MB, recortada em quadrado) ou remover. */
function ProfilePhoto() {
  const { t } = useTranslation()
  const user = useSessionStore((s) => s.user)
  const setAvatar = useSessionStore((s) => s.setAvatar)
  const input = useRef<HTMLInputElement>(null)
  const onError = (e: unknown) =>
    toast.error(t('profile.photo.failed'), { description: apiErrorMessage(e) })
  const enviar = useMutation({
    mutationFn: enviarFotoPerfil,
    onSuccess: ({ url }) => {
      setAvatar(url)
      toast.success(t('profile.photo.updated'))
    },
    onError,
  })
  const remover = useMutation({
    mutationFn: removerFotoPerfil,
    onSuccess: () => {
      setAvatar(undefined)
      toast.success(t('profile.photo.removed'))
    },
    onError,
  })

  const escolher = (file?: File) => {
    if (!file) return
    if (!(FOTO_TIPOS as readonly string[]).includes(file.type))
      return toast.error(t('profile.photo.invalidType'))
    if (file.size > FOTO_MAX_BYTES) return toast.error(t('profile.photo.tooLarge'))
    enviar.mutate(file)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Avatar className="size-20">
        {user.avatarUrl && (
          <AvatarImage src={user.avatarUrl} alt={t('profile.photo.alt', { name: user.name })} />
        )}
        <AvatarFallback className="type-section-title">{initials(user.name)}</AvatarFallback>
      </Avatar>
      <input
        ref={input}
        type="file"
        accept={FOTO_TIPOS.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          escolher(e.target.files?.[0])
          e.target.value = '' // permite escolher o mesmo arquivo de novo
        }}
      />
      <div className="flex flex-wrap justify-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          loading={enviar.isPending}
          aria-describedby="profile-photo-help"
          onClick={() => input.current?.click()}
        >
          <Camera aria-hidden />
          {user.avatarUrl ? t('profile.photo.change') : t('profile.photo.add')}
        </Button>
        {user.avatarUrl && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('profile.photo.remove')}
            loading={remover.isPending}
            onClick={() => remover.mutate()}
          >
            <Trash2 aria-hidden />
          </Button>
        )}
      </div>
      <p id="profile-photo-help" className="type-caption text-muted-foreground">
        {t('profile.photo.help')}
      </p>
    </div>
  )
}

/** PERFIL DO USUÁRIO: dados pessoais, acessos e atividade recente. */
export function ProfilePage() {
  const { t } = useTranslation()
  const { user } = useSessionStore()
  const perfil = useNomePerfil()
  const form = useForm({
    resolver: zodResolver(profileSchema),
    mode: 'onTouched',
    defaultValues: { name: user.name, phone: '11987654321' },
  })
  const save = form.handleSubmit(async (v) => {
    await new Promise((r) => window.setTimeout(r, 600))
    form.reset(v)
    toast.success(t('profile.saved'))
  })
  const [now] = useState(() => Date.now())
  const ago = (h: number) => new Date(now - h * 3_600_000).toISOString()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('nav.perfil')} description={t('profile.description')} />
      <Card className="flex-row flex-wrap items-center gap-4 p-4 sm:p-6">
        <ProfilePhoto />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="type-section-title">{user.name}</p>
          <p className="type-body break-words text-muted-foreground">
            {user.jobTitle} · {user.email}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="info">{perfil}</Badge>
            <StatusBadge status="ativo" size="sm" />
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <form onSubmit={save} noValidate className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div>
                <CardTitle>{t('profile.personal')}</CardTitle>
                <CardDescription>{t('profile.personalHelp')}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <RhfField
                control={form.control}
                name="name"
                label={t('ds.c.f.name')}
                required
                maxLength={80}
              >
                {({ field, control }) => <Input {...control} {...field} />}
              </RhfField>
              <RhfField control={form.control} name="phone" label={t('ds.c.masks.phone')}>
                {({ field, control }) => (
                  <MaskedInput
                    {...control}
                    kind="phone"
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              </RhfField>
              <div className="space-y-1.5">
                <Label htmlFor="profile-email">{t('ds.c.f.email')}</Label>
                <Input
                  id="profile-email"
                  readOnly
                  value={user.email}
                  aria-describedby="profile-email-help"
                />
                <p id="profile-email-help" className="type-caption text-muted-foreground">
                  {t('profile.emailHelp')}
                </p>
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button
                type="submit"
                loading={form.formState.isSubmitting}
                disabled={!form.formState.isDirty}
              >
                <Save aria-hidden />
                {t('common.save')}
              </Button>
            </CardFooter>
          </Card>
        </form>
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.access')}</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValueList
              columns={1}
              items={[
                { label: t('user.role'), value: perfil },
                { label: t('context.switch'), value: CONTEXTS.map((c) => c.name).join(', ') },
                { label: t('profile.lastLogin'), value: formatDateTime(ago(2)) },
              ]}
            />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.activity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline
            events={[
              {
                id: '1',
                actor: user.name,
                at: ago(1),
                action: t('profile.ev.approved', { code: 'PV-2026-00418' }),
                tone: 'success',
              },
              {
                id: '2',
                actor: user.name,
                at: ago(5),
                action: t('profile.ev.edited', { code: 'PV-2026-00412' }),
              },
              { id: '3', actor: user.name, at: ago(26), action: t('profile.ev.exported') },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}

/* ================================================================ CONFIGURAÇÕES */

const passwordSchema = z
  .object({
    current: z.string().min(1),
    next: z.string().min(8),
    confirm: z.string().min(1),
  })
  .refine((v) => v.next === v.confirm, { path: ['confirm'], message: 'validation.passwordMatch' })

/** PADRÃO CONFIGURAÇÕES: seções à esquerda, formulários à direita. */
export function SettingsPage() {
  const { t } = useTranslation()
  const [section, setSection] = useState('general')
  return (
    <SettingsLayout
      title={t('nav.configuracoes')}
      description={t('settings.description')}
      active={section}
      onActiveChange={setSection}
      sections={[
        {
          id: 'general',
          label: t('settings.general'),
          icon: Palette,
          content: <GeneralSettings />,
        },
        {
          id: 'notifications',
          label: t('notifications.title'),
          icon: Bell,
          content: <NotificationSettings />,
        },
        {
          id: 'security',
          label: t('settings.security'),
          icon: ShieldCheck,
          content: <SecuritySettings />,
        },
        { id: 'about', label: t('settings.about'), icon: Info, content: <AboutSettings /> },
      ]}
    />
  )
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="type-label">{label}</legend>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as T)}
        className="flex flex-wrap gap-x-6 gap-y-2"
      >
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 type-body">
            <RadioGroupItem value={o.value} />
            {o.label}
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  )
}

function GeneralSettings() {
  const { t } = useTranslation()
  const { theme, density, language, setTheme, setDensity, setLanguage } = useUiStore()
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t('settings.general')}</CardTitle>
          <CardDescription>{t('settings.generalHelp')}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Choice<Language>
          label={t('preferences.language')}
          value={language}
          onChange={setLanguage}
          options={(['pt-BR', 'en', 'zh-TW'] as const).map((l) => ({
            value: l,
            label: t(`languages.${l}`),
          }))}
        />
        <Choice<ThemePreference>
          label={t('preferences.theme')}
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'light', label: t('preferences.themeLight') },
            { value: 'dark', label: t('preferences.themeDark') },
            { value: 'system', label: t('preferences.themeSystem') },
          ]}
        />
        <Choice<Density>
          label={t('preferences.density')}
          value={density}
          onChange={setDensity}
          options={[
            { value: 'comfortable', label: t('preferences.densityComfortable') },
            { value: 'compact', label: t('preferences.densityCompact') },
          ]}
        />
      </CardContent>
    </Card>
  )
}

function NotificationSettings() {
  const { t } = useTranslation()
  const keys = ['approvals', 'late', 'mentions', 'weekly'] as const
  const [on, setOn] = useState<Record<(typeof keys)[number], boolean>>({
    approvals: true,
    late: true,
    mentions: true,
    weekly: false,
  })
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t('notifications.title')}</CardTitle>
          <CardDescription>{t('settings.notificationsHelp')}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {keys.map((k) => (
            <li key={k} className="flex items-center justify-between gap-4 py-3">
              <label htmlFor={`notif-${k}`} className="min-w-0 cursor-pointer">
                <span className="block type-body font-medium">
                  {t(`settings.notif.${k}.title`)}
                </span>
                <span className="block type-caption text-muted-foreground">
                  {t(`settings.notif.${k}.desc`)}
                </span>
              </label>
              <Switch
                id={`notif-${k}`}
                checked={on[k]}
                onCheckedChange={(c) => {
                  setOn((s) => ({ ...s, [k]: c }))
                  toast.success(t('settings.preferenceSaved'))
                }}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function SecuritySettings() {
  const { t } = useTranslation()
  const form = useForm({
    resolver: zodResolver(passwordSchema),
    mode: 'onTouched',
    defaultValues: { current: '', next: '', confirm: '' },
  })
  const submit = form.handleSubmit(async () => {
    await new Promise((r) => window.setTimeout(r, 700))
    form.reset()
    toast.success(t('settings.passwordChanged'))
  })
  return (
    <form onSubmit={submit} noValidate>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t('settings.changePassword')}</CardTitle>
            <CardDescription>{t('settings.passwordHelp')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid max-w-md grid-cols-1 gap-5">
          <RhfField
            control={form.control}
            name="current"
            label={t('settings.currentPassword')}
            required
          >
            {({ field, control }) => (
              <PasswordInput {...control} {...field} autoComplete="current-password" />
            )}
          </RhfField>
          <RhfField
            control={form.control}
            name="next"
            label={t('settings.newPassword')}
            required
            help={t('settings.newPasswordHelp')}
          >
            {({ field, control }) => (
              <PasswordInput {...control} {...field} autoComplete="new-password" />
            )}
          </RhfField>
          <RhfField
            control={form.control}
            name="confirm"
            label={t('settings.confirmPassword')}
            required
          >
            {({ field, control }) => (
              <PasswordInput {...control} {...field} autoComplete="new-password" />
            )}
          </RhfField>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={form.formState.isSubmitting}>
            {t('settings.changePassword')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}

function AboutSettings() {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.about')}</CardTitle>
      </CardHeader>
      <CardContent>
        <KeyValueList
          items={[
            { label: t('settings.version'), value: <span className="font-mono">0.5.0</span> },
            { label: t('settings.environment'), value: t('settings.environmentDemo') },
            { label: t('settings.timezone'), value: 'America/Sao_Paulo' },
            { label: t('settings.support'), value: 'suporte@exemplo.com.br' },
          ]}
        />
      </CardContent>
    </Card>
  )
}
