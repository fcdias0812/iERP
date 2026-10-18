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

/* ------------------------------------------------------------ shell (busca e notificações) */

export interface ResultadoBusca {
  tipo: 'usuario'
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
