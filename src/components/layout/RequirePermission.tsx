import type { ReactNode } from 'react'
import { ForbiddenContent } from '@/features/system/ErrorPages'
import { useCan } from '@/hooks/use-can'

/** Tela inteira só para quem tem a permissão; senão, a tela 403 dentro do shell. */
export function RequirePermission({
  permission,
  children,
}: {
  permission: string
  children: ReactNode
}) {
  const allowed = useCan(permission)
  return allowed ? <>{children}</> : <ForbiddenContent />
}
