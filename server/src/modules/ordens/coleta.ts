import type { Transaction } from 'kysely'
import type { Db } from '../../db/database.js'
import type { Database } from '../../db/schema.js'
import { diaNoFuso, inicioDoDia } from '../../shared/datas.js'
import { registrarHistorico } from '../../shared/historico.repositorio.js'
import { normalizar } from '../../shared/texto.js'

/*
 * A MESMA COLETA (pedido do usuário, 22/10/2026): mesmo cliente, mesmo endereço do site e mesma
 * data de coleta (a confirmada ou, sem ela, a prevista — o dia em São Paulo). De qualquer origem
 * (iERP, Gerenciamento, MSDC). O primeiro lote criado é o PRINCIPAL; os outros ficam
 * `juntado_a` = principal e somem das listas — o principal mostra tudo somado e a lista dos
 * juntados (cada um com o botão para o sistema dele). Como no 1.0, quem decide é o ENDEREÇO (dois
 * sites no mesmo endereço = a mesma coleta); sem endereço, vale o próprio site.
 *
 * Lote já recebido por conta própria não vira juntado de outro (a carga dele já foi contada);
 * cancelado sai do grupo. Reagrupar é idempotente: roda depois de agendar, editar e de cada
 * leitura dos sistemas de origem.
 *
 * AS VIAGENS SE JUNTAM TAMBÉM (pedido do usuário, 28/10/2026: "as ordens vão se juntar incluindo
 * também as viagens"; decisão: "viram da coleta, pela placa"): os caminhões abertos do lote que
 * se junta passam para o principal — só a MESMA placa = o MESMO caminhão (mesmo número, os
 * rastreadores se somam no card); placa diferente ou SEM placa (um caminhão ainda a definir — ele
 * esperava 3 cards para 2 caminhões vazios + 1 com placa) = mais um caminhão da coleta. A regra
 * da placa vale também dentro do lote (`unirMesmaPlaca`).
 */

type Conexao = Db | Transaction<Database>

interface LoteDaColeta {
  id: string
  codigo: string
  numero: number
  criadoEm: string
  externoSistema: string | null
  recebidoEm: string | null
  dataColeta: string | null
  coletaPrevista: string | null
  juntadoA: string | null
  siteId: string
  endereco: string | null
}

/** A chave da coleta (null = o lote fica sozinho). */
export function chaveDaColeta(
  l: Pick<LoteDaColeta, 'dataColeta' | 'coletaPrevista' | 'siteId' | 'endereco'>,
) {
  const quando = l.dataColeta ?? l.coletaPrevista
  if (!quando) return null
  const dia = diaNoFuso(new Date(quando))
  const lugar = l.endereco?.trim()
    ? normalizar(l.endereco).replace(/\s+/g, ' ')
    : `site:${l.siteId}`
  return `${dia}|${lugar}`
}

/** Reagrupa as coletas dos clientes (mexe só no que mudou; registra no histórico). */
export async function reagruparColetas(cx: Conexao, clienteIds: string[], autor: string) {
  for (const clienteId of new Set(clienteIds)) {
    const lotes: LoteDaColeta[] = await cx
      .selectFrom('ordens as o')
      .innerJoin('clientesSites as s', 's.id', 'o.siteId')
      .select([
        'o.id',
        'o.codigo',
        'o.numero',
        'o.criadoEm',
        'o.externoSistema',
        'o.recebidoEm',
        'o.dataColeta',
        'o.coletaPrevista',
        'o.juntadoA',
        'o.siteId',
        's.endereco',
      ])
      .where('o.clienteId', '=', clienteId)
      .where('o.status', '<>', 'cancelado')
      .execute()

    const grupos = new Map<string, LoteDaColeta[]>()
    for (const l of lotes) {
      const k = chaveDaColeta(l)
      if (k) grupos.set(k, [...(grupos.get(k) ?? []), l])
    }
    // O que cada lote deve ser: principal (null) ou juntado a quem.
    const destino = new Map<string, string | null>(lotes.map((l) => [l.id, null]))
    for (const grupo of grupos.values()) {
      if (grupo.length < 2) continue
      grupo.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.numero - b.numero)
      const principal = grupo[0]!
      for (const l of grupo.slice(1)) {
        const podeJuntar = l.externoSistema !== null || !l.recebidoEm || l.juntadoA === principal.id
        if (podeJuntar) destino.set(l.id, principal.id)
      }
    }
    // Cancelados (fora da consulta) não ficam juntados.
    await cx
      .updateTable('ordens')
      .set({ juntadoA: null })
      .where('clienteId', '=', clienteId)
      .where('status', '=', 'cancelado')
      .where('juntadoA', 'is not', null)
      .execute()

    const porId = new Map(lotes.map((l) => [l.id, l]))
    const agora = new Date().toISOString()
    for (const l of lotes) {
      const novo = destino.get(l.id) ?? null
      if (novo === l.juntadoA) {
        // Já juntado: caminhão que ainda ficou nele (juntado antes de 28/10/2026) vai para o
        // principal. Sem caminhão aberto, não faz nada.
        if (novo) await juntarViagens(cx, l.id, novo, agora)
        continue
      }
      await cx.updateTable('ordens').set({ juntadoA: novo }).where('id', '=', l.id).execute()
      if (novo) await juntarViagens(cx, l.id, novo, agora)
      if (novo) {
        const p = porId.get(novo)!
        await registrarHistorico(cx, 'ordem', l.id, {
          autor,
          em: agora,
          acao: 'juntado',
          mudancas: [{ campo: 'lote', antes: null, depois: p.codigo }],
        })
        await registrarHistorico(cx, 'ordem', p.id, {
          autor,
          em: agora,
          acao: 'coleta_juntada',
          mudancas: [{ campo: 'lote', antes: null, depois: l.codigo }],
        })
      } else if (l.juntadoA) {
        const p = porId.get(l.juntadoA)
        await registrarHistorico(cx, 'ordem', l.id, {
          autor,
          em: agora,
          acao: 'separado',
          mudancas: [{ campo: 'lote', antes: p?.codigo ?? null, depois: null }],
        })
      }
    }
  }
}

