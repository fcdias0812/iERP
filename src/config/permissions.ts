/*
 * PERMISSÕES — Perfis de acesso (Administração › Perfis de acesso; pedido do usuário, 19/10/2026).
 *
 * Cada perfil dá a cada PÁGINA do menu um nível: sem acesso (ausente), `ver` (visualizar e
 * exportar) ou `editar` (tudo: criar, editar, inativar, remover…). Uma permissão é a string
 * `<página>.<ação>` — a página é o id do item do menu (`clientes`, `ordens.lotes`,
 * `cadastros.caixotes`…) e a ação é ver, criar, editar, excluir, aprovar ou exportar.
 * O Administrador é fixo e pode tudo.
 *
 * Os perfis vêm da API (`/api/perfis`); a sessão guarda só o id do perfil do usuário. Enquanto o
 * login é simulado, as permissões valem nas telas (`useCan` / `<Can>`).
 */

export type NivelAcesso = 'ver' | 'editar'

/** Id do perfil Administrador (fixo, pode tudo). */
export const PERFIL_ADMIN = 'admin'

export interface PermissoesDoPerfil {
  /** Administrador: pode tudo. */
  fixo: boolean
  /** Página → nível; ausente = sem acesso. */
  paginas: Partial<Record<string, NivelAcesso>>
}

export const ACESSO_TOTAL: PermissoesDoPerfil = { fixo: true, paginas: {} }

/** Ações que o nível "visualizar" permite. */
const ACOES_DE_LEITURA = new Set(['ver', 'exportar'])

/** O perfil tem a permissão `<página>.<ação>`? (`undefined` = livre; sem perfil = nada) */
export function can(perfil: PermissoesDoPerfil | null | undefined, permission?: string): boolean {
  if (!permission) return true
  if (!perfil) return false
  if (perfil.fixo) return true
  const i = permission.lastIndexOf('.')
  const pagina = permission.slice(0, i)
  const acao = permission.slice(i + 1)
  const nivel = perfil.paginas[pagina]
  if (!nivel) return false
  return nivel === 'editar' || ACOES_DE_LEITURA.has(acao)
}
