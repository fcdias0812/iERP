import { sql, type Kysely } from 'kysely'

/*
 * Documentos do lote ganham TIPO (decisão do usuário, 19/10/2026): escopo, nota_fiscal, mtr, cdf,
 * foto, outro. Os já enviados no agendamento: arquivos do escopo → 'escopo'; o resto → 'outro'.
 */

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('ordens_anexos')
    .addColumn('tipo', 'text', (c) => c.notNull().defaultTo('outro'))
    .execute()
  await sql`update ordens_anexos set tipo = 'escopo' where secao = 'escopo'`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('ordens_anexos').dropColumn('tipo').execute()
}
