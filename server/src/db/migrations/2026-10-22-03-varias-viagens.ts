import { sql, type Kysely } from 'kysely'

/*
 * Mais de uma viagem por lote (pedido do usuário, 22/10/2026: "em um único lote, criar mais de
 * uma viagem (vários caminhões podem ir fazer essa viagem ao mesmo tempo)") e a viagem pelo
 * APARELHO de GPS do caminhão ("utilize o mesmo método no 1.0").
 *  - ordens_viagens deixa de ser uma por lote (o índice único vira comum);
 *  - numero — o caminhão do lote (1, 2, 3…);
 *  - motorista_id / placa_informada — quem a Re-Teck escalou para ESTE caminhão (o que o
 *    rastreador conta fica em motorista_nome / placa, como antes);
 *  - origem — celular (app do motorista, pelo ReTeckTracker) | aparelho (rastreador no caminhão,
 *    lido do servidor de GPS); rastreador_id — o aparelho.
 * As viagens que já existem viram o caminhão 1, com o motorista e a placa do lote.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('ordens_viagens_ordem_idx').execute()
  await db.schema
    .createIndex('ordens_viagens_ordem_idx')
    .on('ordens_viagens')
    .column('ordem_id')
    .execute()
  await db.schema
    .alterTable('ordens_viagens')
    .addColumn('numero', 'integer', (c) => c.notNull().defaultTo(1))
    .execute()
  await db.schema.alterTable('ordens_viagens').addColumn('motorista_id', 'text').execute()
  await db.schema.alterTable('ordens_viagens').addColumn('placa_informada', 'text').execute()
  await db.schema
    .alterTable('ordens_viagens')
    .addColumn('origem', 'text', (c) => c.notNull().defaultTo('celular'))
    .execute()
  await db.schema.alterTable('ordens_viagens').addColumn('rastreador_id', 'text').execute()
  await sql`
    update ordens_viagens set
      motorista_id = (select o.motorista_id from ordens o where o.id = ordens_viagens.ordem_id),
      placa_informada = (select o.placa from ordens o where o.id = ordens_viagens.ordem_id)
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const coluna of ['rastreador_id', 'origem', 'placa_informada', 'motorista_id', 'numero'])
    await db.schema.alterTable('ordens_viagens').dropColumn(coluna).execute()
  await db.schema.dropIndex('ordens_viagens_ordem_idx').execute()
  await db.schema
    .createIndex('ordens_viagens_ordem_idx')
    .on('ordens_viagens')
    .column('ordem_id')
    .unique()
    .execute()
}
