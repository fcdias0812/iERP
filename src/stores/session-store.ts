import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_CONTEXT_ID } from '@/config/navigation'
import { PERFIL_ADMIN } from '@/config/permissions'

export interface SessionUser {
  name: string
  email: string
  /** Cargo é dado do cadastro (não passa pelo i18n). */
  jobTitle: string
  avatarUrl?: string
}

/**
 * Situação da sessão (simulada):
 *  - authenticated: entrou e tem acesso;
 *  - pending: entrou, mas o acesso ainda não foi liberado (tela "acesso pendente");
 *  - signedOut: saiu → tela de login.
 * Com o SSO/API real, esta store passa a refletir a resposta do servidor.
 */
export type SessionStatus = 'authenticated' | 'pending' | 'signedOut'

interface SessionState {
  status: SessionStatus
  user: SessionUser
  /**
   * Id do perfil de acesso do usuário (Administração › Perfis de acesso). Enquanto o login é
   * simulado, dá para trocar no menu do usuário para ver as permissões de outro perfil.
   */
  perfilId: string
  contextId: string
  setPerfil: (perfilId: string) => void
  setContext: (contextId: string) => void
  /** Foto de perfil (URL devolvida pela API); `undefined` remove. */
  setAvatar: (url?: string) => void
  /** Entrar (simulado). E-mail começando com "pendente" cai em "acesso pendente". */
  signIn: (email: string) => SessionStatus
  /** Sair: limpa a sessão e volta para o login. */
  signOut: () => void
}

/** Usuário fictício de demonstração. */
const DEMO_USER: SessionUser = {
  name: 'Mariana Albuquerque',
  email: 'mariana.albuquerque@exemplo.com.br',
  jobTitle: 'Coordenadora de Operações',
}

// A demonstração abre já autenticada; "Sair" leva ao login.
const initial = {
  status: 'authenticated' as SessionStatus,
  user: DEMO_USER,
  perfilId: PERFIL_ADMIN,
  contextId: DEFAULT_CONTEXT_ID,
}

/** Sessão simulada, salva no navegador (chave `reteck-session`). */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      ...initial,
      setPerfil: (perfilId) => set({ perfilId }),
      setContext: (contextId) => set({ contextId }),
      setAvatar: (avatarUrl) => set((s) => ({ user: { ...s.user, avatarUrl } })),
      signIn: (email) => {
        const status: SessionStatus = email.trim().toLowerCase().startsWith('pendente')
          ? 'pending'
          : 'authenticated'
        set({ ...initial, status, user: { ...DEMO_USER, email: email.trim() || DEMO_USER.email } })
        return status
      },
      signOut: () => set({ ...initial, status: 'signedOut' }),
    }),
    {
      name: 'reteck-session',
      version: 2,
      // v1 guardava o papel fixo (`role`); os ids dos perfis migrados são os mesmos.
      migrate: (salvo, versao) => {
        const s = (salvo ?? {}) as Record<string, unknown>
        if (versao < 2 && typeof s.role === 'string') return { ...s, perfilId: s.role }
        return s
      },
    },
  ),
)

/** Iniciais para o avatar (primeiro e último nome). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}
