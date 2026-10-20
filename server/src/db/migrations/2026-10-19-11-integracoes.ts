import { sql, type Kysely } from 'kysely'

/*
 * Integrações com os sistemas de processamento (pedido do usuário, 19/10/2026 — começa pela
 * Dell, processada no MoonShot). O iERP novo fala o MESMO contrato do iERP antigo
 * (`/api/integracao/v1/...`), e os dois funcionam juntos até o novo substituir o antigo:
 *  - integracoes — um sistema de fora: a CHAVE dele (só o hash; o começo para reconhecer),
 *    para onde vão os avisos e de onde se lê o painel de andamento;
 *  - integracoes_avisos — fila dos avisos ("olha o lote LOT-00001") que o sistema de fora
 *    busca depois com a chave; reenviada quando ele está fora do ar;
 *  - ordens_balancos — o último balanço de massa que o sistema de fora mandou (retrato: o
 *    último vence);
 *  - ordens: o andamento do processamento lá fora ("Processamento 2/4 · Leitura das peças")
 *    e o pedido de devolução ao recebimento;
 *  - ordens_anexos.numero — o contrato identifica o anexo por NÚMERO (o id aqui é UUID).
 * A view `ordens_lista` é refeita (o PostgreSQL fixa as colunas da view na criação).
 */

const VIEW = sql`
  create view ordens_lista as
  select
    o.*,
    c.nome as cliente_nome,
    c.sla_dias as cliente_sla_dias,
    s.codigo as site_codigo,
    d.numero as doca_numero,
    t.nome as transportadora_nome,
    m.nome as motorista_nome,
    coalesce(o.qtd_pallets, 0) + coalesce(o.qtd_gaylords, 0) + coalesce(o.qtd_racks, 0)
      as total_volumes
  from ordens o
  join clientes c on c.id = o.cliente_id
  join clientes_sites s on s.id = o.site_id
  join clientes_docas d on d.id = o.doca_id
  left join transportadoras t on t.id = o.transportadora_id
  left join motoristas m on m.id = o.motorista_id
`

const COLUNAS_ORDEM = [
  'processamento_sistema',
  'processamento_etapa',
  'processamento_indice',
  'processamento_total',
  'processamento_desde',
  'processamento_url',
  'processamento_atualizado_em',
  'devolucao_motivo',
  'devolucao_pedido_por',
  'devolucao_em',
] as const

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('integracoes')
    .addColumn('id', 'text', (c) => c.primaryKey())
    // Código do sistema (MOONSHOT): é o `destino` que vai nos pallets do contrato.
    .addColumn('sistema', 'text', (c) => c.notNull().unique())
    .addColumn('nome', 'text', (c) => c.notNull())
    .addColumn('chave_hash', 'text')
    .addColumn('chave_prefixo', 'text')
    .addColumn('chave_criada_em', 'text')
    .addColumn('url_avisos', 'text')
    .addColumn('url_painel', 'text')
    .addColumn('token_painel', 'text')
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('ultimo_uso_em', 'text')
    .addColumn('ultimo_aviso_em', 'text')
    .addColumn('ultimo_painel_em', 'text')
    .addColumn('ultimo_erro', 'text')
    .addColumn('ultimo_erro_em', 'text')
    .addColumn('criado_em', 'text', (c) => c.notNull())
    .addColumn('criado_por', 'text', (c) => c.notNull())
    .addColumn('alterado_em', 'text', (c) => c.notNull())
    .addColumn('alterado_por', 'text', (c) => c.notNull())
    .execute()

  await db.schema
    .createTable('integracoes_avisos')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('integracao_id', 'text', (c) =>
      c.notNull().references('integracoes.id').onDelete('cascade'),
    )
    .addColumn('ordem_id', 'text', (c) => c.notNull().references('ordens.id').onDelete('cascade'))
    .addColumn('codigo', 'text', (c) => c.notNull())
    .addColumn('evento', 'text', (c) => c.notNull())
    .addColumn('tentativas', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('proxima_em', 'text', (c) => c.notNull())
    .addColumn('erro', 'text')
    .addColumn('criado_em', 'text', (c) => c.notNull())
    .addColumn('enviado_em', 'text')
    .execute()
  await db.schema
    .createIndex('integracoes_avisos_pendentes_idx')
    .on('integracoes_avisos')
    .columns(['enviado_em', 'proxima_em'])
    .execute()

  await db.schema
    .createTable('ordens_balancos')
    .addColumn('ordem_id', 'text', (c) =>
      c.primaryKey().references('ordens.id').onDelete('cascade'),
    )
    .addColumn('sistema', 'text', (c) => c.notNull())
    .addColumn('payload', 'text', (c) => c.notNull())
    .addColumn('recebido_em', 'text', (c) => c.notNull())
    .execute()

  await db.schema.alterTable('ordens_anexos').addColumn('numero', 'integer').execute()
  // Numera os anexos que já existem na ordem em que foram enviados.
  const { rows } = await sql<{ id: string }>`select id from ordens_anexos
    order by enviado_em, id`.execute(db)
  let n = 0
  for (const a of rows)
    await sql`update ordens_anexos set numero = ${++n} where id = ${a.id}`.execute(db)
  await db.schema
    .createIndex('ordens_anexos_numero_idx')
    .on('ordens_anexos')
    .column('numero')
    .unique()
    .execute()

  await sql`drop view ordens_lista`.execute(db)
  for (const coluna of COLUNAS_ORDEM)
    await db.schema
      .alterTable('ordens')
      .addColumn(
        coluna,
        coluna === 'processamento_indice' || coluna === 'processamento_total' ? 'integer' : 'text',
      )
      .execute()
  await VIEW.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop view ordens_lista`.execute(db)
  for (const coluna of [...COLUNAS_ORDEM].reverse())
    await db.schema.alterTable('ordens').dropColumn(coluna).execute()
  await VIEW.execute(db)
  await db.schema.dropIndex('ordens_anexos_numero_idx').execute()
  await db.schema.alterTable('ordens_anexos').dropColumn('numero').execute()
  await db.schema.dropTable('ordens_balancos').execute()
  await db.schema.dropTable('integracoes_avisos').execute()
  await db.schema.dropTable('integracoes').execute()
}
