import type { Kysely } from 'kysely'

/*
 * EXCLUIR LOTE (pedido do usuário, 27/10/2026 — o mesmo do iERP 1.0): o lote agendado é apagado de
 * vez, mas fica o registro de quem excluiu e quando (Auditoria e históricos de módulo).
 *  - ordens_excluidas — uma linha por lote excluído (o id antigo, o número/código e o cliente). O
 *    número também segura a sequência: o LOT-00027 excluído nunca volta a ser usado por outro lote.
 */

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('ordens_excluidas')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('numero', 'integer', (c) => c.notNull())
    .addColumn('codigo', 'text', (c) => c.notNull())
    .addColumn('cliente_id', 'text', (c) => c.notNull().references('clientes.id'))
    .addColumn('excluido_em', 'text', (c) => c.notNull())
    .addColumn('excluido_por', 'text', (c) => c.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('ordens_excluidas').execute()
}
