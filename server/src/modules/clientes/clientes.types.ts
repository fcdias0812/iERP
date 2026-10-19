import type { EventoHistorico } from '../../shared/historico.js'

/*
 * Contrato da API de clientes — espelho de src/services/types.ts do frontend (Clientes).
 * Mudou aqui? Mude lá também.
 * CNPJ e telefone vão SEM pontuação (a tela formata).
 */

export type ClienteStatus = 'ativo' | 'inativo'
export type AcaoCliente = 'inativar' | 'reativar'

export interface ContatoCliente {
  id: string
  nome: string | null
  email: string
  telefone: string
  principal: boolean
}

/** Linha da lista (resumo) — com o contato principal. */
export interface ClienteResumo {
  id: string
  codigo: string
  nome: string
  cnpj: string
  /** SLA: prazo máximo (dias) da chegada até o COD. */
  slaDias: number | null
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
  slaDias: number | null
  status: ClienteStatus
  contatos: ContatoCliente[]
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
  historico: EventoHistorico[]
  acoesPermitidas: AcaoCliente[]
}

/**
 * Dados enviados ao criar/editar. Exatamente um contato com `principal: true`.
 * Contato com `id` = já existente (mantém o vínculo, ex.: responsável por um site).
 */
export interface ClienteInput {
  nome: string
  cnpj: string
  slaDias?: number | null
  contatos: {
    id?: string | null
    nome?: string | null
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

export interface PaginaClientes {
  rows: ClienteResumo[]
  total: number
  totals: Record<string, number>
  facets: Record<string, Record<string, number>>
}

/* ------------------------------------------------------------ logística: sites e docas */

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

export interface SiteCliente {
  id: string
  codigo: string
  regiao: string | null
  horario: string | null
  totalGaylords: number | null
  /** Só dígitos. */
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
 * Criar/editar site. Responsável: um contato existente (`contatoId`) OU um contato novo
 * (`novoContato`, que entra também na lista de contatos do cliente) OU nenhum.
 */
export interface SiteInput {
  codigo: string
  regiao?: string | null
  horario?: string | null
  totalGaylords?: number | null
  cep?: string | null
  endereco?: string | null
  latitude?: number | null
  longitude?: number | null
  shredderProprio: boolean
  edgeSite: boolean
  contatoId?: string | null
  novoContato?: { nome?: string | null; email: string; telefone: string } | null
  docas: Omit<Doca, 'id'>[]
}

/* ------------------------------------------------------------ documentos */

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

/* ------------------------------------------------------------ lotes (visão geral) */

/**
 * Resumo dos lotes do cliente. Os lotes vêm dos sistemas de produção (integração ainda não
 * ligada): enquanto `conectado` for false, a tela mostra "sem dados".
 */
export interface LotesResumoCliente {
  conectado: boolean
  aChegar: number
  emOperacao: number
  finalizados: number
  /** Últimos lotes com atualização (até 5). */
  ultimos: { id: string; codigo: string; status: string; atualizadoEm: string }[]
}
