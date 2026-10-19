import { sql, type Kysely } from 'kysely'

/*
 * Ordens (Agendamento): cada ordem é um LOTE agendado (código LOT-00001). Cliente, site, doca e
 * data de coleta obrigatórios; o resto opcional. Serviços e sim/não em 0/1; datas de coleta/chegada como o
 * início do dia no fuso da empresa (ISO UTC), para os filtros por dia funcionarem.
 * Anexos da OS em `ordens_anexos` (seção 'escopo' ou 'observacoes'); arquivo em disco.
 * O pré-cálculo do momento da criação fica guardado em `calculo` (JSON em texto).
 *
 * Veículos: a partir daqui, volume mínimo/máximo são QUANTIDADE DE VOLUMES (pallets +
 * gaylords + racks), não m² (decisão do usuário). As colunas não mudam de tipo.
 */

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('ordens')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('numero', 'integer', (c) => c.notNull().unique())
    .addColumn('codigo', 'text', (c) => c.notNull().unique())
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('cliente_id', 'text', (c) => c.notNull().references('clientes.id'))
    .addColumn('site_id', 'text', (c) => c.notNull().references('clientes_sites.id'))
    .addColumn('doca_id', 'text', (c) => c.notNull().references('clientes_docas.id'))
    .addColumn('transportadora_id', 'text', (c) => c.references('transportadoras.id'))
    .addColumn('referencia_cliente', 'text')
    .addColumn('data_coleta', 'text', (c) => c.notNull())
    .addColumn('coleta_prevista', 'text')
    .addColumn('data_chegada', 'text')
    .addColumn('rastrear', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('motorista_id', 'text', (c) => c.references('motoristas.id'))
    .addColumn('placa', 'text')
    // Serviços (0/1)
    .addColumn('psm', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('onsite_shredding', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('recycle_only', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('value_recovery_racks', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('value_recovery_itad', 'integer', (c) => c.notNull().defaultTo(0))
    // Quantidades
    .addColumn('qtd_boxes', 'integer')
    .addColumn('qtd_pallets', 'integer')
    .addColumn('qtd_gaylords', 'integer')
    .addColumn('qtd_racks', 'integer')
    .addColumn('placas_policarbonato', 'integer')
    .addColumn('requer_pallets_vazios', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('qtd_pallets_vazios', 'integer')
    .addColumn('itens_mais25kg', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('fator_limitante', 'text')
    // Anexos da OS (texto livre; os arquivos ficam em ordens_anexos)
    .addColumn('escopo', 'text')
    .addColumn('observacoes', 'text')
    .addColumn('calculo', 'text')
    .addColumn('busca', 'text', (c) => c.notNull())
    .addColumn('criado_em', 'text', (c) => c.notNull())
    .addColumn('criado_por', 'text', (c) => c.notNull())
    .addColumn('alterado_em', 'text', (c) => c.notNull())
    .addColumn('alterado_por', 'text', (c) => c.notNull())
    .execute()
  await db.schema.createIndex('ordens_cliente_idx').on('ordens').column('cliente_id').execute()

  await db.schema
    .createTable('ordens_anexos')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('ordem_id', 'text', (c) => c.notNull().references('ordens.id').onDelete('cascade'))
    // 'escopo' | 'observacoes'
    .addColumn('secao', 'text', (c) => c.notNull())
    .addColumn('nome', 'text', (c) => c.notNull())
    .addColumn('extensao', 'text', (c) => c.notNull())
    .addColumn('tamanho', 'integer', (c) => c.notNull())
    .addColumn('enviado_em', 'text', (c) => c.notNull())
    .addColumn('enviado_por', 'text', (c) => c.notNull())
    .execute()
  await db.schema
    .createIndex('ordens_anexos_idx')
    .on('ordens_anexos')
    .columns(['ordem_id', 'secao'])
    .execute()

  /* ---------------- lista (nomes de cliente, site, doca, transportadora e motorista) */
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
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop view ordens_lista`.execute(db)
  await db.schema.dropTable('ordens_anexos').execute()
  await db.schema.dropTable('ordens').execute()
}
