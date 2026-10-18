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
  contatos: ContatoCliente[]
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
  historico: EventoHistorico[]
  acoesPermitidas: AcaoCliente[]
}

/** Dados enviados ao criar/editar. Exatamente um contato com `principal: true`. */
export interface ClienteInput {
  nome: string
  cnpj: string
  contatos: { nome?: string | null; email: string; telefone: string; principal: boolean }[]
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
