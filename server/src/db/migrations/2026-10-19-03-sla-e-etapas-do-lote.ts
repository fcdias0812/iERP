import { sql, type Kysely } from 'kysely'

/*
 * Dashboard da Operação:
 *  - clientes.sla_dias — prazo máximo (dias) da chegada na Re-Teck até o COD (opcional);
 *  - etapas do lote (status da ordem): agendado → inspecao (recebido) → processo →
 *    aguardando_cod → concluido (COD emitido). Datas: recebido_em (início do SLA),
 *    etapa_desde (entrou na etapa atual) e cod_emitido_em. Hoje quem muda a etapa será a
 *    integração com os sistemas de produção (ainda não existe).
 * As views são recriadas para incluir as colunas novas (o PostgreSQL fixa as colunas da view).
 */

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('clientes').addColumn('sla_dias', 'integer').execute()
  await db.schema.alterTable('ordens').addColumn('recebido_em', 'text').execute()
  await db.schema.alterTable('ordens').addColumn('etapa_desde', 'text').execute()
  await db.schema.alterTable('ordens').addColumn('cod_emitido_em', 'text').execute()
  await db.schema.createIndex('ordens_status_idx').on('ordens').column('status').execute()

  await sql`drop view clientes_lista`.execute(db)
  await sql`
    create view clientes_lista as
    select
      c.id, c.numero, c.codigo, c.nome, c.cnpj, c.sla_dias, c.status, c.busca,
      c.criado_em, c.criado_por, c.alterado_em, c.alterado_por,
      p.nome as contato_nome,
      p.email as contato_email,
      p.telefone as contato_telefone,
      (select count(*) from clientes_contatos x where x.cliente_id = c.id) as contatos
    from clientes c
    left join clientes_contatos p on p.cliente_id = c.id and p.principal = 1
  `.execute(db)

  await sql`drop view ordens_lista`.execute(db)
  await sql`
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
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop view ordens_lista`.execute(db)
  await sql`
    create view ordens_lista as
    select
      o.*,
      c.nome as cliente_nome,
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
  `.execute(db)
  await sql`drop view clientes_lista`.execute(db)
  await sql`
    create view clientes_lista as
    select
      c.id, c.numero, c.codigo, c.nome, c.cnpj, c.status, c.busca,
      c.criado_em, c.criado_por, c.alterado_em, c.alterado_por,
      p.nome as contato_nome,
      p.email as contato_email,
      p.telefone as contato_telefone,
      (select count(*) from clientes_contatos x where x.cliente_id = c.id) as contatos
    from clientes c
    left join clientes_contatos p on p.cliente_id = c.id and p.principal = 1
  `.execute(db)
  await db.schema.dropIndex('ordens_status_idx').execute()
  await db.schema.alterTable('ordens').dropColumn('cod_emitido_em').execute()
  await db.schema.alterTable('ordens').dropColumn('etapa_desde').execute()
  await db.schema.alterTable('ordens').dropColumn('recebido_em').execute()
  await db.schema.alterTable('clientes').dropColumn('sla_dias').execute()
}
