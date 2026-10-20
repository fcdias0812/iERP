import { sql, type Kysely } from 'kysely'

/*
 * Lotes que NASCEM num sistema de fora (pedido do usuário, 20/10/2026 — começa pelo
 * Gerenciamento de Projetos: ele cria a ordem, recebe e emite o COD; o iERP só mostra):
 *  - ordens.externo_sistema / externo_id — de qual sistema o lote veio e o id dele lá (único
 *    por sistema: a sincronização nunca cria o mesmo lote duas vezes);
 *  - ordens.externo_dados — o que o sistema de fora disse da ordem (JSON, só para mostrar);
 *  - integracoes.sincronizacao — o resumo da última leitura (coletas, ligadas, pendências).
 * A view `ordens_lista` é refeita com a coluna `origem` (o PostgreSQL fixa as colunas da view na
 * criação).
 */

/** A view de antes (para o `down`). */
const VIEW_ANTERIOR = sql`
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

/** `origem`: IERP (agendado aqui) ou o código do sistema de onde o lote veio — filtro das listas. */
const VIEW = sql`
  create view ordens_lista as
  select
    o.*,
    coalesce(o.externo_sistema, 'IERP') as origem,
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

const COLUNAS = ['externo_sistema', 'externo_id', 'externo_dados'] as const

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`drop view ordens_lista`.execute(db)
  for (const coluna of COLUNAS)
    await db.schema.alterTable('ordens').addColumn(coluna, 'text').execute()
  await db.schema
    .createIndex('ordens_externo_idx')
    .on('ordens')
    .columns(['externo_sistema', 'externo_id'])
    .unique()
    .execute()
  await VIEW.execute(db)
  await db.schema.alterTable('integracoes').addColumn('sincronizacao', 'text').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('integracoes').dropColumn('sincronizacao').execute()
  await sql`drop view ordens_lista`.execute(db)
  await db.schema.dropIndex('ordens_externo_idx').execute()
  for (const coluna of [...COLUNAS].reverse())
    await db.schema.alterTable('ordens').dropColumn(coluna).execute()
  await VIEW_ANTERIOR.execute(db)
}
