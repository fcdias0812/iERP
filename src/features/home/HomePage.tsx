import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { AppLink } from '@/components/layout/AppLink'
import { PageHeader } from '@/components/layout/PageHeader'
import { KpiCard } from '@/components/ui/kpi-card'
import { FALLBACK_ICON, type NavItem } from '@/config/navigation'
import { can } from '@/config/permissions'
import { useCan, useCurrentContext } from '@/hooks/use-can'
import { formatNumber } from '@/lib/format'
import { resumoUsuarios, usuariosKeys } from '@/services/usuarios'
import { useSessionStore } from '@/stores/session-store'

const INDICADORES = ['ativos', 'bloqueados', 'inativos'] as const

/** INÍCIO: indicadores dos módulos que o perfil pode ver e atalhos para os módulos. */
export function HomePage() {
  const { t } = useTranslation()
  const ctx = useCurrentContext()
  const { user, role } = useSessionStore()
  const firstName = user.name.split(' ')[0] ?? user.name
  const verUsuarios = useCan('admin.ver')
  const resumo = useQuery({
    queryKey: usuariosKeys.resumo(),
    queryFn: resumoUsuarios,
    enabled: verUsuarios,
  })

  // Atalhos: os módulos do contexto atual que o perfil pode ver.
  const modules: NavItem[] = ctx.sections
    .flatMap((s) => s.items)
    .filter((m) => m.id !== 'inicio')
    .filter((m) =>
      m.children ? m.children.some((c) => can(role, c.permission)) : can(role, m.permission),
    )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('home.greeting', { name: firstName })}
        description={t('home.description')}
      />

      {verUsuarios && (
        <section aria-labelledby="kpis-title" className="flex flex-col gap-3">
          <h2 id="kpis-title" className="type-section-title">
            {t('home.usersTitle')}
          </h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(16rem,100%),1fr))] gap-4">
            {INDICADORES.map((id) => (
              <li key={id}>
                <AppLink to="/admin/usuarios" className="block h-full rounded-lg">
                  <KpiCard
                    className="h-full transition-colors duration-150 hover:border-border-strong"
                    label={t(`usuarios.kpis.${id}`)}
                    value={resumo.data ? formatNumber(resumo.data[id]) : '—'}
                    loading={resumo.isPending}
                  />
                </AppLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {modules.length > 0 && (
        <section aria-labelledby="modules-title" className="flex flex-col gap-3">
          <h2 id="modules-title" className="type-section-title">
            {t('home.modulesTitle')}
          </h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(16rem,100%),1fr))] gap-3">
            {modules.map((m) => {
              const Icon = m.icon ?? FALLBACK_ICON
              const first = m.children?.find((c) => can(role, c.permission)) ?? m
              return (
                <li key={m.id}>
                  <AppLink
                    to={first.to ?? '/'}
                    className="group flex items-center gap-3 rounded-lg border bg-card p-4 shadow-card transition-colors duration-150 hover:border-border-strong hover:bg-accent"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-info-subtle text-info-subtle-foreground">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate type-card-title">{t(m.labelKey)}</span>
                      <span className="block truncate type-caption text-muted-foreground">
                        {m.children
                          ? t('home.screens', {
                              count: m.children.filter((c) => can(role, c.permission)).length,
                            })
                          : t('home.openScreen')}
                      </span>
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </AppLink>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
