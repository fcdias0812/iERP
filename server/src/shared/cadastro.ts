import { sql, type Transaction } from 'kysely'
import type { Db } from '../db/database.js'
import type { Database } from '../db/schema.js'
import { ErroApi } from './erros.js'
import type { Mudanca } from './historico.js'

/* Ajudantes comuns dos cadastros (código sequencial, histórico, ativo/inativo). */

type Conexao = Db | Transaction<Database>

/** Próximo número sequencial da tabela (gera o código: TRA-00001, MOT-00001, VEI-00001). */
export async function proximoNumero(
  cx: Conexao,
  tabela: 'transportadoras' | 'motoristas' | 'veiculos',
): Promise<number> {
  const r = await cx
    .selectFrom(tabela)
    .select(sql<number | null>`max(numero)`.as('n'))
    .executeTakeFirstOrThrow()
  return Number(r.n ?? 0) + 1
}

export const codigoCom = (prefixo: string, numero: number) =>
  `${prefixo}-${String(numero).padStart(5, '0')}`

/** Antes → depois só dos campos que mudaram. */
export function mudancasEntre<T extends Record<string, unknown>>(
  antes: T,
  depois: Partial<T>,
  campos: readonly (keyof T & string)[],
): Mudanca[] {
  return campos
    .filter((k) => k in depois && (antes[k] ?? null) !== (depois[k] ?? null))
    .map((k) => ({
      campo: k,
      antes: (antes[k] ?? null) as Mudanca['antes'],
      depois: (depois[k] ?? null) as Mudanca['depois'],
    }))
}

/** Fluxo simples: Ativo ⇄ Inativo (o registro não é excluído; o histórico fica). */
export type StatusCadastro = 'ativo' | 'inativo'
export type AcaoCadastro = 'inativar' | 'reativar'

export const acoesCadastro = (status: StatusCadastro): AcaoCadastro[] =>
  status === 'ativo' ? ['inativar'] : ['reativar']

export function destinoDe(status: StatusCadastro, acao: unknown): StatusCadastro {
  if (status === 'ativo' && acao === 'inativar') return 'inativo'
  if (status === 'inativo' && acao === 'reativar') return 'ativo'
  throw new ErroApi(
    409,
    'invalid_transition',
    `Ação "${String(acao)}" não é permitida no status atual.`,
  )
}

/** Ordem do fluxo para ordenar a coluna status (= flowOrder do statusMap do frontend). */
export const ORDEM_STATUS = { ativo: 130, inativo: 420 }
