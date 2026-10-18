import { sql, type Kysely } from 'kysely'

/*
 * Clientes: cadastro, contatos (um é o principal) e histórico.
 * A view `clientes_lista` junta o contato principal e a contagem de contatos para a lista
 * (filtrar/ordenar por e-mail e telefone). SQL padrão: vale no SQLite e no PostgreSQL.
 */

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('clientes')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('numero', 'integer', (c) => c.notNull().unique())
    .addColumn('codigo', 'text', (c) => c.notNull().unique())
    .addColumn('nome', 'text', (c) => c.notNull())
    // Sem pontuação, maiúsculas (CNPJ alfanumérico).
    .addColumn('cnpj', 'text', (c) => c.notNull().unique())
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('busca', 'text', (c) => c.notNull())
    .addColumn('criado_em', 'text', (c) => c.notNull())
    .addColumn('criado_por', 'text', (c) => c.notNull())
    .addColumn('alterado_em', 'text', (c) => c.notNull())
    .addColumn('alterado_por', 'text', (c) => c.notNull())
    .execute()

  await db.schema
    .createTable('clientes_contatos')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('cliente_id', 'text', (c) =>
      c.notNull().references('clientes.id').onDelete('cascade'),
    )
    .addColumn('nome', 'text')
    .addColumn('email', 'text', (c) => c.notNull())
    // Só dígitos (DDD + número).
    .addColumn('telefone', 'text', (c) => c.notNull())
    // 0/1 — exatamente um principal por cliente (garantido pelo serviço).
    .addColumn('principal', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('ordem', 'integer', (c) => c.notNull())
    .execute()

  await db.schema
    .createTable('clientes_historico')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('cliente_id', 'text', (c) =>
      c.notNull().references('clientes.id').onDelete('cascade'),
    )
    .addColumn('autor', 'text', (c) => c.notNull())
    .addColumn('em', 'text', (c) => c.notNull())
    .addColumn('acao', 'text', (c) => c.notNull())
    .addColumn('mudancas', 'text')
    .addColumn('nota', 'text')
    .execute()

  await db.schema
    .createIndex('clientes_contatos_cliente_idx')
    .on('clientes_contatos')
    .columns(['cliente_id', 'ordem'])
    .execute()
  await db.schema
    .createIndex('clientes_historico_cliente_idx')
    .on('clientes_historico')
    .columns(['cliente_id', 'em'])
    .execute()
  await db.schema.createIndex('clientes_status_idx').on('clientes').column('status').execute()
  await db.schema
    .createIndex('clientes_nome_idx')
    .on('clientes')
    .expression(sql`lower(nome)`)
    .execute()

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
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop view clientes_lista`.execute(db)
  await db.schema.dropTable('clientes_historico').execute()
  await db.schema.dropTable('clientes_contatos').execute()
  await db.schema.dropTable('clientes').execute()
}
