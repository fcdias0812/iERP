import { randomUUID } from 'node:crypto'
import type { Transaction } from 'kysely'
import type { Db } from '../db/database.js'
import type { Database } from '../db/schema.js'
import type { EventoHistorico, Mudanca } from './historico.js'

/*
 * Histórico ÚNICO (tabela `historico`) dos cadastros de Relacionamento: transportadoras,
 * motoristas e veículos. Cada evento aponta a entidade e o registro.
 */

export type Entidade =
  | 'transportadora'
  | 'motorista'
  | 'veiculo'
  | 'ordem'
  | 'material'
  | 'area'
  | 'recipiente'
  | 'perfil'
  | 'integracao'
type Conexao = Db | Transaction<Database>

export async function registrarHistorico(
  cx: Conexao,
  entidade: Entidade,
  registroId: string,
  evento: Omit<EventoHistorico, 'id'>,
) {
  await cx
    .insertInto('historico')
    .values({
      id: randomUUID(),
      entidade,
      registroId,
      autor: evento.autor,
      em: evento.em,
      acao: evento.acao,
      mudancas: evento.mudancas ? JSON.stringify(evento.mudancas) : null,
      nota: evento.nota ?? null,
    })
    .execute()
}

export async function listarHistorico(
  cx: Conexao,
  entidade: Entidade,
  registroId: string,
): Promise<EventoHistorico[]> {
  const linhas = await cx
    .selectFrom('historico')
    .selectAll()
    .where('entidade', '=', entidade)
    .where('registroId', '=', registroId)
    .orderBy('em', 'desc')
    .orderBy('id', 'desc')
    .execute()
  return linhas.map((h) => ({
    id: h.id,
    autor: h.autor,
    em: h.em,
    acao: h.acao as EventoHistorico['acao'],
    ...(h.mudancas ? { mudancas: JSON.parse(h.mudancas) as Mudanca[] } : {}),
    ...(h.nota ? { nota: h.nota } : {}),
  }))
}
