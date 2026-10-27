import { Router } from 'express'
import { z } from 'zod'
import type { Db } from '../../db/database.js'
import { autorDa } from '../../shared/autor.js'
import { ErroApi, naoEncontrado } from '../../shared/erros.js'
import type { EventoHistorico, Mudanca } from '../../shared/historico.js'
import { listarHistorico, registrarHistorico } from '../../shared/historico.repositorio.js'
import { estadoDoRastreador, type EstadoRastreador, type LeitorGps } from './gps-caminhao.js'

/*
 * Sistema › Cadastros › Rastreadores GPS (22/10/2026): os aparelhos dos caminhões, que aparecem
 * sozinhos na leitura do servidor de GPS (como no 1.0). Aqui se põe a placa e a descrição, e se
 * inativa/reativa (aparelho inativo é ignorado na leitura). O device_id não muda.
 *
 *   GET  /api/rastreadores               lista (situação, último contato, posição, viagem aberta)
 *   GET  /api/rastreadores/:id           detalhe + histórico
 *   PUT  /api/rastreadores/:id           { placa, descricao }
 *   POST /api/rastreadores/:id/transicao { acao: inativar | reativar }
 *   POST /api/rastreadores/ler-agora     lê o servidor de GPS agora
 */

export interface Rastreador {
  id: string
  deviceId: string
  placa: string | null
  descricao: string | null
  status: 'ativo' | 'inativo'
  estado: EstadoRastreador
  firmware: string | null
  ultimoContatoEm: string | null
  /** Satélites em uso e o fix (2D/3D/none), do último status. */
  satelites: number | null
  fix: string | null
  ultimaLatitude: number | null
  ultimaLongitude: number | null
  ultimaVelocidade: number | null
  ultimoPontoEm: string | null
  pontosPerdidos: number
  /** A viagem aberta com este aparelho. */
  viagem: { id: string; loteCodigo: string; numero: number } | null
  acoesPermitidas: ('inativar' | 'reativar')[]
}

export interface RastreadorDetalhe extends Rastreador {
  historico: EventoHistorico[]
}

const PLACA = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/
const edicaoSchema = z.object({
  placa: z
    .string()
    .nullish()
    .transform((v) => (v ? v.replace(/[^0-9a-z]/gi, '').toUpperCase() : null))
    .refine((v) => v === null || PLACA.test(v), 'Placa inválida.'),
  descricao: z
    .string()
    .trim()
    .max(120)
    .nullish()
    .transform((v) => v || null),
})
const transicaoSchema = z.object({ acao: z.enum(['inativar', 'reativar']) })

export function criarServicoRastreadores(db: Db, leitor: LeitorGps | undefined) {
  async function listar(): Promise<Rastreador[]> {
    const [linhas, abertas] = await Promise.all([
      db.selectFrom('rastreadores').selectAll().orderBy('deviceId').execute(),
      db
        .selectFrom('ordensViagens as v')
        .innerJoin('ordens as o', 'o.id', 'v.ordemId')
        .select(['v.id', 'v.rastreadorId', 'v.numero', 'o.codigo'])
        .where('v.origem', '=', 'aparelho')
        .where('v.status', 'in', ['em_rota', 'chegou'])
        .execute(),
    ])
    const agora = Date.now()
    return linhas.map((r) => {
      const s = r.ultimoStatus ? (JSON.parse(r.ultimoStatus) as Record<string, unknown>) : {}
      const v = abertas.find((a) => a.rastreadorId === r.id)
      return {
        id: r.id,
        deviceId: r.deviceId,
        placa: r.placa,
        descricao: r.descricao,
        status: r.status as 'ativo' | 'inativo',
        estado: estadoDoRastreador(r, agora),
        firmware: r.firmware,
        ultimoContatoEm: r.ultimoContatoEm,
        satelites: typeof s.satsUsed === 'number' ? s.satsUsed : null,
        fix: typeof s.fix === 'string' ? s.fix : null,
        ultimaLatitude: r.ultimaLatitude,
        ultimaLongitude: r.ultimaLongitude,
        ultimaVelocidade: r.ultimaVelocidade,
        ultimoPontoEm: r.ultimoPontoEm,
        pontosPerdidos: r.pontosPerdidos,
        viagem: v ? { id: v.id, loteCodigo: v.codigo, numero: v.numero } : null,
        acoesPermitidas: r.status === 'ativo' ? ['inativar'] : ['reativar'],
      }
    })
  }

  async function obter(id: string): Promise<RastreadorDetalhe> {
    const r = (await listar()).find((x) => x.id === id)
    if (!r) throw naoEncontrado('Rastreador não encontrado.')
    return { ...r, historico: await listarHistorico(db, 'rastreador', id) }
  }

  async function editar(id: string, corpo: unknown, autor: string) {
    const v = edicaoSchema.parse(corpo)
    const atual = await db
      .selectFrom('rastreadores')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
    if (!atual) throw naoEncontrado('Rastreador não encontrado.')
    const mudancas: Mudanca[] = (['placa', 'descricao'] as const)
      .filter((k) => atual[k] !== v[k])
      .map((k) => ({ campo: k, antes: atual[k], depois: v[k] }))
    if (mudancas.length) {
      const agora = new Date().toISOString()
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable('rastreadores')
          .set({ ...v, alteradoEm: agora })
          .where('id', '=', id)
          .execute()
        await registrarHistorico(trx, 'rastreador', id, {
          autor,
          em: agora,
          acao: 'editado',
          mudancas,
        })
      })
    }
    return obter(id)
  }

  async function transicionar(id: string, corpo: unknown, autor: string) {
    const { acao } = transicaoSchema.parse(corpo)
    const atual = await obter(id)
    if (!atual.acoesPermitidas.includes(acao))
      throw new ErroApi(409, 'invalid_transition', `Ação "${acao}" não é permitida agora.`)
    if (acao === 'inativar' && atual.viagem)
      throw new ErroApi(
        409,
        'tracker_in_use',
        'Este aparelho está numa viagem aberta: finalize a viagem antes de inativar.',
      )
    const destino = acao === 'inativar' ? 'inativo' : 'ativo'
    const agora = new Date().toISOString()
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('rastreadores')
        .set({ status: destino, alteradoEm: agora })
        .where('id', '=', id)
        .execute()
      await registrarHistorico(trx, 'rastreador', id, {
        autor,
        em: agora,
        acao: 'status',
        mudancas: [{ campo: 'status', antes: atual.status, depois: destino }],
      })
    })
    return obter(id)
  }

  async function lerAgora() {
    if (!leitor) throw new ErroApi(409, 'gps_not_configured', 'Leitura de GPS desligada.')
    await leitor.lerAgora()
    return listar()
  }

  return { listar, obter, editar, transicionar, lerAgora }
}

export type ServicoRastreadores = ReturnType<typeof criarServicoRastreadores>

export function rotasRastreadores(servico: ServicoRastreadores) {
  const r = Router()
  r.get('/', async (_req, res) => {
    res.json(await servico.listar())
  })
  r.post('/ler-agora', async (_req, res) => {
    res.json(await servico.lerAgora())
  })
  r.get('/:id', async (req, res) => {
    res.json(await servico.obter(String(req.params.id)))
  })
  r.put('/:id', async (req, res) => {
    res.json(await servico.editar(String(req.params.id), req.body, autorDa(req)))
  })
  r.post('/:id/transicao', async (req, res) => {
    res.json(await servico.transicionar(String(req.params.id), req.body, autorDa(req)))
  })
  return r
}
