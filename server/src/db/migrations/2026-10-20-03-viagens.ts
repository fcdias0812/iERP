import type { Kysely } from 'kysely'

/*
 * Ordens › Viagens (pedido do usuário, 20/10/2026): a viagem de cada lote agendado com
 * "Rastrear coleta = Sim", acompanhada pelo rastreador de GPS (ReTeckTracker — o mesmo que o
 * iERP antigo usa; o 2.0 só ACRESCENTA, nada do antigo muda).
 *  - ordens_viagens — uma por lote: o código de chegada (sorteado aqui, falado no destino), a
 *    viagem do rastreador (`trip_id`), a situação, a última posição e a emergência.
 *  - ordens_viagens_pontos — o trajeto ARQUIVADO quando a viagem termina (o replay não depende
 *    do rastreador continuar guardando a viagem).
 *  - integracoes.chave_transito — a chave do mapa de trânsito (TomTom), do rastreador.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('ordens_viagens')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('ordem_id', 'text', (c) => c.notNull().references('ordens.id').onDelete('cascade'))
    .addColumn('codigo_chegada', 'text', (c) => c.notNull())
    // aguardando_motorista | em_rota | chegou | finalizada | cancelada
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('trip_id', 'integer')
    // O código de chegada já foi gravado na viagem do rastreador? (0/1)
    .addColumn('codigo_registrado', 'integer', (c) => c.notNull().defaultTo(0))
    // Encerrada aqui (recebimento) mas o rastreador ainda não soube: tentar de novo. (0/1)
    .addColumn('encerrar_no_rastreador', 'integer', (c) => c.notNull().defaultTo(0))
    // motorista | operador | recebimento | rastreador
    .addColumn('finalizada_por', 'text')
    .addColumn('motorista_nome', 'text')
    .addColumn('placa', 'text')
    .addColumn('iniciada_em', 'text')
    .addColumn('chegou_em', 'text')
    .addColumn('terminada_em', 'text')
    .addColumn('ultima_latitude', 'double precision')
    .addColumn('ultima_longitude', 'double precision')
    // m/s
    .addColumn('ultima_velocidade', 'double precision')
    .addColumn('ultima_em', 'text')
    .addColumn('total_pontos', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('distancia_metros', 'double precision')
    .addColumn('emergencia_tipo', 'text')
    .addColumn('emergencia_em', 'text')
    .addColumn('emergencia_latitude', 'double precision')
    .addColumn('emergencia_longitude', 'double precision')
    .addColumn('emergencia_ciente_em', 'text')
    .addColumn('emergencia_ciente_por', 'text')
    // Chat e paradas guardados ao arquivar (JSON).
    .addColumn('chat', 'text')
    .addColumn('paradas', 'text')
    .addColumn('arquivada', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('criado_em', 'text', (c) => c.notNull())
    .addColumn('alterado_em', 'text', (c) => c.notNull())
    .execute()
  await db.schema
    .createIndex('ordens_viagens_ordem_idx')
    .on('ordens_viagens')
    .column('ordem_id')
    .unique()
    .execute()
  await db.schema
    .createIndex('ordens_viagens_trip_idx')
    .on('ordens_viagens')
    .column('trip_id')
    .execute()

  await db.schema
    .createTable('ordens_viagens_pontos')
    .addColumn('viagem_id', 'text', (c) =>
      c.notNull().references('ordens_viagens.id').onDelete('cascade'),
    )
    .addColumn('seq', 'integer', (c) => c.notNull())
    .addColumn('latitude', 'double precision', (c) => c.notNull())
    .addColumn('longitude', 'double precision', (c) => c.notNull())
    .addColumn('velocidade', 'double precision')
    .addColumn('precisao', 'double precision')
    .addColumn('registrado_em', 'text', (c) => c.notNull())
    .addPrimaryKeyConstraint('ordens_viagens_pontos_pk', ['viagem_id', 'seq'])
    .execute()

  await db.schema.alterTable('integracoes').addColumn('chave_transito', 'text').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('integracoes').dropColumn('chave_transito').execute()
  await db.schema.dropTable('ordens_viagens_pontos').execute()
  await db.schema.dropTable('ordens_viagens').execute()
}
