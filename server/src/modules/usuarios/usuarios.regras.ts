import { z } from 'zod'
import type { ColunaConsulta } from '../../shared/consulta-tabela.js'
import type { AcaoUsuario, UsuarioStatus } from './usuarios.types.js'

/* Regras do cadastro de usuários: perfis, fluxo de status, validação e colunas da lista. */

export const PERFIS = ['admin', 'operacao', 'leitura'] as const
export const STATUS = ['ativo', 'bloqueado', 'inativo'] as const

/** Fluxo: Ativo ⇄ Bloqueado; Ativo/Bloqueado → Inativo → Ativo. */
export const TRANSICOES: Record<UsuarioStatus, Partial<Record<AcaoUsuario, UsuarioStatus>>> = {
  ativo: { bloquear: 'bloqueado', inativar: 'inativo' },
  bloqueado: { desbloquear: 'ativo', inativar: 'inativo' },
  inativo: { reativar: 'ativo' },
}

export const acoesDe = (status: UsuarioStatus) => Object.keys(TRANSICOES[status]) as AcaoUsuario[]

export const usuarioInputSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo.').max(120),
  email: z.string().trim().toLowerCase().pipe(z.email('E-mail inválido.').max(160)),
  perfil: z.enum(PERFIS, 'Perfil de acesso inválido.'),
})

export const transicaoSchema = z.object({
  acao: z.enum(['bloquear', 'desbloquear', 'inativar', 'reativar']),
  motivo: z.string().trim().max(300).optional(),
})

/** Código legível: USR-00001. */
export const codigoUsuario = (numero: number) => `USR-${String(numero).padStart(5, '0')}`

/** Colunas que a lista sabe filtrar/ordenar (ids = campos de UsuarioResumo). */
export const COLUNAS_USUARIO: ColunaConsulta[] = [
  { id: 'codigo', tipo: 'unique-text' },
  { id: 'nome', tipo: 'unique-text' },
  { id: 'email', tipo: 'unique-text' },
  { id: 'perfil', tipo: 'enum' },
  // Ordem do fluxo = flowOrder do statusMap do frontend (src/lib/status/statusMap.ts).
  { id: 'status', tipo: 'status', ordem: { ativo: 130, bloqueado: 410, inativo: 420 } },
  { id: 'ultimoAcesso', tipo: 'date' },
  { id: 'criadoEm', tipo: 'date' },
]
