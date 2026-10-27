import { sql, type Kysely } from 'kysely'

/*
 * Juntar os lotes da MESMA COLETA (pedido do usuário, 22/10/2026: "Se houver mais de um lote do
 * mesmo cliente, mesmo endereço de coleta e mesma data, todos os lotes a partir do segundo devem
 * ser juntados ao primeiro lote criado ... Deve ficar como se fosse apenas 1 lote"; vale também
 * para os do Gerenciamento e do MSDC).
 *  - ordens.juntado_a — o lote principal (o primeiro criado) em que este foi juntado; null = é um
 *    lote "de verdade" nas listas. Cada pedido guarda a sua linha (as integrações seguem lote a
 *    lote); as telas mostram só o principal, com tudo somado.
 * A view `ordens_lista` é refeita (o PostgreSQL fixa as colunas da view na criação).
 */

const VIEW_ANTERIOR = sql`
  create view ordens_lista as
  select
    o.*,
    coalesce(o.externo_sistema, 'IERP') as origem,
    c.nome as cliente_nome,
    c.sla_dias as cliente_sla_dias,
    c.sistema_processamento as cliente_sistema,
    c.dias_parado_etapa as cliente_dias_parado,
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

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`drop view ordens_lista`.execute(db)
  await db.schema.alterTable('ordens').addColumn('juntado_a', 'text').execute()
  await db.schema.createIndex('ordens_juntado_a_idx').on('ordens').column('juntado_a').execute()
  await VIEW_ANTERIOR.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop view ordens_lista`.execute(db)
  await db.schema.dropIndex('ordens_juntado_a_idx').execute()
  await db.schema.alterTable('ordens').dropColumn('juntado_a').execute()
  await VIEW_ANTERIOR.execute(db)
}
