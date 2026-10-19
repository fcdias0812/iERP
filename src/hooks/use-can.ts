import { useQuery } from '@tanstack/react-query'
import { ACESSO_TOTAL, can, PERFIL_ADMIN, type PermissoesDoPerfil } from '@/config/permissions'
import { getContext } from '@/config/navigation'
import { textoEm } from '@/lib/localized-text'
import { listarPerfis, perfisKeys } from '@/services/perfis'
import { useSessionStore } from '@/stores/session-store'
import { useUiStore } from '@/stores/ui-store'

/** Perfis de acesso (cache compartilhado; mudam pouco). */
export const usePerfis = () =>
  useQuery({
    queryKey: perfisKeys.lista,
    queryFn: ({ signal }) => listarPerfis(signal),
    staleTime: 60_000,
  })

/** Permissões do perfil do usuário atual (null = perfil sem acesso ou ainda carregando). */
export function usePermissoes(): PermissoesDoPerfil | null {
  const perfilId = useSessionStore((s) => s.perfilId)
  const perfis = usePerfis()
  if (perfilId === PERFIL_ADMIN) return ACESSO_TOTAL
  const p = perfis.data?.find((x) => x.id === perfilId)
  if (!p || p.status !== 'ativo') return null
  return { fixo: p.fixo, paginas: p.permissoes }
}

/** As permissões do usuário atual já chegaram? (o Administrador não depende da lista) */
export function usePermissoesProntas(): boolean {
  const perfilId = useSessionStore((s) => s.perfilId)
  const perfis = usePerfis()
  return perfilId === PERFIL_ADMIN || !perfis.isPending
}

/** O usuário atual tem a permissão? (`undefined` = livre) */
export function useCan(permission: string | undefined): boolean {
  return can(usePermissoes(), permission)
}

/** Nome do perfil (no idioma da tela); sem id = o perfil do usuário atual. */
export function useNomePerfil(id?: string): string {
  const atual = useSessionStore((s) => s.perfilId)
  const idioma = useUiStore((s) => s.language)
  const perfis = usePerfis()
  const p = perfis.data?.find((x) => x.id === (id ?? atual))
  return p ? textoEm(p.nome, idioma) : (id ?? atual)
}

/** Contexto atual (cliente/unidade/empresa) com o seu conjunto de menus. */
export function useCurrentContext() {
  const contextId = useSessionStore((s) => s.contextId)
  return getContext(contextId)
}
