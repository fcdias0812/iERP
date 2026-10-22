import { sql, type Kysely } from 'kysely'

/*
 * Clientes › Configurações (pedido do usuário, 22/10/2026: "switches para decidirem se tal
 * cliente vai ter sua coleta rastreada ou não" + "mais opções úteis"; ele escolheu todas as
 * propostas, menos "exigir código de chegada"). Colunas novas em `clientes`:
 *  - rastreio: rastrear_coleta, rastreio_excecao (quem agenda pode mudar só aquela coleta),
 *    exigir_motorista_placa;
 *  - agendamento: servicos_padrao (JSON; null = o padrão do sistema), transportadora_padrao_id,
 *    instrucoes (LocalizedText JSON), exigir_escopo_planilha (.xlsx);
 *  - recebimento: exigir_lacre, exigir_nota, exigir_tara, exigir_fotos_gerais;
 *  - prazos: sistema_processamento (para onde vão os lotes — antes era o nome "Dell"),
 *    dias_parado_etapa (anomalia do Dashboard), antecedencia_dias (só avisa),
 *    agendamento_bloqueado + bloqueio_motivo.
 * Os clientes que já existem continuam como hoje: rastreio escolhido em cada coleta e os da Dell
 * indo para o MoonShot. A view `ordens_lista` é refeita com o sistema e o limite de parado do
 * cliente (o PostgreSQL fixa as colunas da view na criação).
 */

const SIM_NAO = [
  ['rastrear_coleta', 0],
  ['rastreio_excecao', 1],
  ['exigir_motorista_placa', 0],
  ['exigir_escopo_planilha', 0],
  ['exigir_lacre', 0],
  ['exigir_nota', 0],
  ['exigir_tara', 0],
  ['exigir_fotos_gerais', 0],
  ['agendamento_bloqueado', 0],
] as const

const TEXTOS = [
  'servicos_padrao',
  'transportadora_padrao_id',
  'instrucoes',
  'sistema_processamento',
  'bloqueio_motivo',
] as const

const NUMEROS = ['dias_parado_etapa', 'antecedencia_dias'] as const

/** A view de antes (2026-10-20-01), para o `down`. */
const VIEW_ANTERIOR = sql`
  create view ordens_lista as
  select
    o.*,
    coalesce(o.externo_sistema, 'IERP') as origem,
    c.nome as cliente_nome,
    c.sla_dias as cliente_sla_dias,
    s.codigo as site_codigo,
    d.numero as doca_numero,
    t.nome as transportadora_nome,
    m.nome as motorista_nome,
    coalesce(o.qtd_pallets, 0) + coalesce(o.qtd_gaylords, 0) + coalesce(o.qtd_racks, 0)
      as total_volumes
  from ordens o
  join clientes c on c.id = o.cliente_id
  join clientes_sites s on s.id = o.site_id
  join clientes_docas d on d.id = o.doca_id
  left join transportadoras t on t.id = o.transportadora_id
  left join motoristas m on m.id = o.motorista_id
`

const VIEW = sql`
  create view ordens_lista as
  select
    o.*,
    coalesce(o.externo_sistema, 'IERP') as origem,
    c.nome as cliente_nome,
    c.sla_dias as cliente_sla_dias,
    c.sistema_processamento as cliente_sistema,
    c.dias_parado_etapa as cliente_dias_parado,
    s.codigo as site_codigo,
    d.numero as doca_numero,
    t.nome as transportadora_nome,
    m.nome as motorista_nome,
    coalesce(o.qtd_pallets, 0) + coalesce(o.qtd_gaylords, 0) + coalesce(o.qtd_racks, 0)
      as total_volumes
  from ordens o
  join clientes c on c.id = o.cliente_id
  join clientes_sites s on s.id = o.site_id
  join clientes_docas d on d.id = o.doca_id
  left join transportadoras t on t.id = o.transportadora_id
  left join motoristas m on m.id = o.motorista_id
`

/** A regra de antes (nome com a palavra "Dell", sem acento e sem caixa) — fixa aqui. */
const ehDell = (nome: string) =>
  /\bdell\b/.test(nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`drop view ordens_lista`.execute(db)
  for (const [coluna, padrao] of SIM_NAO)
    await db.schema
      .alterTable('clientes')
      .addColumn(coluna, 'integer', (c) => c.notNull().defaultTo(padrao))
      .execute()
  for (const coluna of TEXTOS)
    await db.schema.alterTable('clientes').addColumn(coluna, 'text').execute()
  for (const coluna of NUMEROS)
    await db.schema.alterTable('clientes').addColumn(coluna, 'integer').execute()

  const clientes = await sql<{ id: string; nome: string }>`select id, nome from clientes`.execute(
    db,
  )
  for (const c of clientes.rows)
    if (ehDell(c.nome))
      await sql`update clientes set sistema_processamento = 'MOONSHOT' where id = ${c.id}`.execute(
        db,
      )

  await VIEW.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop view ordens_lista`.execute(db)
  for (const coluna of [...NUMEROS, ...TEXTOS, ...SIM_NAO.map(([c]) => c)].reverse())
    await db.schema.alterTable('clientes').dropColumn(coluna).execute()
  await VIEW_ANTERIOR.execute(db)
}
