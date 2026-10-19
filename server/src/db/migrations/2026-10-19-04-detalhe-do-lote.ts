import { sql, type Kysely } from 'kysely'

/*
 * Detalhe do lote (Ordens › Lotes e Operação › Lotes):
 *  - ordens_etapas — cada etapa por onde o lote passou e quando entrou nela (linha do tempo).
 *    Lotes existentes ganham a etapa "agendado" (criação) e, se já estiverem adiante, a atual.
 *  - ordens_pallets — pallets recebidos (peso, conteúdo, quem pesou, foto). Vêm da integração
 *    com outros sistemas ou, depois, de Operação › Recebimento; `origem` diz de onde veio.
 *  - ordens_ocorrencias — ocorrências na coleta, no trajeto ou no recebimento: categoria
 *    (código), texto em 3 idiomas (LocalizedText em JSON) e status registrada/cancelado.
 *  - ordens_ocorrencias_fotos — fotos das ocorrências (arquivo em disco pelo id).
 */

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('ordens_etapas')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('ordem_id', 'text', (c) => c.notNull().references('ordens.id').onDelete('cascade'))
    .addColumn('etapa', 'text', (c) => c.notNull())
    .addColumn('em', 'text', (c) => c.notNull())
    .addColumn('autor', 'text', (c) => c.notNull())
    .execute()
  await db.schema.createIndex('ordens_etapas_idx').on('ordens_etapas').column('ordem_id').execute()

  await sql`
    insert into ordens_etapas (id, ordem_id, etapa, em, autor)
    select 'etp-' || id || '-agendado', id, 'agendado', criado_em, criado_por from ordens
  `.execute(db)
  await sql`
    insert into ordens_etapas (id, ordem_id, etapa, em, autor)
    select 'etp-' || id || '-' || status, id, status, coalesce(etapa_desde, alterado_em), alterado_por
    from ordens where status <> 'agendado'
  `.execute(db)

  await db.schema
    .createTable('ordens_pallets')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('ordem_id', 'text', (c) => c.notNull().references('ordens.id').onDelete('cascade'))
    .addColumn('numero', 'integer', (c) => c.notNull())
    // kg
    .addColumn('peso_kg', 'real')
    .addColumn('conteudo', 'text')
    .addColumn('pesado_por', 'text')
    .addColumn('pesado_em', 'text')
    // Foto (opcional): extensão do arquivo em disco, gravado pelo id do pallet.
    .addColumn('foto_extensao', 'text')
    .addColumn('origem', 'text', (c) => c.notNull())
    .addColumn('criado_em', 'text', (c) => c.notNull())
    .execute()
  await db.schema
    .createIndex('ordens_pallets_idx')
    .on('ordens_pallets')
    .columns(['ordem_id', 'numero'])
    .unique()
    .execute()

  await db.schema
    .createTable('ordens_ocorrencias')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('ordem_id', 'text', (c) => c.notNull().references('ordens.id').onDelete('cascade'))
    .addColumn('numero', 'integer', (c) => c.notNull())
    // 'coleta' | 'trajeto' | 'recebimento'
    .addColumn('momento', 'text', (c) => c.notNull())
    .addColumn('categoria', 'text', (c) => c.notNull())
    // LocalizedText em JSON
    .addColumn('texto', 'text', (c) => c.notNull())
    // 'registrada' | 'cancelado'
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('criado_em', 'text', (c) => c.notNull())
    .addColumn('criado_por', 'text', (c) => c.notNull())
    .addColumn('alterado_em', 'text', (c) => c.notNull())
    .addColumn('alterado_por', 'text', (c) => c.notNull())
    .execute()
  await db.schema
    .createIndex('ordens_ocorrencias_idx')
    .on('ordens_ocorrencias')
    .columns(['ordem_id', 'numero'])
    .unique()
    .execute()

  await db.schema
    .createTable('ordens_ocorrencias_fotos')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('ocorrencia_id', 'text', (c) =>
      c.notNull().references('ordens_ocorrencias.id').onDelete('cascade'),
    )
    // Ordem de exibição (a ordem em que foram enviadas).
    .addColumn('posicao', 'integer', (c) => c.notNull())
    .addColumn('nome', 'text', (c) => c.notNull())
    .addColumn('extensao', 'text', (c) => c.notNull())
    .addColumn('tamanho', 'integer', (c) => c.notNull())
    .addColumn('enviado_em', 'text', (c) => c.notNull())
    .addColumn('enviado_por', 'text', (c) => c.notNull())
    .execute()
  await db.schema
    .createIndex('ordens_ocorrencias_fotos_idx')
    .on('ordens_ocorrencias_fotos')
    .column('ocorrencia_id')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('ordens_ocorrencias_fotos').execute()
  await db.schema.dropTable('ordens_ocorrencias').execute()
  await db.schema.dropTable('ordens_pallets').execute()
  await db.schema.dropTable('ordens_etapas').execute()
}
