import { Router } from 'express'
import { sql } from 'kysely'
import { z } from 'zod'
import type { Db } from '../../db/database.js'
import { autorDa } from '../../shared/autor.js'
import {
  acoesCadastro,
  destinoDe,
  mudancasEntre,
  ORDEM_STATUS,
  type AcaoCadastro,
  type StatusCadastro,
} from '../../shared/cadastro.js'
import {
  lerConsulta,
  ordemDaConsulta,
  whereDaConsulta,
  type ColunaConsulta,
} from '../../shared/consulta-tabela.js'
import { limparCpf, limparTelefone } from '../../shared/documentos.js'
import { ErroApi, naoEncontrado } from '../../shared/erros.js'
import type { EventoHistorico } from '../../shared/historico.js'
import { listarHistorico, registrarHistorico } from '../../shared/historico.repositorio.js'
import {
  buscaMotorista,
  cpfEmUso,
  inserirMotorista,
  inserirTransportadora,
  motoristaBasicoSchema,
  transportadoraBasicaSchema,
} from '../relacionamento.basico.js'

/*
 * Relacionamento › Motoristas. Transportadora é OPCIONAL: existente, nenhuma, ou uma nova
 * criada na hora (nome + CNPJ). Contrato espelhado em src/services/types.ts do frontend.
 *
 *   GET  /api/motoristas            lista (formato do DataTable)
 *   GET  /api/motoristas/resumo     total, ativos, inativos, sem transportadora
 *   GET  /api/motoristas/:id        detalhe + histórico
 *   POST /api/motoristas            cria
 *   PUT  /api/motoristas/:id        edita
 *   POST /api/motoristas/:id/transicao  { acao: inativar | reativar }
 */

export interface MotoristaResumo {
  id: string
  codigo: string
  nome: string
  /** Só dígitos. */
  cpf: string
  /** Só dígitos. */
  telefone: string
  transportadoraId: string | null
  transportadoraNome: string | null
  status: StatusCadastro
  criadoEm: string
}

export interface Motorista extends MotoristaResumo {
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
  historico: EventoHistorico[]
  acoesPermitidas: AcaoCadastro[]
}

export const motoristaInputSchema = motoristaBasicoSchema
  .extend({
    transportadoraId: z
      .string()
      .nullish()
      .transform((v) => v || null),
    novaTransportadora: transportadoraBasicaSchema.nullish().transform((v) => v ?? null),
  })
  .refine((m) => !(m.transportadoraId && m.novaTransportadora), {
    message: 'Escolha uma transportadora existente OU cadastre uma nova.',
    path: ['transportadoraId'],
  })

export const COLUNAS_MOTORISTA: ColunaConsulta[] = [
  { id: 'codigo', tipo: 'unique-text' },
  { id: 'nome', tipo: 'unique-text' },
  { id: 'cpf', tipo: 'unique-text', limpar: limparCpf },
  { id: 'telefone', tipo: 'unique-text', limpar: limparTelefone },
  { id: 'transportadoraNome', tipo: 'unique-text' },
  { id: 'status', tipo: 'status', ordem: ORDEM_STATUS },
  { id: 'criadoEm', tipo: 'date' },
]

type Linha = NonNullable<Awaited<ReturnType<typeof linha>>>
const linha = (db: Db, id: string) =>
  db.selectFrom('motoristasLista').selectAll().where('id', '=', id).executeTakeFirst()

const paraResumo = (l: Linha): MotoristaResumo => ({
  id: l.id,
  codigo: l.codigo,
  nome: l.nome,
  cpf: l.cpf,
  telefone: l.telefone,
  transportadoraId: l.transportadoraId,
  transportadoraNome: l.transportadoraNome,
  status: l.status as StatusCadastro,
  criadoEm: l.criadoEm,
})

