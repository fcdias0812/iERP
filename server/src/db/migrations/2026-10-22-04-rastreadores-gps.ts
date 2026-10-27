import type { Kysely } from 'kysely'

/*
 * Rastreadores GPS (o aparelho no caminhão — pedido do usuário, 22/10/2026: "utilize o mesmo
 * método no 1.0, esse sistema do gps não vai mudar"). Como no 1.0: o servidor de GPS (Walker) é
 * lido por pull; a placa aparece sozinha na primeira leitura em que ela mandar algo.
 *  - rastreadores — o aparelho (device_id da placa, minúsculo), a placa do caminhão, a descrição,
 *    o último contato/status (JSON do bloco `status` dele), a última posição real, o último `seq`
 *    e os pontos perdidos (buracos no `seq`).
 * O servidor de GPS é cadastrado em Administração › Integração (sistema GPS_CAMINHAO): endereço
 * da leitura, a chave (a MESMA do 1.0, decisão dele) e o cursor da leitura em `sincronizacao`.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('rastreadores')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('device_id', 'text', (c) => c.notNull().unique())
    .addColumn('placa', 'text')
    .addColumn('descricao', 'text')
    // ativo | inativo
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('firmware', 'text')
    .addColumn('ultimo_contato_em', 'text')
    .addColumn('ultimo_status', 'text')
    .addColumn('ultima_latitude', 'double precision')
    .addColumn('ultima_longitude', 'double precision')
    // m/s
    .addColumn('ultima_velocidade', 'double precision')
    .addColumn('ultimo_ponto_em', 'text')
    .addColumn('ultimo_seq', 'integer')
    .addColumn('pontos_perdidos', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('criado_em', 'text', (c) => c.notNull())
    .addColumn('alterado_em', 'text', (c) => c.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('rastreadores').execute()
}
