import type { Kysely } from 'kysely'

/*
 * O CÓDIGO DE CADA VIAGEM no rastreador (29/10/2026 — achado na verificação das integrações): o
 * ReTeckTracker RECUSA uma segunda viagem ATIVA com o mesmo código ("Esta coleta já está sendo
 * rastreada", 409). Com vários caminhões (ou vários celulares no mesmo caminhão) num lote, o
 * segundo motorista não conseguia começar. Como no iERP 1.0 (`codigoDaViagem`): a 1ª viagem usa o
 * código do lote (LOT-00031) e as seguintes, LOT-00031-V2, -V3… — guardado em
 * `ordens_viagens.codigo_rastreio` (vai no link do motorista e é por ele que o iERP acha a viagem
 * no rastreador). As que já existem recebem o código pela ordem em que nasceram em cada lote.
 */

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('ordens_viagens').addColumn('codigo_rastreio', 'text').execute()
  const k = db as Kysely<{
    ordens_viagens: { id: string; ordem_id: string; criado_em: string; numero: number }
    ordens: { id: string; codigo: string }
  }>
  const linhas = await k
    .selectFrom('ordens_viagens as v')
    .innerJoin('ordens as o', 'o.id', 'v.ordem_id')
    .select(['v.id', 'v.ordem_id', 'o.codigo'])
    .orderBy('v.ordem_id')
    .orderBy('v.criado_em')
    .orderBy('v.numero')
    .execute()
  const contagem = new Map<string, number>()
  for (const l of linhas) {
    const n = (contagem.get(l.ordem_id) ?? 0) + 1
    contagem.set(l.ordem_id, n)
    await db
      .updateTable('ordens_viagens' as never)
      .set({ codigo_rastreio: n > 1 ? `${l.codigo}-V${n}` : l.codigo } as never)
      .where('id' as never, '=', l.id as never)
      .execute()
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('ordens_viagens').dropColumn('codigo_rastreio').execute()
}
