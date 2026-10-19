import type { Kysely } from 'kysely'

/*
 * Clientes › Logística (sites e docas) e Documentos. Tipos portáveis (SQLite e PostgreSQL):
 * medidas em `double precision`, sim/não 0/1, datas em texto ISO UTC.
 */

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('clientes_sites')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('cliente_id', 'text', (c) =>
      c.notNull().references('clientes.id').onDelete('cascade'),
    )
    .addColumn('codigo', 'text', (c) => c.notNull())
    .addColumn('regiao', 'text')
    .addColumn('horario', 'text')
    .addColumn('total_gaylords', 'integer')
    // Só dígitos.
    .addColumn('cep', 'text')
    .addColumn('endereco', 'text')
    .addColumn('latitude', 'double precision')
    .addColumn('longitude', 'double precision')
    .addColumn('shredder_proprio', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('edge_site', 'integer', (c) => c.notNull().defaultTo(0))
    // Contato do próprio cliente; se o contato sair da lista, o site fica sem responsável.
    .addColumn('contato_responsavel_id', 'text', (c) =>
      c.references('clientes_contatos.id').onDelete('set null'),
    )
    .addColumn('criado_em', 'text', (c) => c.notNull())
    .addColumn('criado_por', 'text', (c) => c.notNull())
    .addColumn('alterado_em', 'text', (c) => c.notNull())
    .addColumn('alterado_por', 'text', (c) => c.notNull())
    .execute()
  // Código do site é único dentro do cliente.
  await db.schema
    .createIndex('clientes_sites_codigo_idx')
    .on('clientes_sites')
    .columns(['cliente_id', 'codigo'])
    .unique()
    .execute()

  await db.schema
    .createTable('clientes_docas')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('site_id', 'text', (c) =>
      c.notNull().references('clientes_sites.id').onDelete('cascade'),
    )
    .addColumn('numero', 'text', (c) => c.notNull())
    .addColumn('altura_max_caminhao', 'double precision', (c) => c.notNull())
    .addColumn('comprimento_max_caminhao', 'double precision')
    .addColumn('dock_leveler', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('tail_lift', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('area_lift', 'double precision')
    .addColumn('espaco', 'double precision')
    .addColumn('altura', 'double precision')
    .addColumn('voltagem_shredder', 'integer')
    .addColumn('piso_protecao_obrigatorio', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('ordem', 'integer', (c) => c.notNull())
    .execute()
  await db.schema
    .createIndex('clientes_docas_site_idx')
    .on('clientes_docas')
    .columns(['site_id', 'ordem'])
    .execute()

  await db.schema
    .createTable('clientes_documentos')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('cliente_id', 'text', (c) =>
      c.notNull().references('clientes.id').onDelete('cascade'),
    )
    .addColumn('tipo', 'text', (c) => c.notNull())
    // Nome original do arquivo (exibido); o arquivo em disco usa o id.
    .addColumn('nome', 'text', (c) => c.notNull())
    .addColumn('extensao', 'text', (c) => c.notNull())
    .addColumn('tamanho', 'integer', (c) => c.notNull())
    .addColumn('enviado_em', 'text', (c) => c.notNull())
    .addColumn('enviado_por', 'text', (c) => c.notNull())
    .execute()
  await db.schema
    .createIndex('clientes_documentos_cliente_idx')
    .on('clientes_documentos')
    .columns(['cliente_id', 'enviado_em'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('clientes_documentos').execute()
  await db.schema.dropTable('clientes_docas').execute()
  await db.schema.dropTable('clientes_sites').execute()
}