/** Os lotes juntados a um principal (na ordem em que foram criados). */
export async function juntadosA(cx: Conexao, principalId: string) {
  return cx
    .selectFrom('ordensLista')
    .selectAll()
    .where('juntadoA', '=', principalId)
    .orderBy('criadoEm')
    .orderBy('numero')
    .execute()
}

const ABERTAS = ['aguardando_motorista', 'em_rota', 'chegou']
/** Placa para comparar (sem traço, maiúscula). */
const placaLimpa = (p: string | null) => (p ? p.replace(/[^0-9a-z]/gi, '').toUpperCase() : '')

/**
 * Os caminhões abertos do lote que se juntou passam para o principal (ver o topo do arquivo): cada
 * um entra como mais um caminhão e, em seguida, os de MESMA placa viram um só (`unirMesmaPlaca`).
 */
export async function juntarViagens(cx: Conexao, deId: string, paraId: string, agora: string) {
  const minhas = await cx
    .selectFrom('ordensViagens')
    .select(['id', 'numero'])
    .where('ordemId', '=', deId)
    .where('status', 'in', ABERTAS)
    .orderBy('numero')
    .orderBy('criadoEm')
    .execute()
  if (!minhas.length) return
  const ultimo = await cx
    .selectFrom('ordensViagens')
    .select((eb) => eb.fn.max('numero').as('n'))
    .where('ordemId', '=', paraId)
    .executeTakeFirst()
  let proximo = Number(ultimo?.n ?? 0) + 1
  const numeros = [...new Set(minhas.map((v) => v.numero))]
  for (const n of numeros)
    await cx
      .updateTable('ordensViagens')
      .set({ ordemId: paraId, numero: proximo++, alteradoEm: agora })
      .where(
        'id',
        'in',
        minhas.filter((v) => v.numero === n).map((v) => v.id),
      )
      .execute()
  await unirMesmaPlaca(cx, paraId, agora)
  // O principal passa a ser rastreado (a coleta tem caminhão).
  await cx.updateTable('ordens').set({ rastrear: 1 }).where('id', '=', paraId).execute()
}

/**
 * Os caminhões do lote com a MESMA placa são o mesmo caminhão (pedido do usuário, 28/10/2026 —
 * "atribuí motorista e placa ao caminhão 1, mas ele não juntou com o caminhão 3, mesmo sendo
 * iguais"): ficam no número menor (um card só). O celular que só espera o motorista e repete o
 * celular do caminhão que fica sai (cancelado); aparelho de GPS ou viagem já começada vira mais um
 * rastreador; o código de chegada passa a ser o do caminhão (se ainda não foi gravado no
 * rastreador); o motorista que só um dos lados tem fica no caminhão. Sem placa = a definir (nunca
 * junta). Roda ao criar, editar e juntar lotes.
 */
