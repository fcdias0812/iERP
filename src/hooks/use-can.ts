import { can } from '@/config/permissions'
import { getContext } from '@/config/navigation'
import { useSessionStore } from '@/stores/session-store'

/** O usuário atual tem a permissão? (`undefined` = livre) */
export function useCan(permission: string | undefined): boolean {
  const role = useSessionStore((s) => s.role)
  return can(role, permission)
}

/** Contexto atual (cliente/unidade/empresa) com o seu conjunto de menus. */
export function useCurrentContext() {
  const contextId = useSessionStore((s) => s.contextId)
  return getContext(contextId)
}
