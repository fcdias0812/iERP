import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { sql } from 'kysely'
import { z } from 'zod'
import type { Transaction } from 'kysely'
import type { Db } from '../../db/database.js'
import type { Database } from '../../db/schema.js'
import { autorDa } from '../../shared/autor.js'
import {
  acoesCadastro,
  destinoDe,
  type AcaoCadastro,
  type StatusCadastro,
} from '../../shared/cadastro.js'
import { diaNoFuso } from '../../shared/datas.js'
import { ErroApi, naoEncontrado } from '../../shared/erros.js'
import type { EventoHistorico, Mudanca } from '../../shared/historico.js'
import {
  listarHistorico,
  registrarHistorico,
  type Entidade,
} from '../../shared/historico.repositorio.js'
import { normalizar } from '../../shared/texto.js'
import { original, textoTraduzidoSchema, type LocalizedText } from '../ordens/ordens.lote.js'

/*
 * Sistema › Cadastros (pedido do usuário, 19/10/2026): materiais, áreas do estoque e recipientes
 * (caixotes e pallets). Listas pequenas: a API devolve a lista inteira e a tela filtra/ordena
 * (DataTable em modo cliente). Não se exclui: inativa/reativa, com histórico.
 *
 *   GET/POST /api/materiais          lista (com quantos recipientes usam) / cria { nome }
 *   GET/PUT  /api/materiais/:id      detalhe + histórico / edita
 *   POST     /api/materiais/:id/transicao   { acao: inativar | reativar }
 *   (o mesmo para /api/areas — { nome, descricao } — e /api/recipientes —
 *    { tipo, materialId, taraKg, areaId, posicao }; GET /api/recipientes?tipo=caixote|pallet)
 *
 * Recipientes: código automático por tipo e ano (CXT-20260001, PLT-20260001 — decisão dele);
 * material e área precisam estar ATIVOS para um recipiente novo ou alterado.
 */

/* ------------------------------------------------------------ contrato (espelho de src/services/types.ts) */

interface Controle {
  id: string
  status: StatusCadastro
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}
interface ComHistorico {
  historico: EventoHistorico[]
  acoesPermitidas: AcaoCadastro[]
}

export interface Material extends Controle {
  nome: LocalizedText
  /** Quantos recipientes (ativos ou não) guardam este material. */
  recipientes: number
}
export interface AreaEstoque extends Controle {
  nome: string
  descricao: LocalizedText | null
  recipientes: number
}
export const TIPOS_RECIPIENTE = ['caixote', 'pallet'] as const
export type TipoRecipiente = (typeof TIPOS_RECIPIENTE)[number]
export interface Recipiente extends Controle {
  tipo: TipoRecipiente
  codigo: string
  materialId: string
  materialNome: LocalizedText
  areaId: string
  areaNome: string
  posicao: string
  /** kg */
  taraKg: number
}
export type MaterialDetalhe = Material & ComHistorico
export type AreaEstoqueDetalhe = AreaEstoque & ComHistorico
export type RecipienteDetalhe = Recipiente & ComHistorico

/* ------------------------------------------------------------ regras */

const materialSchema = z.object({ nome: textoTraduzidoSchema })
const areaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da área.').max(60),
  descricao: textoTraduzidoSchema.nullish().transform((v) => v ?? null),
})
const recipienteSchema = z.object({
  tipo: z.enum(TIPOS_RECIPIENTE, { error: 'Tipo de recipiente inválido.' }),
  materialId: z.string().min(1, 'Escolha o material.'),
  taraKg: z.number({ error: 'Informe a tara.' }).min(0).max(10_000),
  areaId: z.string().min(1, 'Escolha a área.'),
  posicao: z.string().trim().min(1, 'Informe a posição.').max(40),
})

const PREFIXO: Record<TipoRecipiente, string> = { caixote: 'CXT', pallet: 'PLT' }
const transicaoSchema = z.object({ acao: z.enum(['inativar', 'reativar']) })

