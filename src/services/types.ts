import type { TablePage } from '@/components/data-table/types'
import type { Role } from '@/config/permissions'

/*
 * CONTRATO DA API (tipos). O servidor simulado (src/mocks) e a API real devolvem
 * exatamente estes formatos. Datas: ISO 8601; dias sem hora: "yyyy-mm-dd".
 */

/* ------------------------------------------------------------ comuns */

export interface Mudanca {
  /** Chave do campo (traduzida na tela). */
  campo: string
  antes: string | number | boolean | null
  depois: string | number | boolean | null
}

export interface EventoHistorico {
  id: string
  autor: string
  em: string
  acao: 'criado' | 'editado' | 'status'
  mudancas?: Mudanca[]
  nota?: string
}

/* ------------------------------------------------------------ Admin › Usuários */

export type UsuarioStatus = 'ativo' | 'bloqueado' | 'inativo'

/** Perfil de acesso do usuário (mesmos papéis de src/config/permissions.ts). */
export type UsuarioPerfil = Role

/** Ações do fluxo de status do usuário. */
export type AcaoUsuario = 'bloquear' | 'desbloquear' | 'inativar' | 'reativar'

/** Linha da lista (resumo). */
export interface UsuarioResumo {
  id: string
  codigo: string
  nome: string
  email: string
  perfil: UsuarioPerfil
  status: UsuarioStatus
  /** Último acesso ao sistema (null = nunca acessou). */
  ultimoAcesso: string | null
  criadoEm: string
}

export interface Usuario extends UsuarioResumo {
  criadoPor: string
  alteradoPor: string
  alteradoEm: string
  historico: EventoHistorico[]
  /** Ações que o fluxo permite agora (a tela ainda confere a permissão do perfil). */
  acoesPermitidas: AcaoUsuario[]
}

/** Dados enviados ao criar/editar. */
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

/** Página da lista em modo servidor + contagens por valor dos filtros. */
export type PaginaUsuarios = TablePage<UsuarioResumo> & {
  facets: Record<string, Record<string, number>>
}

/* ------------------------------------------------------------ Clientes */

export type ClienteStatus = 'ativo' | 'inativo'

/** Ações do fluxo de status do cliente. */
export type AcaoCliente = 'inativar' | 'reativar'

/** Contato do cliente. Telefone só com dígitos (DDD + número). */
export interface ContatoCliente {
  id: string
  nome: string | null
  email: string
  telefone: string
  principal: boolean
}

/** Linha da lista (resumo) — com o contato principal. CNPJ sem pontuação. */
export interface ClienteResumo {
  id: string
  codigo: string
  nome: string
  cnpj: string
  contatoNome: string | null
  contatoEmail: string | null
  contatoTelefone: string | null
  /** Quantidade de contatos. */
  contatos: number
  status: ClienteStatus
  criadoEm: string
}

export interface Cliente {
  id: string
  codigo: string
  nome: string
  cnpj: string
  status: ClienteStatus
  /** O principal vem primeiro. */
  contatos: ContatoCliente[]
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
  historico: EventoHistorico[]
  /** Ações que o fluxo permite agora (a tela ainda confere a permissão do perfil). */
  acoesPermitidas: AcaoCliente[]
}

/** Dados enviados ao criar/editar. Exatamente um contato com `principal: true`. */
export interface ClienteInput {
  nome: string
  cnpj: string
  contatos: { nome: string | null; email: string; telefone: string; principal: boolean }[]
}

export interface ClientesResumo {
  total: number
  ativos: number
  inativos: number
}

export type PaginaClientes = TablePage<ClienteResumo> & {
  facets: Record<string, Record<string, number>>
}

/* ------------------------------------------------------------ shell (busca e notificações) */

export interface ResultadoBusca {
  tipo: 'cliente' | 'usuario'
  id: string
  codigo: string
  titulo: string
  rota: string
}

export interface Notificacao {
  id: string
  tipo: 'usuario_criado' | 'usuario_bloqueado'
  parametros: Record<string, string | number>
  tom: 'info' | 'success' | 'warning' | 'alert' | 'danger' | 'inactive'
  em: string
  lida: boolean
  rota?: string
}
