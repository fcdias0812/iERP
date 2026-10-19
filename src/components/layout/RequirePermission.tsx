import type { ReactNode } from 'react'
import { ForbiddenContent } from '@/features/system/ErrorPages'
import { Skeleton } from '@/components/ui/skeleton'
import { useCan, usePermissoesProntas } from '@/hooks/use-can'

/** Tela inteira só para quem tem a permissão; senão, a tela 403 dentro do shell. */
export function RequirePermission({
  permission,
  children,
}: {
  permission: string
  children: ReactNode
}) {
  const allowed = useCan(permission)
  const pronto = usePermissoesProntas()
  // Enquanto o perfil carrega, nem a tela nem o 403 (evita piscar "sem permissão").
  if (!pronto) return <Skeleton className="h-64 w-full" />
  return allowed ? <>{children}</> : <ForbiddenContent />
}
