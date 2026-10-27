import type { Kysely } from 'kysely'

/*
 * Tipos de documento do lote por cliente (pedido do usuário, 22/10/2026: "Nas configurações do
 * cliente, adicionar os tipos de documentos que ele aceita colocar nos documentos do lote" e o
 * relatório final com os documentos marcados). Decisão dele: lista ÚNICA (os de hoje + tipos
 * novos criados ali mesmo) e, para cada cliente, "aceita" e "vai no relatório final".
 *  - tipos_documento — o catálogo: os do sistema (nome = null, o rótulo vem da tradução) e os
 *    criados pela tela (nome em LocalizedText JSON);
 *  - clientes_tipos_documento — por cliente: aceita (0/1) e relatorio (0/1). Sem linha: os do
 *    sistema são aceitos e nenhum vai no relatório (como era antes).
 */
const DO_SISTEMA = ['escopo', 'nota_fiscal', 'mtr', 'cdf', 'foto', 'outro']

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('tipos_documento')
    .addColumn('codigo', 'text', (c) => c.primaryKey())
    .addColumn('nome', 'text')
    // Busca/único: o nome original sem acento e em minúsculas.
    .addColumn('nome_busca', 'text')
    .addColumn('ordem', 'integer', (c) => c.notNull())
    .addColumn('criado_em', 'text', (c) => c.notNull())
    .addColumn('criado_por', 'text', (c) => c.notNull())
    .execute()
  const agora = new Date().toISOString()
  await db
    .insertInto('tipos_documento' as never)
    .values(
      DO_SISTEMA.map((codigo, i) => ({
        codigo,
        nome: null,
        nome_busca: null,
        ordem: i + 1,
        criado_em: agora,
        criado_por: 'Sistema',
      })) as never,
    )
    .execute()

  await db.schema
    .createTable('clientes_tipos_documento')
    .addColumn('cliente_id', 'text', (c) =>
      c.notNull().references('clientes.id').onDelete('cascade'),
    )
    .addColumn('tipo_codigo', 'text', (c) => c.notNull())
    .addColumn('aceita', 'integer', (c) => c.notNull())
    .addColumn('relatorio', 'integer', (c) => c.notNull())
    .addPrimaryKeyConstraint('clientes_tipos_documento_pk', ['cliente_id', 'tipo_codigo'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('clientes_tipos_documento').execute()
  await db.schema.dropTable('tipos_documento').execute()
}
