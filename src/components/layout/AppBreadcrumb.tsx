import { Fragment } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { findNavTrail } from '@/config/navigation'
import { useCurrentContext } from '@/hooks/use-can'
import { useBreadcrumbStore } from '@/stores/breadcrumb-store'
import { AppLink } from './AppLink'

/** Breadcrumb gerado da rota atual + configuração de navegação. Some no Início. */
export function AppBreadcrumb() {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const ctx = useCurrentContext()
  const tail = useBreadcrumbStore((s) => s.tail)

  if (pathname === '/') return null
  // Tela fora do menu (detalhe de registro): caminho da tela-mãe + rótulo final.
  const useTail = tail && tail.path === pathname
  const trail = useTail
    ? [...findNavTrail(ctx, tail.parent), { id: '__tail', labelKey: undefined, label: tail.label }]
    : findNavTrail(ctx, pathname)

  const labelOf = (item: (typeof trail)[number]) =>
    'label' in item && item.label ? item.label : item.labelKey ? t(item.labelKey) : ''

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <AppLink to="/">{t('nav.inicio')}</AppLink>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {trail.map((item, i) => {
          const last = i === trail.length - 1
          return (
            <Fragment key={item.id}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {last ? (
                  <BreadcrumbPage>{labelOf(item)}</BreadcrumbPage>
                ) : 'to' in item && item.to ? (
                  <BreadcrumbLink asChild>
                    <AppLink to={item.to}>{labelOf(item)}</AppLink>
                  </BreadcrumbLink>
                ) : (
                  <span>{labelOf(item)}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