export async function unirMesmaPlaca(cx: Conexao, ordemId: string, agora: string) {
  const abertas = await cx
    .selectFrom('ordensViagens')
    .selectAll()
    .where('ordemId', '=', ordemId)
    .where('status', 'in', ABERTAS)
    .orderBy('numero')
    .orderBy('criadoEm')
    .execute()
  const grupos = new Map<number, typeof abertas>()
  for (const v of abertas) grupos.set(v.numero, [...(grupos.get(v.numero) ?? []), v])
  const porPlaca = new Map<
    string,
    { numero: number; motoristaId: string | null; codigo: string; celular: boolean }
  >()
  for (const [numero, g] of grupos) {
    const placa = placaLimpa(g.find((v) => v.placaInformada)?.placaInformada ?? null)
    if (!placa) continue
    const motorista = g.find((v) => v.motoristaId)?.motoristaId ?? null
    const alvo = porPlaca.get(placa)
    if (!alvo) {
      porPlaca.set(placa, {
        numero,
        motoristaId: motorista,
        codigo: g[0]!.codigoChegada,
        celular: g.some((v) => v.origem === 'celular'),
      })
      continue
    }
    if (!alvo.motoristaId && motorista) {
      await cx
        .updateTable('ordensViagens')
        .set({ motoristaId: motorista, alteradoEm: agora })
        .where('ordemId', '=', ordemId)
        .where('numero', '=', alvo.numero)
        .where('status', '=', 'aguardando_motorista')
        .execute()
      alvo.motoristaId = motorista
    }
    for (const v of g) {
      if (v.origem === 'celular' && v.status === 'aguardando_motorista' && alvo.celular) {
        await cx
          .updateTable('ordensViagens')
          .set({ status: 'cancelada', terminadaEm: agora, alteradoEm: agora })
          .where('id', '=', v.id)
          .execute()
        continue
      }
      await cx
        .updateTable('ordensViagens')
        .set({
          numero: alvo.numero,
          motoristaId: v.motoristaId ?? alvo.motoristaId,
          ...(v.codigoRegistrado ? {} : { codigoChegada: alvo.codigo }),
          alteradoEm: agora,
        })
        .where('id', '=', v.id)
        .execute()
      if (v.origem === 'celular') alvo.celular = true
    }
  }
}

/**
 * A coleta em que um lote NOVO vai entrar (o principal dela), ou null — para o Agendamento avisar
 * e mostrar os caminhões que já existem (28/10/2026). `dia` = AAAA-MM-DD (a data da coleta).
 */
export async function coletaDe(cx: Conexao, d: { clienteId: string; siteId: string; dia: string }) {
  const site = await cx
    .selectFrom('clientesSites')
    .select(['id', 'endereco'])
    .where('id', '=', d.siteId)
    .executeTakeFirst()
  if (!site) return null
  const quando = inicioDoDia(d.dia)
  const chave = chaveDaColeta({
    dataColeta: quando,
    coletaPrevista: quando,
    siteId: site.id,
    endereco: site.endereco,
  })
  if (!chave) return null
  const lotes = await cx
    .selectFrom('ordens as o')
    .innerJoin('clientesSites as s', 's.id', 'o.siteId')
    .select([
      'o.id',
      'o.codigo',
      'o.numero',
      'o.criadoEm',
      'o.dataColeta',
      'o.coletaPrevista',
      'o.siteId',
      's.endereco',
    ])
    .where('o.clienteId', '=', d.clienteId)
    .where('o.status', '<>', 'cancelado')
    .where('o.juntadoA', 'is', null)
    .execute()
  const principal = lotes
    .filter((l) => chaveDaColeta(l) === chave)
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.numero - b.numero)[0]
  if (!principal) return null
  const viagens = await cx
    .selectFrom('ordensViagens as v')
    .leftJoin('motoristas as m', 'm.id', 'v.motoristaId')
    .select(['v.numero', 'v.placaInformada', 'm.nome as motoristaNome'])
    .where('v.ordemId', '=', principal.id)
    .where('v.status', 'in', ABERTAS)
    .orderBy('v.numero')
    .orderBy('v.criadoEm')
    .execute()
  const caminhoes = new Map<
    number,
    { numero: number; motoristaNome: string | null; placa: string | null; rastreadores: number }
  >()
  for (const v of viagens) {
    const c = caminhoes.get(v.numero) ?? {
      numero: v.numero,
      motoristaNome: v.motoristaNome,
      placa: v.placaInformada,
      rastreadores: 0,
    }
    c.rastreadores++
    caminhoes.set(v.numero, c)
  }
  return { id: principal.id, codigo: principal.codigo, caminhoes: [...caminhoes.values()] }
}
