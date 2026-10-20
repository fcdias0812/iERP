import type { Kysely } from 'kysely'

/*
 * Estoque › Histórico (pedido do usuário, 20/10/2026: "Crie também a aba histórico do estoque.
 * Faça algo igual as outras de histórico"). Os três sistemas de estoque só mandam a lista de
 * AGORA; o iERP compara cada leitura com a anterior (decisão dele) e registra o que mudou:
 *  - estoque_itens   — o último retrato de cada item (por sistema), para comparar;
 *  - estoque_eventos — entrou, saiu ou mudou (campo, antes, depois), com o momento da leitura.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('estoque_itens')
    // ARMAZEM | NOTEBOOKS | RTB_WMS
    .addColumn('sistema', 'text', (c) => c.notNull())
    .addColumn('item_id', 'text', (c) => c.notNull())
    // materiais | assets | pecas | ecommerce
    .addColumn('aba', 'text', (c) => c.notNull())
    .addColumn('codigo', 'text', (c) => c.notNull())
    .addColumn('descricao', 'text')
    // Os campos acompanhados (JSON).
    .addColumn('campos', 'text', (c) => c.notNull())
    // Ainda no estoque de lá? (0/1)
    .addColumn('ativo', 'integer', (c) => c.notNull())
    .addColumn('visto_em', 'text', (c) => c.notNull())
    .addPrimaryKeyConstraint('estoque_itens_pk', ['sistema', 'item_id'])
    .execute()

  await db.schema
    .createTable('estoque_eventos')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('sistema', 'text', (c) => c.notNull())
    .addColumn('item_id', 'text', (c) => c.notNull())
    .addColumn('aba', 'text', (c) => c.notNull())
    .addColumn('codigo', 'text', (c) => c.notNull())
    .addColumn('descricao', 'text')
    // entrada | saida | alterado
    .addColumn('acao', 'text', (c) => c.notNull())
    // [{ campo, antes, depois }] (JSON; códigos — a tela traduz)
    .addColumn('mudancas', 'text')
    // Rótulos de lá dos códigos que aparecem (estados do armazém, nos 3 idiomas) (JSON).
    .addColumn('rotulos', 'text')
    .addColumn('em', 'text', (c) => c.notNull())
    .execute()
  await db.schema.createIndex('estoque_eventos_em_idx').on('estoque_eventos').column('em').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('estoque_eventos').execute()
  await db.schema.dropTable('estoque_itens').execute()
}
