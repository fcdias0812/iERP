import type { Kysely } from 'kysely'

/*
 * O certificado PÚBLICO da CA de um sistema de fora que serve HTTPS com CA própria (Re-Teck
 * MSDC, 20/10/2026). O iERP confia nele SÓ nas conexões com aquele sistema (`integracao/rede.ts`).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('integracoes').addColumn('ca_painel', 'text').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('integracoes').dropColumn('ca_painel').execute()
}
