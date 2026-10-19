import { sql, type Kysely } from 'kysely'

/*
 * Coleta prevista passa a ser OBRIGATÓRIA e a data de coleta, OPCIONAL (pedido do usuário,
 * 19/10/2026): todo lote nasce com a data prevista; a data de coleta é a confirmada (no
 * Forecast: prevista = borda tracejada, confirmada = contínua).
 *
 * Nem o SQLite nem o Kysely tiram o NOT NULL de uma coluna de forma portável — então as duas
 * colunas trocam de NOME (RENAME COLUMN existe nos dois bancos): a obrigatória `data_coleta`
 * vira `coleta_prevista` e a opcional `coleta_prevista` vira `data_coleta`. Depois, os valores:
 * a data de coleta de antes (marcada) continua sendo a data de coleta; a prevista fica a de
 * antes ou, sem ela, a própria data de coleta. A view `ordens_lista` é refeita em volta.
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

/** Troca os nomes das colunas `data_coleta` e `coleta_prevista` (com a view fora). */
async function trocarNomes(db: Kysely<unknown>) {
  await sql`drop view ordens_lista`.execute(db)
  const tabela = db.schema.alterTable('ordens')
  await tabela.renameColumn('coleta_prevista', 'coleta_troca').execute()
  await tabela.renameColumn('data_coleta', 'coleta_prevista').execute()
  await tabela.renameColumn('coleta_troca', 'data_coleta').execute()
}

export async function up(db: Kysely<unknown>): Promise<void> {
  await trocarNomes(db)
  // Agora: coleta_prevista (obrigatória) = data de coleta de antes; data_coleta = prevista de antes.
  // O lado direito do SET usa os valores de ANTES da linha (SQLite e PostgreSQL).
  await sql`update ordens set
    data_coleta = coleta_prevista,
    coleta_prevista = coalesce(data_coleta, coleta_prevista)`.execute(db)
  await VIEW.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await trocarNomes(db)
  // Volta: data_coleta (obrigatória) = a confirmada ou, sem ela, a prevista.
  await sql`update ordens set
    data_coleta = coalesce(coleta_prevista, data_coleta),
    coleta_prevista = data_coleta`.execute(db)
  await VIEW.execute(db)
}
