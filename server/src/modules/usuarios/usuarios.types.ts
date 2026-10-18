/*
 * Contrato da API de usuários — espelho de src/services/types.ts do frontend
 * (Admin › Usuários). Mudou aqui? Mude lá também.
 */

export type UsuarioStatus = 'ativo' | 'bloqueado' | 'inativo'
export type UsuarioPerfil = 'admin' | 'operacao' | 'leitura'
export type AcaoUsuario = 'bloquear' | 'desbloquear' | 'inativar' | 'reativar'

export type { EventoHistorico, Mudanca } from '../../shared/historico.js'
import type { EventoHistorico } from '../../shared/historico.js'

export interface UsuarioResumo {
  id: string
  codigo: string
  nome: string
  email: string
  perfil: UsuarioPerfil
  status: UsuarioStatus
  ultimoAcesso: string | null
  criadoEm: string
}

export interface Usuario extends UsuarioResumo {
  criadoPor: string
  alteradoPor: string
  alteradoEm: string
  historico: EventoHistorico[]
  acoesPermitidas: AcaoUsuario[]
}

export interface UsuarioInput {
  nome: string
  email: string
  perfil: UsuarioPerfil
}

export interface UsuariosResumo {
  total: number
  ativos: number
  bloqueados: number
  inativos: number
}

export interface PaginaUsuarios {
  rows: UsuarioResumo[]
  total: number
  totals: Record<string, number>
  facets: Record<string, Record<string, number>>
}
