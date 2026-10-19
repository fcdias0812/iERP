import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { sql, type Transaction } from 'kysely'
import { z } from 'zod'
import type { Db } from '../../db/database.js'
import type { Database } from '../../db/schema.js'
import { autorDa } from '../../shared/autor.js'
import {
  acoesCadastro,
  destinoDe,
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
import { limparTelefone, soAlfanumerico, telefoneValido } from '../../shared/documentos.js'
import { naoEncontrado } from '../../shared/erros.js'
import type { EventoHistorico, Mudanca } from '../../shared/historico.js'
import { listarHistorico, registrarHistorico } from '../../shared/historico.repositorio.js'
import type { MotoristaResumo } from '../motoristas/motoristas.js'
import {
  buscaTransportadora,
  cnpjEmUso,
  inserirMotorista,
  inserirTransportadora,
  motoristaBasicoSchema,
  transportadoraBasicaSchema,
} from '../relacionamento.basico.js'

/*
 * Relacionamento › Transportadoras. Contatos OPCIONAIS (o principal é o primeiro) e motoristas
 * vinculados (opcional): da lista ou criados na hora. Contrato espelhado em
 * src/services/types.ts do frontend.
 *
 *   GET  /api/transportadoras            lista (formato do DataTable)
 *   GET  /api/transportadoras/resumo     total, ativos, inativos
 *   GET  /api/transportadoras/opcoes     id + nome (para escolher no motorista)
 *   GET  /api/transportadoras/:id        detalhe + contatos + motoristas + histórico
 *   POST /api/transportadoras            cria
 *   PUT  /api/transportadoras/:id        edita (contatos com id são mantidos; motoristas)
 *   POST /api/transportadoras/:id/transicao  { acao: inativar | reativar }
 */

type Trx = Transaction<Database>

export interface ContatoTransportadora {
  id: string
  nome: string | null
  email: string
  /** Só dígitos. */
  telefone: string
  principal: boolean
}

export interface TransportadoraResumo {
  id: string
  codigo: string
  nome: string
  cnpj: string
  contatoNome: string | null
  contatoEmail: string | null
  contatoTelefone: string | null
  contatos: number
  motoristas: number
  status: StatusCadastro
  criadoEm: string
}

export interface Transportadora {
  id: string
  codigo: string
  nome: string
  cnpj: string
  status: StatusCadastro
  contatos: ContatoTransportadora[]
  motoristas: MotoristaResumo[]
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
  historico: EventoHistorico[]
  acoesPermitidas: AcaoCadastro[]
}

const contatoSchema = z.object({
  id: z.string().nullish(),
  nome: z
    .string()
    .trim()
    .max(120)
    .nullish()
    .transform((v) => v || null),
  email: z.string().trim().toLowerCase().pipe(z.email('E-mail do contato inválido.').max(160)),
  telefone: z
    .string()
    .transform(limparTelefone)
    .refine(telefoneValido, 'Telefone do contato inválido (DDD + número).'),
  principal: z.boolean(),
})

export const transportadoraInputSchema = transportadoraBasicaSchema.extend({
  contatos: z
    .array(contatoSchema)
    .max(20)
    .refine(
      (l) => l.length === 0 || l.filter((c) => c.principal).length === 1,
      'Marque exatamente um contato como principal.',
    ),
  /** Motoristas vinculados: existente (`id`) ou novo (`novo`). */
  motoristas: z
    .array(z.union([z.object({ id: z.string() }), z.object({ novo: motoristaBasicoSchema })]))
    .max(200)
    .default([]),
})

export const COLUNAS_TRANSPORTADORA: ColunaConsulta[] = [
  { id: 'codigo', tipo: 'unique-text' },
  { id: 'nome', tipo: 'unique-text' },
  { id: 'cnpj', tipo: 'unique-text', limpar: soAlfanumerico },
  { id: 'contatoEmail', tipo: 'unique-text' },
  { id: 'contatoTelefone', tipo: 'unique-text', limpar: limparTelefone },
  { id: 'motoristas', tipo: 'number' },
  { id: 'status', tipo: 'status', ordem: ORDEM_STATUS },
  { id: 'criadoEm', tipo: 'date' },
]

const resumoContatos = (l: { email: string; principal: boolean }[]) =>
  l.map((c) => (c.principal ? `${c.email} (principal)` : c.email)).join(', ')

export function criarServicoTransportadoras(db: Db) {
  async function obter(id: string, cx: Db | Trx = db): Promise<Transportadora> {
    const t = await cx
      .selectFrom('transportadoras')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
    if (!t) throw naoEncontrado('Transportadora não encontrada.')
    const [contatos, motoristas, historico] = await Promise.all([
      cx
        .selectFrom('transportadorasContatos')
        .selectAll()
        .where('transportadoraId', '=', id)
        .orderBy('principal', 'desc')
        .orderBy('ordem', 'asc')
        .execute(),
      cx
        .selectFrom('motoristasLista')
        .selectAll()
        .where('transportadoraId', '=', id)
        .orderBy(sql`lower(nome)`)
        .execute(),
      listarHistorico(cx, 'transportadora', id),
    ])
    return {
      id: t.id,
      codigo: t.codigo,
      nome: t.nome,
      cnpj: t.cnpj,
      status: t.status as StatusCadastro,
      contatos: contatos.map((k) => ({
        id: k.id,
        nome: k.nome,
        email: k.email,
        telefone: k.telefone,
        principal: k.principal === 1,
      })),
      motoristas: motoristas.map((m) => ({
        id: m.id,
        codigo: m.codigo,
        nome: m.nome,
        cpf: m.cpf,
        telefone: m.telefone,
        transportadoraId: m.transportadoraId,
        transportadoraNome: m.transportadoraNome,
        status: m.status as StatusCadastro,
        criadoEm: m.criadoEm,
      })),
      criadoEm: t.criadoEm,
      criadoPor: t.criadoPor,
      alteradoEm: t.alteradoEm,
      alteradoPor: t.alteradoPor,
      historico,
      acoesPermitidas: acoesCadastro(t.status as StatusCadastro),
    }
  }

  /** Grava os contatos (com id = atualiza; sem id = cria; os que saíram = remove). */
  async function gravarContatos(trx: Trx, id: string, contatos: z.output<typeof contatoSchema>[]) {
    const existentes = new Set(
      (
        await trx
          .selectFrom('transportadorasContatos')
          .select('id')
          .where('transportadoraId', '=', id)
          .execute()
      ).map((r) => r.id),
    )
    const mantidos = new Set<string>()
    for (const [i, k] of contatos.entries()) {
      const valores = {
        nome: k.nome,
        email: k.email,
        telefone: k.telefone,
        principal: k.principal ? 1 : 0,
        ordem: i,
      }
      if (k.id && existentes.has(k.id)) {
        mantidos.add(k.id)
        await trx
          .updateTable('transportadorasContatos')
          .set(valores)
          .where('id', '=', k.id)
          .execute()
      } else
        await trx
          .insertInto('transportadorasContatos')
          .values({ ...valores, id: randomUUID(), transportadoraId: id })
          .execute()
    }
    const remover = [...existentes].filter((x) => !mantidos.has(x))
    if (remover.length)
      await trx.deleteFrom('transportadorasContatos').where('id', 'in', remover).execute()
  }

  /**
   * Vincula exatamente os motoristas informados (cria os novos). Quem saiu da lista fica sem
   * transportadora; quem veio de outra transportadora muda de vínculo. Tudo no histórico do
   * motorista. Devolve os nomes antes → depois (para o histórico da transportadora).
   */
  async function gravarMotoristas(
    trx: Trx,
    id: string,
    nome: string,
    lista: z.output<typeof transportadoraInputSchema>['motoristas'],
    autor: string,
  ): Promise<Mudanca | null> {
    const antes = await trx
      .selectFrom('motoristas')
      .select(['id', 'nome'])
      .where('transportadoraId', '=', id)
      .orderBy('nome')
      .execute()
    const agora = new Date().toISOString()
    const desejados = new Set<string>()
    for (const item of lista) {
      if ('novo' in item) {
        desejados.add(await inserirMotorista(trx, { ...item.novo, transportadoraId: id }, autor))
        continue
      }
      const m = await trx
        .selectFrom('motoristasLista')
        .select(['id', 'transportadoraId', 'transportadoraNome'])
        .where('id', '=', item.id)
        .executeTakeFirst()
      if (!m) throw naoEncontrado('Motorista não encontrado.')
      desejados.add(m.id)
      if (m.transportadoraId === id) continue
      await trx
        .updateTable('motoristas')
        .set({ transportadoraId: id, alteradoEm: agora, alteradoPor: autor })
        .where('id', '=', m.id)
        .execute()
      await registrarHistorico(trx, 'motorista', m.id, {
        autor,
        em: agora,
        acao: 'editado',
        mudancas: [{ campo: 'transportadora', antes: m.transportadoraNome, depois: nome }],
      })
    }
    for (const m of antes.filter((x) => !desejados.has(x.id))) {
      await trx
        .updateTable('motoristas')
        .set({ transportadoraId: null, alteradoEm: agora, alteradoPor: autor })
        .where('id', '=', m.id)
        .execute()
      await registrarHistorico(trx, 'motorista', m.id, {
        autor,
        em: agora,
        acao: 'editado',
        mudancas: [{ campo: 'transportadora', antes: nome, depois: null }],
      })
    }
    const depois = await trx
      .selectFrom('motoristas')
      .select('nome')
      .where('transportadoraId', '=', id)
      .orderBy('nome')
      .execute()
    const a = antes.map((m) => m.nome).join(', ')
    const d = depois.map((m) => m.nome).join(', ')
    return a === d ? null : { campo: 'motoristas', antes: a || null, depois: d || null }
  }

  async function atualizarBusca(trx: Trx, id: string) {
    const t = await trx
      .selectFrom('transportadoras')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
    const contatos = await trx
      .selectFrom('transportadorasContatos')
      .selectAll()
      .where('transportadoraId', '=', id)
      .execute()
    await trx
      .updateTable('transportadoras')
      .set({ busca: buscaTransportadora(t, contatos) })
      .where('id', '=', id)
      .execute()
  }

  return {
    obter,

    async listar(query: unknown) {
      const consulta = lerConsulta(query, COLUNAS_TRANSPORTADORA)
      const where = whereDaConsulta(COLUNAS_TRANSPORTADORA, consulta, { colunaBusca: 'busca' })
      let pagina = db.selectFrom('transportadorasLista').selectAll().where(where)
      for (const o of ordemDaConsulta(COLUNAS_TRANSPORTADORA, consulta, [
        { id: 'nome', desc: false },
      ]))
        pagina = pagina.orderBy(o)
      const [linhas, total, grupos] = await Promise.all([
        pagina
          .limit(consulta.pageSize)
          .offset((consulta.page - 1) * consulta.pageSize)
          .execute(),
        db
          .selectFrom('transportadorasLista')
          .select(sql<number>`count(*)`.as('n'))
          .where(where)
          .executeTakeFirstOrThrow(),
        db
          .selectFrom('transportadorasLista')
          .select(['status', sql<number>`count(*)`.as('n')])
          .where(
            whereDaConsulta(COLUNAS_TRANSPORTADORA, consulta, {
              colunaBusca: 'busca',
              semFiltro: 'status',
            }),
          )
          .groupBy('status')
          .execute(),
      ])
      return {
        rows: linhas.map((l): TransportadoraResumo => ({
          id: l.id,
          codigo: l.codigo,
          nome: l.nome,
          cnpj: l.cnpj,
          contatoNome: l.contatoNome,
          contatoEmail: l.contatoEmail,
          contatoTelefone: l.contatoTelefone,
          contatos: Number(l.contatos),
          motoristas: Number(l.motoristas),
          status: l.status as StatusCadastro,
          criadoEm: l.criadoEm,
        })),
        total: Number(total.n),
        totals: {},
        facets: { status: Object.fromEntries(grupos.map((g) => [g.status, Number(g.n)])) },
      }
    },

    async resumo() {
      const grupos = await db
        .selectFrom('transportadoras')
        .select(['status', sql<number>`count(*)`.as('n')])
        .groupBy('status')
        .execute()
      const c = Object.fromEntries(grupos.map((g) => [g.status, Number(g.n)]))
      const ativos = c.ativo ?? 0
      const inativos = c.inativo ?? 0
      return { total: ativos + inativos, ativos, inativos }
    },

    /** Opções para escolher a transportadora (motorista). */
    async opcoes() {
      return db
        .selectFrom('transportadoras')
        .select(['id', 'nome', 'cnpj', 'status'])
        .orderBy(sql`lower(nome)`)
        .execute()
    },

    async criar(corpo: unknown, autor: string) {
      const dados = transportadoraInputSchema.parse(corpo)
      const id = await db.transaction().execute(async (trx) => {
        const novoId = await inserirTransportadora(trx, dados, autor)
        await gravarContatos(trx, novoId, dados.contatos)
        await gravarMotoristas(trx, novoId, dados.nome, dados.motoristas, autor)
        await atualizarBusca(trx, novoId)
        return novoId
      })
      return obter(id)
    },

    async atualizar(id: string, corpo: unknown, autor: string) {
      const dados = transportadoraInputSchema.parse(corpo)
      await db.transaction().execute(async (trx) => {
        const atual = await obter(id, trx)
        if (
          await trx
            .selectFrom('transportadoras')
            .select('id')
            .where('cnpj', '=', dados.cnpj)
            .where('id', '<>', id)
            .executeTakeFirst()
        )
          throw cnpjEmUso()
        const mudancas: Mudanca[] = (['nome', 'cnpj'] as const)
          .filter((k) => atual[k] !== dados[k])
          .map((k) => ({ campo: k, antes: atual[k], depois: dados[k] }))
        const contatosAntes = resumoContatos(atual.contatos)
        const contatosDepois = resumoContatos(dados.contatos)
        if (contatosAntes !== contatosDepois)
          mudancas.push({
            campo: 'contatos',
            antes: contatosAntes || null,
            depois: contatosDepois || null,
          })
        const agora = new Date().toISOString()
        await trx
          .updateTable('transportadoras')
          .set({ nome: dados.nome, cnpj: dados.cnpj, alteradoEm: agora, alteradoPor: autor })
          .where('id', '=', id)
          .execute()
        await gravarContatos(trx, id, dados.contatos)
        const mudMotoristas = await gravarMotoristas(trx, id, dados.nome, dados.motoristas, autor)
        if (mudMotoristas) mudancas.push(mudMotoristas)
        await atualizarBusca(trx, id)
        if (mudancas.length)
          await registrarHistorico(trx, 'transportadora', id, {
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
          .selectFrom('transportadoras')
          .selectAll()
          .where('id', '=', id)
          .executeTakeFirst()
        if (!atual) throw naoEncontrado('Transportadora não encontrada.')
        const destino = destinoDe(atual.status as StatusCadastro, acao)
        const agora = new Date().toISOString()
        await trx
          .updateTable('transportadoras')
          .set({ status: destino, alteradoEm: agora, alteradoPor: autor })
          .where('id', '=', id)
          .execute()
        await registrarHistorico(trx, 'transportadora', id, {
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
      return db
        .selectFrom('transportadorasLista')
        .select(['id', 'codigo', 'nome'])
        .where(
          whereDaConsulta(
            COLUNAS_TRANSPORTADORA,
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
    },
  }
}

export type ServicoTransportadoras = ReturnType<typeof criarServicoTransportadoras>

export function rotasTransportadoras(servico: ServicoTransportadoras) {
  const r = Router()
  r.get('/resumo', async (_req, res) => {
    res.json(await servico.resumo())
  })
  r.get('/opcoes', async (_req, res) => {
    res.json(await servico.opcoes())
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
