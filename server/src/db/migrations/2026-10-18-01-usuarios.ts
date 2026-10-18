import { sql, type Kysely } from 'kysely'

/* Admin › Usuários: cadastro e histórico. Tipos portáveis (SQLite e PostgreSQL). */

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('usuarios')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('numero', 'integer', (c) => c.notNull().unique())
    .addColumn('codigo', 'text', (c) => c.notNull().unique())
    .addColumn('nome', 'text', (c) => c.notNull())
    .addColumn('email', 'text', (c) => c.notNull().unique())
    .addColumn('perfil', 'text', (c) => c.notNull())
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('ultimo_acesso', 'text')
    .addColumn('busca', 'text', (c) => c.notNull())
    .addColumn('criado_em', 'text', (c) => c.notNull())
    .addColumn('criado_por', 'text', (c) => c.notNull())
    .addColumn('alterado_em', 'text', (c) => c.notNull())
    .addColumn('alterado_por', 'text', (c) => c.notNull())
    .execute()

  await db.schema
    .createTable('usuarios_historico')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('usuario_id', 'text', (c) =>
      c.notNull().references('usuarios.id').onDelete('cascade'),
    )
    .addColumn('autor', 'text', (c) => c.notNull())
    .addColumn('em', 'text', (c) => c.notNull())
    .addColumn('acao', 'text', (c) => c.notNull())
    .addColumn('mudancas', 'text')
    .addColumn('nota', 'text')
    .execute()

  await db.schema
    .createIndex('usuarios_historico_usuario_idx')
    .on('usuarios_historico')
    .columns(['usuario_id', 'em'])
    .execute()
  await db.schema.createIndex('usuarios_status_idx').on('usuarios').column('status').execute()
  // Ordenação por nome sem diferenciar maiúsculas.
  await db.schema
    .createIndex('usuarios_nome_idx')
    .on('usuarios')
    .expression(sql`lower(nome)`)
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('usuarios_historico').execute()
  await db.schema.dropTable('usuarios').execute()
}
