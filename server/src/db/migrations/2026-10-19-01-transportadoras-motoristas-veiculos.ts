import { sql, type Kysely } from 'kysely'

/*
 * Relacionamento: Transportadoras (com contatos), Motoristas (transportadora opcional) e
 * Veículos (sem vínculo). Histórico ÚNICO para estes cadastros: tabela `historico`
 * (entidade + registro). Tipos portáveis (SQLite e PostgreSQL).
 */

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('historico')
    .addColumn('id', 'text', (c) => c.primaryKey())
    // 'transportadora' | 'motorista' | 'veiculo'
    .addColumn('entidade', 'text', (c) => c.notNull())
    .addColumn('registro_id', 'text', (c) => c.notNull())
    .addColumn('autor', 'text', (c) => c.notNull())
    .addColumn('em', 'text', (c) => c.notNull())
    .addColumn('acao', 'text', (c) => c.notNull())
    .addColumn('mudancas', 'text')
    .addColumn('nota', 'text')
    .execute()
  await db.schema
    .createIndex('historico_registro_idx')
    .on('historico')
    .columns(['entidade', 'registro_id', 'em'])
    .execute()

  /* ---------------- transportadoras */
  await db.schema
    .createTable('transportadoras')
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
    .createTable('transportadoras_contatos')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('transportadora_id', 'text', (c) =>
      c.notNull().references('transportadoras.id').onDelete('cascade'),
    )
    .addColumn('nome', 'text')
    .addColumn('email', 'text', (c) => c.notNull())
    .addColumn('telefone', 'text', (c) => c.notNull())
    .addColumn('principal', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('ordem', 'integer', (c) => c.notNull())
    .execute()
  await db.schema
    .createIndex('transportadoras_contatos_idx')
    .on('transportadoras_contatos')
    .columns(['transportadora_id', 'ordem'])
    .execute()
  await db.schema
    .createIndex('transportadoras_nome_idx')
    .on('transportadoras')
    .expression(sql`lower(nome)`)
    .execute()

  /* ---------------- motoristas */
  await db.schema
    .createTable('motoristas')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('numero', 'integer', (c) => c.notNull().unique())
    .addColumn('codigo', 'text', (c) => c.notNull().unique())
    .addColumn('nome', 'text', (c) => c.notNull())
    // Só dígitos.
    .addColumn('cpf', 'text', (c) => c.notNull().unique())
    .addColumn('telefone', 'text', (c) => c.notNull())
    // Vínculo opcional; se a transportadora sumir, o motorista fica sem vínculo.
    .addColumn('transportadora_id', 'text', (c) =>
      c.references('transportadoras.id').onDelete('set null'),
    )
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('busca', 'text', (c) => c.notNull())
    .addColumn('criado_em', 'text', (c) => c.notNull())
    .addColumn('criado_por', 'text', (c) => c.notNull())
    .addColumn('alterado_em', 'text', (c) => c.notNull())
    .addColumn('alterado_por', 'text', (c) => c.notNull())
    .execute()
  await db.schema
    .createIndex('motoristas_transportadora_idx')
    .on('motoristas')
    .column('transportadora_id')
    .execute()

  /* ---------------- veículos */
  await db.schema
    .createTable('veiculos')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('numero', 'integer', (c) => c.notNull().unique())
    .addColumn('codigo', 'text', (c) => c.notNull().unique())
    .addColumn('tipo', 'text', (c) => c.notNull())
    // m² (definido pelo usuário)
    .addColumn('volume_minimo', 'double precision')
    .addColumn('volume_maximo', 'double precision')
    // metros
    .addColumn('comprimento', 'double precision')
    .addColumn('largura', 'double precision')
    // quantidade de pallets e toneladas
    .addColumn('capacidade_pallets', 'integer')
    .addColumn('capacidade_toneladas', 'double precision')
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('busca', 'text', (c) => c.notNull())
    .addColumn('criado_em', 'text', (c) => c.notNull())
    .addColumn('criado_por', 'text', (c) => c.notNull())
    .addColumn('alterado_em', 'text', (c) => c.notNull())
    .addColumn('alterado_por', 'text', (c) => c.notNull())
    .execute()

  /* ---------------- listas (contato principal, contagens, nome da transportadora) */
  await sql`
    create view transportadoras_lista as
    select
      t.id, t.numero, t.codigo, t.nome, t.cnpj, t.status, t.busca,
      t.criado_em, t.criado_por, t.alterado_em, t.alterado_por,
      p.nome as contato_nome,
      p.email as contato_email,
      p.telefone as contato_telefone,
      (select count(*) from transportadoras_contatos x where x.transportadora_id = t.id) as contatos,
      (select count(*) from motoristas m where m.transportadora_id = t.id) as motoristas
    from transportadoras t
    left join transportadoras_contatos p on p.transportadora_id = t.id and p.principal = 1
  `.execute(db)
  await sql`
    create view motoristas_lista as
    select
      m.id, m.numero, m.codigo, m.nome, m.cpf, m.telefone, m.transportadora_id, m.status, m.busca,
      m.criado_em, m.criado_por, m.alterado_em, m.alterado_por,
      t.nome as transportadora_nome
    from motoristas m
    left join transportadoras t on t.id = m.transportadora_id
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop view motoristas_lista`.execute(db)
  await sql`drop view transportadoras_lista`.execute(db)
  await db.schema.dropTable('veiculos').execute()
  await db.schema.dropTable('motoristas').execute()
  await db.schema.dropTable('transportadoras_contatos').execute()
  await db.schema.dropTable('transportadoras').execute()
  await db.schema.dropTable('historico').execute()
}
