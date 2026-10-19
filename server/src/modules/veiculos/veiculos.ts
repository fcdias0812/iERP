import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { sql } from 'kysely'
import { z } from 'zod'
import type { Db } from '../../db/database.js'
import { autorDa } from '../../shared/autor.js'
import {
  acoesCadastro,
  codigoCom,
  destinoDe,
  mudancasEntre,
  ORDEM_STATUS,
  proximoNumero,
  type AcaoCadastro,
  type StatusCadastro,
} from '../../shared/cadastro.js'
import {
  lerConsulta,
  ordemDaConsulta,
  whereDaConsulta,
  type ColunaConsulta,
} from '../../shared/consulta-tabela.js'
import { naoEncontrado } from '../../shared/erros.js'
import type { EventoHistorico } from '../../shared/historico.js'
import { listarHistorico, registrarHistorico } from '../../shared/historico.repositorio.js'
import { normalizar } from '../../shared/texto.js'

/*
 * Relacionamento › Veículos (perfis de veículo usados no cálculo da ordem). Sem vínculo com
 * transportadora ou motorista. Contrato espelhado em src/services/types.ts do frontend.
 *
 *   GET  /api/veiculos            lista (formato do DataTable)
 *   GET  /api/veiculos/resumo     total, ativos, inativos
 *   GET  /api/veiculos/:id        detalhe + histórico
 *   POST /api/veiculos            cria
 *   PUT  /api/veiculos/:id        edita
 *   POST /api/veiculos/:id/transicao  { acao: inativar | reativar }
 */

export const TIPOS_VEICULO = ['truck', 'carreta', 'van'] as const
export type TipoVeiculo = (typeof TIPOS_VEICULO)[number]

export interface Veiculo {
  id: string
  codigo: string
  tipo: TipoVeiculo
  /** m² */
  volumeMinimo: number | null
  /** m² */
  volumeMaximo: number | null
  /** metros */
  comprimento: number | null
  /** metros */
  largura: number | null
  /** Quantidade de pallets. */
  capacidadePallets: number | null
  /** toneladas */
  capacidadeToneladas: number | null
  status: StatusCadastro
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}

export interface VeiculoDetalhe extends Veiculo {
  historico: EventoHistorico[]
  acoesPermitidas: AcaoCadastro[]
}

const medida = (max: number) =>
  z
    .number()
    .min(0)
    .max(max)
    .nullish()
    .transform((v) => v ?? null)

export const veiculoInputSchema = z
  .object({
    tipo: z.enum(TIPOS_VEICULO, 'Tipo de veículo inválido.'),
    volumeMinimo: medida(10_000),
    volumeMaximo: medida(10_000),
    comprimento: medida(50),
    largura: medida(10),
    capacidadePallets: z
      .number()
      .int('Capacidade em pallets deve ser um número inteiro.')
      .min(0)
      .max(1000)
      .nullish()
      .transform((v) => v ?? null),
    capacidadeToneladas: medida(200),
  })
  .refine(
    (v) => v.volumeMinimo === null || v.volumeMaximo === null || v.volumeMinimo <= v.volumeMaximo,
    { message: 'O volume mínimo não pode ser maior que o máximo.', path: ['volumeMinimo'] },
  )

const CAMPOS = [
  'tipo',
  'volumeMinimo',
  'volumeMaximo',
  'comprimento',
  'largura',
  'capacidadePallets',
  'capacidadeToneladas',
] as const

export const COLUNAS_VEICULO: ColunaConsulta[] = [
  { id: 'codigo', tipo: 'unique-text' },
  { id: 'tipo', tipo: 'enum' },
  { id: 'volumeMinimo', tipo: 'number' },
  { id: 'volumeMaximo', tipo: 'number' },
  { id: 'comprimento', tipo: 'number' },
  { id: 'largura', tipo: 'number' },
  { id: 'capacidadePallets', tipo: 'number' },
  { id: 'capacidadeToneladas', tipo: 'number' },
  { id: 'status', tipo: 'status', ordem: ORDEM_STATUS },
  { id: 'criadoEm', tipo: 'date' },
]

type Linha = Awaited<ReturnType<typeof linhaPorId>>
async function linhaPorId(db: Db, id: string) {
  return db.selectFrom('veiculos').selectAll().where('id', '=', id).executeTakeFirst()
}

const paraVeiculo = (l: NonNullable<Linha>): Veiculo => ({
  id: l.id,
  codigo: l.codigo,
  tipo: l.tipo as TipoVeiculo,
  volumeMinimo: l.volumeMinimo,
  volumeMaximo: l.volumeMaximo,
  comprimento: l.comprimento,
  largura: l.largura,
  capacidadePallets: l.capacidadePallets,
  capacidadeToneladas: l.capacidadeToneladas,
  status: l.status as StatusCadastro,
  criadoEm: l.criadoEm,
  criadoPor: l.criadoPor,
  alteradoEm: l.alteradoEm,
  alteradoPor: l.alteradoPor,
})