const json = <T>(v: string | null) => (v ? (JSON.parse(v) as T) : null)
const nomeEmPortugues = (t: LocalizedText) => t.textos['pt-BR']?.trim() || original(t)

/* ------------------------------------------------------------ serviço */

type Conexao = Db | Transaction<Database>

export function criarServicoCadastros(db: Db) {
  const contagem = (coluna: 'materialId' | 'areaId') =>
    db
      .selectFrom('recipientes')
      .select([coluna, sql<number>`count(*)`.as('n')])
      .groupBy(coluna)
      .execute()
      .then((g) => new Map(g.map((x) => [x[coluna], Number(x.n)])))

  const controle = (l: {
    id: string
    status: string
    criadoEm: string
    criadoPor: string
    alteradoEm: string
    alteradoPor: string
  }) => ({
    id: l.id,
    status: l.status as StatusCadastro,
    criadoEm: l.criadoEm,
    criadoPor: l.criadoPor,
    alteradoEm: l.alteradoEm,
    alteradoPor: l.alteradoPor,
  })

  async function detalhe<T extends Controle>(entidade: Entidade, item: T | undefined) {
    if (!item) throw naoEncontrado()
    return {
      ...item,
      historico: await listarHistorico(db, entidade, item.id),
      acoesPermitidas: acoesCadastro(item.status),
    }
  }

  /** Inativar/reativar — o mesmo para os três cadastros. */
  async function transicionar(
    tabela: 'materiais' | 'areasEstoque' | 'recipientes',
    entidade: Entidade,
    id: string,
    corpo: unknown,
    autor: string,
  ) {
    const { acao } = transicaoSchema.parse(corpo)
    await db.transaction().execute(async (trx) => {
      const atual = await trx
        .selectFrom(tabela)
        .select('status')
        .where('id', '=', id)
        .executeTakeFirst()
      if (!atual) throw naoEncontrado()
      const destino = destinoDe(atual.status as StatusCadastro, acao)
      const agora = new Date().toISOString()
      await trx
        .updateTable(tabela)
        .set({ status: destino, alteradoEm: agora, alteradoPor: autor })
        .where('id', '=', id)
        .execute()
      await registrarHistorico(trx, entidade, id, {
        autor,
        em: agora,
        acao: 'status',
        mudancas: [{ campo: 'status', antes: atual.status, depois: destino }],
      })
    })
  }

  /* ---------------- materiais */

  async function listarMateriais(): Promise<Material[]> {
    const [linhas, usos] = await Promise.all([
      db.selectFrom('materiais').selectAll().orderBy('nomeOrdem').execute(),
      contagem('materialId'),
    ])
    return linhas.map((l) => ({
      ...controle(l),
      nome: JSON.parse(l.nome) as LocalizedText,
      recipientes: usos.get(l.id) ?? 0,
    }))
  }
  const obterMaterial = async (id: string) =>
    detalhe<Material>(
      'material',
      (await listarMateriais()).find((m) => m.id === id),
    )

  async function nomeDeMaterialLivre(nomeOrdem: string, exceto?: string) {
    const outros = await db
      .selectFrom('materiais')
      .select(['id', 'nomeOrdem'])
      .where('id', '<>', exceto ?? '')
      .execute()
    if (outros.some((o) => normalizar(o.nomeOrdem) === normalizar(nomeOrdem)))
      throw new ErroApi(409, 'name_in_use', 'Já existe um material com este nome.')
  }

  async function salvarMaterial(id: string | null, corpo: unknown, autor: string) {
    const { nome } = materialSchema.parse(corpo)
    const nomeOrdem = nomeEmPortugues(nome)
    await nomeDeMaterialLivre(nomeOrdem, id ?? undefined)
    const agora = new Date().toISOString()
    const busca = normalizar(Object.values(nome.textos).join(' '))
    const novoId = id ?? randomUUID()
    await db.transaction().execute(async (trx) => {
      if (!id) {
        await trx
          .insertInto('materiais')
          .values({
            id: novoId,
            nome: JSON.stringify(nome),
            nomeOrdem,
            status: 'ativo',
            busca,
            criadoEm: agora,
            criadoPor: autor,
            alteradoEm: agora,
            alteradoPor: autor,
          })
          .execute()
        await registrarHistorico(trx, 'material', novoId, { autor, em: agora, acao: 'criado' })
        return
      }
      const atual = await trx
        .selectFrom('materiais')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst()
      if (!atual) throw naoEncontrado('Material não encontrado.')
      if (atual.nome === JSON.stringify(nome)) return
      const antes = original(JSON.parse(atual.nome) as LocalizedText)
      await trx
        .updateTable('materiais')
        .set({
          nome: JSON.stringify(nome),
          nomeOrdem,
          busca,
          alteradoEm: agora,
          alteradoPor: autor,
        })
        .where('id', '=', id)
        .execute()
      // Só a revisão de uma tradução (sem mudar o original) não entra no histórico.
      if (antes !== original(nome))
        await registrarHistorico(trx, 'material', id, {
          autor,
          em: agora,
          acao: 'editado',
          mudancas: [{ campo: 'nome', antes, depois: original(nome) }],
        })
    })
    return obterMaterial(novoId)
  }

  /* ---------------- áreas */

  async function listarAreas(): Promise<AreaEstoque[]> {
    const [linhas, usos] = await Promise.all([
      db.selectFrom('areasEstoque').selectAll().orderBy('nome').execute(),
      contagem('areaId'),
    ])
    return linhas.map((l) => ({
      ...controle(l),
      nome: l.nome,
      descricao: json<LocalizedText>(l.descricao),
      recipientes: usos.get(l.id) ?? 0,
    }))
  }
  const obterArea = async (id: string) =>
    detalhe<AreaEstoque>(
      'area',
      (await listarAreas()).find((a) => a.id === id),
    )

  async function salvarArea(id: string | null, corpo: unknown, autor: string) {
    const v = areaSchema.parse(corpo)
    const outras = await db
      .selectFrom('areasEstoque')
      .select(['id', 'nome'])
      .where('id', '<>', id ?? '')
      .execute()
    if (outras.some((o) => normalizar(o.nome) === normalizar(v.nome)))
      throw new ErroApi(409, 'name_in_use', 'Já existe uma área com este nome.')
    const agora = new Date().toISOString()
    const descricao = v.descricao ? JSON.stringify(v.descricao) : null
    const busca = normalizar(
      [v.nome, ...(v.descricao ? Object.values(v.descricao.textos) : [])].join(' '),
    )
    const novoId = id ?? randomUUID()
    await db.transaction().execute(async (trx) => {
      if (!id) {
        await trx
          .insertInto('areasEstoque')
          .values({
            id: novoId,
            nome: v.nome,
            descricao,
            status: 'ativo',
            busca,
            criadoEm: agora,
            criadoPor: autor,
            alteradoEm: agora,
            alteradoPor: autor,
          })
          .execute()
        await registrarHistorico(trx, 'area', novoId, { autor, em: agora, acao: 'criado' })
        return
      }
      const atual = await trx
        .selectFrom('areasEstoque')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst()
      if (!atual) throw naoEncontrado('Área não encontrada.')
      const descAntes = atual.descricao
        ? original(JSON.parse(atual.descricao) as LocalizedText)
        : null
      const descDepois = v.descricao ? original(v.descricao) : null
      const mudancas: Mudanca[] = []
      if (atual.nome !== v.nome) mudancas.push({ campo: 'nome', antes: atual.nome, depois: v.nome })
      if (descAntes !== descDepois)
        mudancas.push({ campo: 'descricao', antes: descAntes, depois: descDepois })
      if (!mudancas.length && atual.descricao === descricao) return
      await trx
        .updateTable('areasEstoque')
        .set({ nome: v.nome, descricao, busca, alteradoEm: agora, alteradoPor: autor })
        .where('id', '=', id)
        .execute()
      if (mudancas.length)
        await registrarHistorico(trx, 'area', id, { autor, em: agora, acao: 'editado', mudancas })
    })
    return obterArea(novoId)
  }

  /* ---------------- recipientes (caixotes e pallets) */

  async function listarRecipientes(tipo?: unknown): Promise<Recipiente[]> {
    const t = tipo === undefined ? undefined : z.enum(TIPOS_RECIPIENTE).parse(tipo)
    let q = db
      .selectFrom('recipientes as r')
      .innerJoin('materiais as m', 'm.id', 'r.materialId')
      .innerJoin('areasEstoque as a', 'a.id', 'r.areaId')
      .selectAll('r')
      .select(['m.nome as materialNome', 'a.nome as areaNome'])
    if (t) q = q.where('r.tipo', '=', t)
    const linhas = await q.orderBy('r.codigo', 'desc').execute()
    return linhas.map((l) => ({
      ...controle(l),
      tipo: l.tipo as TipoRecipiente,
      codigo: l.codigo,
      materialId: l.materialId,
      materialNome: JSON.parse(l.materialNome) as LocalizedText,
      areaId: l.areaId,
      areaNome: l.areaNome,
      posicao: l.posicao,
      taraKg: l.taraKg,
    }))
  }
  const obterRecipiente = async (id: string) =>
    detalhe<Recipiente>(
      'recipiente',
      (await listarRecipientes()).find((r) => r.id === id),
    )

  /** Material e área ativos (só exigido quando muda ou no cadastro novo). */
  async function conferirVinculos(cx: Conexao, materialId: string, areaId: string) {
    // Dentro da transação: o SQLite tem uma conexão só (consultar fora dela trava).
    const [m, a] = await Promise.all([
      cx
        .selectFrom('materiais')
        .select(['nomeOrdem', 'status'])
        .where('id', '=', materialId)
        .executeTakeFirst(),
      cx
        .selectFrom('areasEstoque')
        .select(['nome', 'status'])
        .where('id', '=', areaId)
        .executeTakeFirst(),
    ])
    if (!m || m.status !== 'ativo')
      throw new ErroApi(422, 'validation', 'Escolha um material ativo.')
    if (!a || a.status !== 'ativo') throw new ErroApi(422, 'validation', 'Escolha uma área ativa.')
    return { material: m.nomeOrdem, area: a.nome }
  }

  async function salvarRecipiente(id: string | null, corpo: unknown, autor: string) {
    const v = recipienteSchema.parse(corpo)
    const agora = new Date().toISOString()
    const novoId = id ?? randomUUID()
    await db.transaction().execute(async (trx) => {
      if (!id) {
        const nomes = await conferirVinculos(trx, v.materialId, v.areaId)
        const ano = Number(diaNoFuso().slice(0, 4))
        const ultimo = await trx
          .selectFrom('recipientes')
          .select((eb) => eb.fn.max('numero').as('n'))
          .where('tipo', '=', v.tipo)
          .where('ano', '=', ano)
          .executeTakeFirst()
        const numero = Number(ultimo?.n ?? 0) + 1
        const codigo = `${PREFIXO[v.tipo]}-${ano}${String(numero).padStart(4, '0')}`
        await trx
          .insertInto('recipientes')
          .values({
            id: novoId,
            tipo: v.tipo,
            ano,
            numero,
            codigo,
            materialId: v.materialId,
            taraKg: v.taraKg,
            areaId: v.areaId,
            posicao: v.posicao,
            status: 'ativo',
            busca: normalizar(`${codigo} ${nomes.material} ${nomes.area} ${v.posicao}`),
            criadoEm: agora,
            criadoPor: autor,
            alteradoEm: agora,
            alteradoPor: autor,
          })
          .execute()
        await registrarHistorico(trx, 'recipiente', novoId, { autor, em: agora, acao: 'criado' })
        return
      }
      const atual = await trx
        .selectFrom('recipientes as r')
        .innerJoin('materiais as m', 'm.id', 'r.materialId')
        .innerJoin('areasEstoque as a', 'a.id', 'r.areaId')
        .selectAll('r')
        .select(['m.nomeOrdem as materialNome', 'a.nome as areaNome'])
        .where('r.id', '=', id)
        .executeTakeFirst()
      if (!atual) throw naoEncontrado('Recipiente não encontrado.')
      if (atual.tipo !== v.tipo)
        throw new ErroApi(422, 'validation', 'O tipo do recipiente não muda.')
      const mudouVinculo = atual.materialId !== v.materialId || atual.areaId !== v.areaId
      const nomes = mudouVinculo
        ? await conferirVinculos(trx, v.materialId, v.areaId)
        : { material: atual.materialNome, area: atual.areaNome }
      const mudancas: Mudanca[] = []
      if (atual.materialId !== v.materialId)
        mudancas.push({ campo: 'material', antes: atual.materialNome, depois: nomes.material })
      if (atual.areaId !== v.areaId)
        mudancas.push({ campo: 'area', antes: atual.areaNome, depois: nomes.area })
      if (atual.posicao !== v.posicao)
        mudancas.push({ campo: 'posicao', antes: atual.posicao, depois: v.posicao })
      if (atual.taraKg !== v.taraKg)
        mudancas.push({ campo: 'taraKg', antes: atual.taraKg, depois: v.taraKg })
      if (!mudancas.length) return
      await trx
        .updateTable('recipientes')
        .set({
          materialId: v.materialId,
          taraKg: v.taraKg,
          areaId: v.areaId,
          posicao: v.posicao,
          busca: normalizar(`${atual.codigo} ${nomes.material} ${nomes.area} ${v.posicao}`),
          alteradoEm: agora,
          alteradoPor: autor,
        })
        .where('id', '=', id)
        .execute()
      await registrarHistorico(trx, 'recipiente', id, {
        autor,
        em: agora,
        acao: 'editado',
        mudancas,
      })
    })
    return obterRecipiente(novoId)
  }

  return {
    materiais: {
      listar: listarMateriais,
      obter: obterMaterial,
      salvar: salvarMaterial,
      transicionar: async (id: string, corpo: unknown, autor: string) => {
        await transicionar('materiais', 'material', id, corpo, autor)
        return obterMaterial(id)
      },
    },
    areas: {
      listar: listarAreas,
      obter: obterArea,
      salvar: salvarArea,
      transicionar: async (id: string, corpo: unknown, autor: string) => {
        await transicionar('areasEstoque', 'area', id, corpo, autor)
        return obterArea(id)
      },
    },
    recipientes: {
      listar: listarRecipientes,
      obter: obterRecipiente,
      salvar: salvarRecipiente,
      transicionar: async (id: string, corpo: unknown, autor: string) => {
        await transicionar('recipientes', 'recipiente', id, corpo, autor)
        return obterRecipiente(id)
      },
    },
  }
}

