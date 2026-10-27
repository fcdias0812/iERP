import type { Transaction } from 'kysely'
import type { Db } from '../../db/database.js'
import type { Database } from '../../db/schema.js'
import { diaNoFuso } from '../../shared/datas.js'
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
      if (novo === l.juntadoA) continue
      await cx.updateTable('ordens').set({ juntadoA: novo }).where('id', '=', l.id).execute()
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