export function criarServicoVeiculos(db: Db) {
  async function obter(id: string): Promise<VeiculoDetalhe> {
    const l = await linhaPorId(db, id)
    if (!l) throw naoEncontrado('Veículo não encontrado.')
    return {
      ...paraVeiculo(l),
      historico: await listarHistorico(db, 'veiculo', id),
      acoesPermitidas: acoesCadastro(l.status as StatusCadastro),
    }
  }

  return {
    obter,

    async listar(query: unknown) {
      const consulta = lerConsulta(query, COLUNAS_VEICULO)
      const where = whereDaConsulta(COLUNAS_VEICULO, consulta, { colunaBusca: 'busca' })
      let pagina = db.selectFrom('veiculos').selectAll().where(where)
      for (const o of ordemDaConsulta(COLUNAS_VEICULO, consulta, [{ id: 'codigo', desc: false }]))
        pagina = pagina.orderBy(o)
      const [linhas, total] = await Promise.all([
        pagina
          .limit(consulta.pageSize)
          .offset((consulta.page - 1) * consulta.pageSize)
          .execute(),
        db
          .selectFrom('veiculos')
          .select(sql<number>`count(*)`.as('n'))
          .where(where)
          .executeTakeFirstOrThrow(),
      ])
      const facets: Record<string, Record<string, number>> = {}
      for (const coluna of ['tipo', 'status'] as const) {
        const grupos = await db
          .selectFrom('veiculos')
          .select([coluna, sql<number>`count(*)`.as('n')])
          .where(
            whereDaConsulta(COLUNAS_VEICULO, consulta, { colunaBusca: 'busca', semFiltro: coluna }),
          )
          .groupBy(coluna)
          .execute()
        facets[coluna] = Object.fromEntries(grupos.map((g) => [g[coluna], Number(g.n)]))
      }
      return { rows: linhas.map(paraVeiculo), total: Number(total.n), totals: {}, facets }
    },

    async resumo() {
      const grupos = await db
        .selectFrom('veiculos')
        .select(['status', sql<number>`count(*)`.as('n')])
        .groupBy('status')
        .execute()
      const c = Object.fromEntries(grupos.map((g) => [g.status, Number(g.n)]))
      const ativos = c.ativo ?? 0
      const inativos = c.inativo ?? 0
      return { total: ativos + inativos, ativos, inativos }
    },

    async criar(corpo: unknown, autor: string) {
      const dados = veiculoInputSchema.parse(corpo)
      const id = randomUUID()
      await db.transaction().execute(async (trx) => {
        const numero = await proximoNumero(trx, 'veiculos')
        const codigo = codigoCom('VEI', numero)
        const agora = new Date().toISOString()
        await trx
          .insertInto('veiculos')
          .values({
            ...dados,
            id,
            numero,
            codigo,
            status: 'ativo',
            busca: normalizar(`${codigo} ${dados.tipo}`),
            criadoEm: agora,
            criadoPor: autor,
            alteradoEm: agora,
            alteradoPor: autor,
          })
          .execute()
        await registrarHistorico(trx, 'veiculo', id, { autor, em: agora, acao: 'criado' })
      })
      return obter(id)
    },

    async atualizar(id: string, corpo: unknown, autor: string) {
      const dados = veiculoInputSchema.parse(corpo)
      await db.transaction().execute(async (trx) => {
        const atual = await trx
          .selectFrom('veiculos')
          .selectAll()
          .where('id', '=', id)
          .executeTakeFirst()
        if (!atual) throw naoEncontrado('Veículo não encontrado.')
        const mudancas = mudancasEntre(atual, dados, CAMPOS)
        if (!mudancas.length) return
        const agora = new Date().toISOString()
        await trx
          .updateTable('veiculos')
          .set({
            ...dados,
            busca: normalizar(`${atual.codigo} ${dados.tipo}`),
            alteradoEm: agora,
            alteradoPor: autor,
          })
          .where('id', '=', id)
          .execute()
        await registrarHistorico(trx, 'veiculo', id, {
          autor,
          em: agora,
          acao: 'editado',
          mudancas,
        })
      })
      return obter(id)
    },

    async transicionar(id: string, corpo: unknown, autor: string) {
      const { acao } = z.object({ acao: z.enum(['inativar', 'reativar']) }).parse(corpo)
      await db.transaction().execute(async (trx) => {
        const atual = await trx
          .selectFrom('veiculos')
          .selectAll()
          .where('id', '=', id)
          .executeTakeFirst()
        if (!atual) throw naoEncontrado('Veículo não encontrado.')
        const destino = destinoDe(atual.status as StatusCadastro, acao)
        const agora = new Date().toISOString()
        await trx
          .updateTable('veiculos')
          .set({ status: destino, alteradoEm: agora, alteradoPor: autor })
          .where('id', '=', id)
          .execute()
        await registrarHistorico(trx, 'veiculo', id, {
          autor,
          em: agora,
          acao: 'status',
          mudancas: [{ campo: 'status', antes: atual.status, depois: destino }],
        })
      })
      return obter(id)
    },
  }
}

export function rotasVeiculos(servico: ReturnType<typeof criarServicoVeiculos>) {
  const r = Router()
  r.get('/resumo', async (_req, res) => {
    res.json(await servico.resumo())
  })
  r.get('/', async (req, res) => {
    res.json(await servico.listar(req.query))
  })
  r.get('/:id', async (req, res) => {
    res.json(await servico.obter(req.params.id))
  })
  r.post('/', async (req, res) => {
    res.status(201).json(await servico.criar(req.body, autorDa(req)))
  })
  r.put('/:id', async (req, res) => {
    res.json(await servico.atualizar(req.params.id, req.body, autorDa(req)))
  })
  r.post('/:id/transicao', async (req, res) => {
    res.json(await servico.transicionar(req.params.id, req.body, autorDa(req)))
  })
  return r
}
