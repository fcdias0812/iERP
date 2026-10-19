import type { ReactNode } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Construction, Download, Plus, Trash2 } from 'lucide-react'
import { ForbiddenContent, NotFoundContent } from '@/features/system/ErrorPages'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/layout/Can'
import { PageHeader } from '@/components/layout/PageHeader'
import { findNavItemAnyContext, findNavTrail } from '@/config/navigation'
import { useCan, useCurrentContext, useNomePerfil } from '@/hooks/use-can'

/** Módulo da permissão `<módulo>.ver` → `<módulo>.criar`, etc. */
function modulePermission(permission: string | undefined, action: string) {
  const mod = permission?.split('.')[0]
  return mod ? `${mod}.${action}` : action
}

/**
 * Tela provisória de todo módulo que ainda não foi construído. A navegação, o
 * breadcrumb e as permissões já funcionam; as telas reais chegam nas fases 5–7.
 */
export function UnderConstructionPage() {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const ctx = useCurrentContext()
  const perfil = useNomePerfil()
  const item = findNavTrail(ctx, pathname).at(-1) ?? findNavItemAnyContext(pathname)
  const allowed = useCan(item?.permission)

  if (!item) return <NotFoundContent />
  if (!allowed) return <ForbiddenContent />

  const title = t(item.labelKey)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={t('placeholder.description')}
        actions={
          <>
            <Can permission={modulePermission(item.permission, 'excluir')} fallback="disable">
              <Button variant="destructive">
                <Trash2 aria-hidden />
                {t('common.delete')}
              </Button>
            </Can>
            <Can permission={modulePermission(item.permission, 'exportar')} fallback="disable">
              <Button variant="secondary">
                <Download aria-hidden />
                {t('common.export')}
              </Button>
            </Can>
            <Can permission={modulePermission(item.permission, 'criar')} fallback="disable">
              <Button>
                <Plus aria-hidden />
                {t('common.new')}
              </Button>
            </Can>
          </>
        }
      />
      <StateCard
        icon={<Construction className="size-6" aria-hidden />}
        title={t('placeholder.title')}
        description={t('placeholder.body', { role: perfil })}
      />
    </div>
  )
}

function StateCard({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-14 text-center shadow-card">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <h2 className="type-section-title">{title}</h2>
      <p className="max-w-lg type-body text-muted-foreground">{description}</p>
      {action && <div className="pt-2">{action}</div>}
    </section>
  )
}
