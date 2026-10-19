import type { Kysely } from 'kysely'

/*
 * Operação › Recebimento (pedido do usuário, 19/10/2026): o lote agendado é recebido na Re-Teck.
 *  - ordens_recebimentos — um por lote: data de recebimento (início do dia em SP, ISO), inspeção
 *    visual (bom | avaria | outro), descrição (LocalizedText em JSON, obrigatória em avaria/outro)
 *    e a ocorrência criada automaticamente para avaria/outro;
 *  - ordens_lacres e ordens_notas_fiscais — número (cada um com foto obrigatória);
 *  - ordens_recebimento_fotos — fotos dos lacres, notas, pallets e as gerais (`alvo` + `alvo_id`);
 *  - ordens_pallets ganha a tara (kg); o peso bruto continua em `peso_kg`.
 */

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('ordens_recebimentos')
    .addColumn('ordem_id', 'text', (c) =>
      c.primaryKey().references('ordens.id').onDelete('cascade'),
    )
    .addColumn('data_recebimento', 'text', (c) => c.notNull())
    .addColumn('inspecao', 'text', (c) => c.notNull())
    .addColumn('inspecao_descricao', 'text')
    .addColumn('ocorrencia_id', 'text')
    .addColumn('criado_em', 'text', (c) => c.notNull())
    .addColumn('criado_por', 'text', (c) => c.notNull())
    .addColumn('alterado_em', 'text', (c) => c.notNull())
    .addColumn('alterado_por', 'text', (c) => c.notNull())
    .execute()

  for (const tabela of ['ordens_lacres', 'ordens_notas_fiscais']) {
    await db.schema
      .createTable(tabela)
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('ordem_id', 'text', (c) => c.notNull().references('ordens.id').onDelete('cascade'))
      .addColumn('posicao', 'integer', (c) => c.notNull())
      .addColumn('numero', 'text', (c) => c.notNull())
      .execute()
    await db.schema.createIndex(`${tabela}_idx`).on(tabela).column('ordem_id').execute()
  }

  await db.schema
    .createTable('ordens_recebimento_fotos')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('ordem_id', 'text', (c) => c.notNull().references('ordens.id').onDelete('cascade'))
    // 'lacre' | 'nota' | 'pallet' | 'geral'
    .addColumn('alvo', 'text', (c) => c.notNull())
    // id do lacre/nota/pallet (null nas fotos gerais)
    .addColumn('alvo_id', 'text')
    .addColumn('posicao', 'integer', (c) => c.notNull())
    .addColumn('nome', 'text', (c) => c.notNull())
    .addColumn('extensao', 'text', (c) => c.notNull())
    .addColumn('tamanho', 'integer', (c) => c.notNull())
    .addColumn('enviado_em', 'text', (c) => c.notNull())
    .addColumn('enviado_por', 'text', (c) => c.notNull())
    .execute()
  await db.schema
    .createIndex('ordens_recebimento_fotos_idx')
    .on('ordens_recebimento_fotos')
    .columns(['ordem_id', 'alvo'])
    .execute()

  await db.schema.alterTable('ordens_pallets').addColumn('tara_kg', 'real').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('ordens_pallets').dropColumn('tara_kg').execute()
  await db.schema.dropTable('ordens_recebimento_fotos').execute()
  await db.schema.dropTable('ordens_notas_fiscais').execute()
  await db.schema.dropTable('ordens_lacres').execute()
  await db.schema.dropTable('ordens_recebimentos').execute()
}