export type ServicoCadastros = ReturnType<typeof criarServicoCadastros>

/* ------------------------------------------------------------ rotas */

type Recurso = {
  listar: (filtro?: unknown) => Promise<unknown>
  obter: (id: string) => Promise<unknown>
  salvar: (id: string | null, corpo: unknown, autor: string) => Promise<unknown>
  transicionar: (id: string, corpo: unknown, autor: string) => Promise<unknown>
}

/** Rotas de um cadastro (lista inteira, detalhe, criar, editar, inativar/reativar). */
export function rotasCadastro(recurso: Recurso, filtro?: string) {
  const r = Router()
  r.get('/', async (req, res) => {
    res.json(await recurso.listar(filtro ? req.query[filtro] : undefined))
  })
  r.get('/:id', async (req, res) => {
    res.json(await recurso.obter(String(req.params.id)))
  })
  r.post('/', async (req, res) => {
    res.status(201).json(await recurso.salvar(null, req.body, autorDa(req)))
  })
  r.put('/:id', async (req, res) => {
    res.json(await recurso.salvar(String(req.params.id), req.body, autorDa(req)))
  })
  r.post('/:id/transicao', async (req, res) => {
    res.json(await recurso.transicionar(String(req.params.id), req.body, autorDa(req)))
  })
  return r
}
