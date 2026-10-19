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
  acao:
    | 'criado'
    | 'editado'
    | 'status'
    | 'site_criado'
    | 'site_editado'
    | 'site_removido'
    | 'documento_adicionado'
    | 'documento_removido'
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

/**
 * Dados enviados ao criar/editar. Exatamente um contato com `principal: true`.
 * Contato com `id` = já existente (mantém o vínculo, ex.: responsável por um site).
 */
export interface ClienteInput {
  nome: string
  cnpj: string
  contatos: {
    id: string | null
    nome: string | null
    email: string
    telefone: string
    principal: boolean
  }[]
}

export interface ClientesResumo {
  total: number
  ativos: number
  inativos: number
}

export type PaginaClientes = TablePage<ClienteResumo> & {
  facets: Record<string, Record<string, number>>
}

/** Doca de um site. Medidas em metros (m) e metros quadrados (m²). */
export interface Doca {
  id: string
  numero: string
  alturaMaxCaminhao: number
  comprimentoMaxCaminhao: number | null
  dockLeveler: boolean
  tailLift: boolean
  areaLift: number | null
  espaco: number | null
  altura: number | null
  voltagemShredder: number | null
  pisoProtecaoObrigatorio: boolean
}

/** Site do cliente (Logística). CEP só com dígitos. */
export interface SiteCliente {
  id: string
  codigo: string
  regiao: string | null
  horario: string | null
  totalGaylords: number | null
  cep: string | null
  endereco: string | null
  latitude: number | null
  longitude: number | null
  shredderProprio: boolean
  edgeSite: boolean
  /** Contato do cliente responsável pelo site (null = sem responsável). */
  responsavel: ContatoCliente | null
  docas: Doca[]
  criadoEm: string
  alteradoEm: string
}

/**
 * Criar/editar site. Responsável: contato existente (`contatoId`) OU contato novo
 * (`novoContato`, que entra também na lista de contatos do cliente) OU nenhum.
 */
export interface SiteInput {
  codigo: string
  regiao: string | null
  horario: string | null
  totalGaylords: number | null
  cep: string | null
  endereco: string | null
  latitude: number | null
  longitude: number | null
  shredderProprio: boolean
  edgeSite: boolean
  contatoId: string | null
  novoContato: { nome: string | null; email: string; telefone: string } | null
  docas: Omit<Doca, 'id'>[]
}

export type TipoDocumento = 'contrato' | 'fiscal' | 'licenca' | 'outro'

export interface DocumentoCliente {
  id: string
  tipo: TipoDocumento
  nome: string
  extensao: string
  /** Bytes. */
  tamanho: number
  enviadoEm: string
  enviadoPor: string
}

/**
 * Resumo dos lotes do cliente (Visão geral). Os lotes vêm dos sistemas de produção:
 * enquanto `conectado` for false, a tela mostra "sem dados".
 */
export interface LotesResumoCliente {
  conectado: boolean
  aChegar: number
  emOperacao: number
  finalizados: number
  /** Últimos lotes com atualização (até 5). */
  ultimos: { id: string; codigo: string; status: string; atualizadoEm: string }[]
}

/** CEP → endereço (ViaCEP, pelo servidor). */
export interface EnderecoCep {
  cep: string
  logradouro: string
  bairro: string
  cidade: string
  uf: string
  regiao: string
  endereco: string
}

/** Endereço → coordenadas (mapa, pelo servidor). */
export interface Coordenadas {
  latitude: number
  longitude: number
  descricao: string
  /** `cidade` = só achou a cidade: ponto aproximado, pedir para ajustar o pino. */
  precisao: 'endereco' | 'cidade'
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
