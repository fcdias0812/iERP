import type { Kysely } from 'kysely'

/*
 * Link público para o cliente acompanhar os lotes (pedido do usuário, 22/10/2026 — o "Rastreabilidade
 * dos lotes" do iERP 1.0; ele escolheu link fixo por cliente, com trocar e desativar).
 * clientes.rastreio_token: o código do link (48 hex, nada nele identifica a empresa); null = sem
 * link (nunca gerado ou desativado). Único: um link leva a um cliente só.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('clientes').addColumn('rastreio_token', 'text').execute()
  await db.schema
    .createIndex('clientes_rastreio_token_idx')
    .on('clientes')
    .column('rastreio_token')
    .unique()
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('clientes_rastreio_token_idx').execute()
  await db.schema.alterTable('clientes').dropColumn('rastreio_token').execute()
}