export function criarServicoMotoristas(db: Db) {
  async function obter(id: string): Promise<Motorista> {
    const l = await linha(db, id)
    if (!l) throw naoEncontrado('Motorista não encontrado.')
    return {
      ...paraResumo(l),
      criadoPor: l.criadoPor,
      alteradoEm: l.alteradoEm,
      alteradoPor: l.alteradoPor,
      historico: await listarHistorico(db, 'motorista', id),
      acoesPermitidas: acoesCadastro(l.status as StatusCadastro),
    }
  }

  /** Transportadora do formulário: existente (confere), nova (cria) ou nenhuma. */
  async function resolverTransportadora(
    trx: Parameters<Parameters<ReturnType<Db['transaction']>['execute']>[0]>[0],
    dados: z.output<typeof motoristaInputSchema>,
    autor: string,
  ): Promise<string | null> {
    if (dados.novaTransportadora) return inserirTransportadora(trx, dados.novaTransportadora, autor)
    if (!dados.transportadoraId) return null
    const existe = await trx
      .selectFrom('transportadoras')
      .select('id')
      .where('id', '=', dados.transportadoraId)
      .executeTakeFirst()
    if (!existe) throw new ErroApi(422, 'validation', 'Transportadora não encontrada.')
    return dados.transportadoraId
  }

  return {
    obter,

    async listar(query: unknown) {
      const consulta = lerConsulta(query, COLUNAS_MOTORISTA)
      const where = whereDaConsulta(COLUNAS_MOTORISTA, consulta, { colunaBusca: 'busca' })
      let pagina = db.selectFrom('motoristasLista').selectAll().where(where)
      for (const o of ordemDaConsulta(COLUNAS_MOTORISTA, consulta, [{ id: 'nome', desc: false }]))
        pagina = pagina.orderBy(o)
      const [linhas, total, grupos] = await Promise.all([
        pagina
          .limit(consulta.pageSize)
          .offset((consulta.page - 1) * consulta.pageSize)
          .execute(),
        db
          .selectFrom('motoristasLista')
          .select(sql<number>`count(*)`.as('n'))
          .where(where)
          .executeTakeFirstOrThrow(),
        db
          .selectFrom('motoristasLista')
          .select(['status', sql<number>`count(*)`.as('n')])
          .where(
            whereDaConsulta(COLUNAS_MOTORISTA, consulta, {
              colunaBusca: 'busca',
              semFiltro: 'status',
            }),
          )
          .groupBy('status')
          .execute(),
      ])
      return {
        rows: linhas.map(paraResumo),
        total: Number(total.n),
        totals: {},
        facets: { status: Object.fromEntries(grupos.map((g) => [g.status, Number(g.n)])) },
      }
    },

    async resumo() {
      const [grupos, semVinculo] = await Promise.all([
        db
          .selectFrom('motoristas')
          .select(['status', sql<number>`count(*)`.as('n')])
          .groupBy('status')
          .execute(),
        db
          .selectFrom('motoristas')
          .select(sql<number>`count(*)`.as('n'))
          .where('transportadoraId', 'is', null)
          .executeTakeFirstOrThrow(),
      ])
      const c = Object.fromEntries(grupos.map((g) => [g.status, Number(g.n)]))
      const ativos = c.ativo ?? 0
      const inativos = c.inativo ?? 0
      return { total: ativos + inativos, ativos, inativos, semTransportadora: Number(semVinculo.n) }
    },

    async criar(corpo: unknown, autor: string) {
      const dados = motoristaInputSchema.parse(corpo)
      const id = await db.transaction().execute(async (trx) => {
        const transportadoraId = await resolverTransportadora(trx, dados, autor)
        return inserirMotorista(trx, { ...dados, transportadoraId }, autor)
      })
      return obter(id)
    },

    async atualizar(id: string, corpo: unknown, autor: string) {
      const dados = motoristaInputSchema.parse(corpo)
      await db.transaction().execute(async (trx) => {
        const atual = await trx
          .selectFrom('motoristasLista')
          .selectAll()
          .where('id', '=', id)
          .executeTakeFirst()
        if (!atual) throw naoEncontrado('Motorista não encontrado.')
        if (
          await trx
            .selectFrom('motoristas')
            .select('id')
            .where('cpf', '=', dados.cpf)
            .where('id', '<>', id)
            .executeTakeFirst()
        )
          throw cpfEmUso()
        const transportadoraId = await resolverTransportadora(trx, dados, autor)
        const mudancas = mudancasEntre(atual, dados, ['nome', 'cpf', 'telefone'] as const)
        if ((atual.transportadoraId ?? null) !== transportadoraId) {
          const nova = transportadoraId
            ? await trx
                .selectFrom('transportadoras')
                .select('nome')
                .where('id', '=', transportadoraId)
                .executeTakeFirst()
            : undefined
          mudancas.push({
            campo: 'transportadora',
            antes: atual.transportadoraNome,
            depois: nova?.nome ?? null,
          })
        }
        if (!mudancas.length) return
        const agora = new Date().toISOString()
        await trx
          .updateTable('motoristas')
          .set({
            nome: dados.nome,
            cpf: dados.cpf,
            telefone: dados.telefone,
            transportadoraId,
            busca: buscaMotorista({ ...dados, codigo: atual.codigo }),
            alteradoEm: agora,
            alteradoPor: autor,
          })
          .where('id', '=', id)
          .execute()
        await registrarHistorico(trx, 'motorista', id, {
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
          .selectFrom('motoristas')
          .selectAll()
          .where('id', '=', id)
          .executeTakeFirst()
        if (!atual) throw naoEncontrado('Motorista não encontrado.')
        const destino = destinoDe(atual.status as StatusCadastro, acao)
        const agora = new Date().toISOString()
        await trx
          .updateTable('motoristas')
          .set({ status: destino, alteradoEm: agora, alteradoPor: autor })
          .where('id', '=', id)
          .execute()
        await registrarHistorico(trx, 'motorista', id, {
          autor,
          em: agora,
          acao: 'status',
          mudancas: [{ campo: 'status', antes: atual.status, depois: destino }],
        })
      })
      return obter(id)
    },

    /** Busca rápida (Ctrl+K). */
    async buscar(termo: string) {
      const linhas = await db
        .selectFrom('motoristasLista')
        .selectAll()
        .where(
          whereDaConsulta(
            COLUNAS_MOTORISTA,
            {
              search: termo,
              sort: [],
              filters: [],
              advanced: { logic: 'and', conditions: [] },
              page: 1,
              pageSize: 5,
            },
            { colunaBusca: 'busca' },
          ),
        )
        .orderBy(sql`lower(nome)`)
        .limit(5)
        .execute()
      return linhas.map(paraResumo)
    },
  }
}

export type ServicoMotoristas = ReturnType<typeof criarServicoMotoristas>

export function rotasMotoristas(servico: ServicoMotoristas) {
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
