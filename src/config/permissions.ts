/*
 * PERMISSÕES — matriz papel → permissões.
 *
 * Permissão é uma string `<módulo>.<ação>` (ex.: `comercial.ver`, `comercial.criar`).
 * Ações usadas no template: ver, criar, editar, excluir, aprovar, exportar.
 * Regras aceitam curinga `*` em um segmento: `*` (tudo), `admin.*`, `*.ver`.
 * `deny` vence `allow`.
 *
 * Simulado no front. Com a API real, a lista de permissões do usuário virá
 * do servidor — a interface (useCan / <Can>) continua a mesma.
 */

export type Role = 'admin' | 'operacao' | 'leitura'

export const ROLES: Role[] = ['admin', 'operacao', 'leitura']

interface RoleRules {
  allow: string[]
  deny?: string[]
}

export const ROLE_PERMISSIONS: Record<Role, RoleRules> = {
  admin: { allow: ['*'] },
  operacao: {
    allow: ['*.ver', '*.criar', '*.editar', '*.exportar', 'compras.aprovar'],
    deny: ['admin.*'],
  },
  leitura: {
    allow: ['*.ver'],
    deny: ['admin.*'],
  },
}

function matches(rule: string, permission: string): boolean {
  if (rule === '*') return true
  const r = rule.split('.')
  const p = permission.split('.')
  if (r.length !== p.length) return false
  return r.every((seg, i) => seg === '*' || seg === p[i])
}

/** O papel tem a permissão? */
export function can(role: Role, permission: string | undefined): boolean {
  if (!permission) return true
  const rules = ROLE_PERMISSIONS[role]
  if (rules.deny?.some((d) => matches(d, permission))) return false
  return rules.allow.some((a) => matches(a, permission))
}
