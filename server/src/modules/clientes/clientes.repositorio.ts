import { randomUUID } from 'node:crypto'
import { sql, type Selectable, type Transaction } from 'kysely'
import type { Db } from '../../db/database.js'
import type { ClientesListaView, ClientesTable, Database } from '../../db/schema.js'
import {
  ordemDaConsulta,
  whereDaConsulta,
  type ConsultaTabela,
} from '../../shared/consulta-tabela.js'
import { formatarCnpj } from '../../shared/documentos.js'
import type { EventoHistorico, Mudanca } from '../../shared/historico.js'
import { normalizar } from '../../shared/texto.js'
import { COLUNAS_CLIENTE, acoesDe } from './clientes.regras.js'
import type {
  Cliente,
  ClienteResumo,
  ClienteStatus,
  ContatoCliente,
  PaginaClientes,
} from './clientes.types.js'

/* Acesso ao banco: `clientes`, `clientes_contatos`, `clientes_historico` e a view `clientes_lista`. */

type Conexao = Db | Transaction<Database>
type ContatoNovo = Omit<ContatoCliente, 'id'>
/** Contato vindo do formulário: com `id` = já existe. */
type ContatoEntrada = ContatoNovo & { id?: string | null }

/** Texto da busca geral: nome, CNPJ (com e sem pontuação), código e contatos. */
const textoBusca = (c: Pick<ClientesTable, 'nome' | 'cnpj' | 'codigo'>, contatos: ContatoNovo[]) =>
  normalizar(
    [
      c.nome,
      c.cnpj,
      formatarCnpj(c.cnpj),
      c.codigo,
      ...contatos.flatMap((k) => [k.nome ?? '', k.email, k.telefone]),
    ].join(' '),
  )

function paraResumo(l: Selectable<ClientesListaView>): ClienteResumo {
  return {
    id: l.id,
    codigo: l.codigo,
    nome: l.nome,
    cnpj: l.cnpj,
    slaDias: l.slaDias,
    contatoNome: l.contatoNome,
    contatoEmail: l.contatoEmail,
    contatoTelefone: l.contatoTelefone,
    contatos: Number(l.contatos),
    status: l.status as ClienteStatus,
    criadoEm: l.criadoEm,
  }
}

export function criarRepositorioClientes(db: Db) {
  async function listar(consulta: ConsultaTabela): Promise<PaginaClientes> {
    const where = whereDaConsulta(COLUNAS_CLIENTE, consulta, { colunaBusca: 'busca' })
    let pagina = db.selectFrom('clientesLista').selectAll().where(where)
    for (const o of ordemDaConsulta(COLUNAS_CLIENTE, consulta, [{ id: 'nome', desc: false }]))
      pagina = pagina.orderBy(o)
    const [linhas, total, grupos] = await Promise.all([
      pagina
        .limit(consulta.pageSize)
        .offset((consulta.page - 1) * consulta.pageSize)
        .execute(),
      db
        .selectFrom('clientesLista')
        .select(sql<number>`count(*)`.as('n'))
        .where(where)
        .executeTakeFirstOrThrow(),
      // Contagem por status considerando os DEMAIS filtros.
      db
        .selectFrom('clientesLista')
        .select(['status', sql<number>`count(*)`.as('n')])
        .where(
          whereDaConsulta(COLUNAS_CLIENTE, consulta, { colunaBusca: 'busca', semFiltro: 'status' }),
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
  }

  async function contarPorStatus(): Promise<Record<string, number>> {
    const grupos = await db
      .selectFrom('clientes')
      .select(['status', sql<number>`count(*)`.as('n')])
      .groupBy('status')
      .execute()
    return Object.fromEntries(grupos.map((g) => [g.status, Number(g.n)]))
  }

  async function obter(id: string, cx: Conexao = db): Promise<Cliente | undefined> {
    const linha = await cx
      .selectFrom('clientes')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
    if (!linha) return undefined
    const [contatos, historico] = await Promise.all([
      cx
        .selectFrom('clientesContatos')
        .selectAll()
        .where('clienteId', '=', id)
        .orderBy('principal', 'desc')
        .orderBy('ordem', 'asc')
        .execute(),
      cx
        .selectFrom('clientesHistorico')
        .selectAll()
        .where('clienteId', '=', id)
        .orderBy('em', 'desc')
        .orderBy('id', 'desc')
        .execute(),
    ])
    return {
      id: linha.id,
      codigo: linha.codigo,
      nome: linha.nome,
      cnpj: linha.cnpj,
      slaDias: linha.slaDias,
      status: linha.status as ClienteStatus,
      contatos: contatos.map((k) => ({
        id: k.id,
        nome: k.nome,
        email: k.email,
        telefone: k.telefone,
        principal: k.principal === 1,
      })),
      criadoEm: linha.criadoEm,
      criadoPor: linha.criadoPor,
      alteradoEm: linha.alteradoEm,
      alteradoPor: linha.alteradoPor,
      historico: historico.map((h): EventoHistorico => ({
        id: h.id,
        autor: h.autor,
        em: h.em,
        acao: h.acao as EventoHistorico['acao'],
        ...(h.mudancas ? { mudancas: JSON.parse(h.mudancas) as Mudanca[] } : {}),
        ...(h.nota ? { nota: h.nota } : {}),
      })),
      acoesPermitidas: acoesDe(linha.status as ClienteStatus),
    }
  }

  /** Outro cliente (≠ `excetoId`) já usa o CNPJ? */
  async function cnpjEmUso(cnpj: string, excetoId?: string, cx: Conexao = db) {
    let q = cx.selectFrom('clientes').select('id').where('cnpj', '=', cnpj)
    if (excetoId) q = q.where('id', '<>', excetoId)
    return Boolean(await q.executeTakeFirst())
  }

  /**
   * Grava a lista de contatos do cliente (a ordem da lista é a ordem de exibição).
   * Contato com `id` existente é ATUALIZADO (mantém o vínculo com sites); sem `id`, é criado;
   * os que não vieram são removidos (o site que tinha esse responsável fica sem responsável).
   */
  async function gravarContatos(cx: Conexao, clienteId: string, contatos: ContatoEntrada[]) {
    const existentes = new Set(
      (
        await cx
          .selectFrom('clientesContatos')
          .select('id')
          .where('clienteId', '=', clienteId)
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
        await cx.updateTable('clientesContatos').set(valores).where('id', '=', k.id).execute()
      } else
        await cx
          .insertInto('clientesContatos')
          .values({ ...valores, id: randomUUID(), clienteId })
          .execute()
    }
    const remover = [...existentes].filter((id) => !mantidos.has(id))
    if (remover.length) await cx.deleteFrom('clientesContatos').where('id', 'in', remover).execute()
  }

  /** Acrescenta um contato (não principal) no fim da lista. Devolve o id. */
  async function adicionarContato(
    cx: Conexao,
    clienteId: string,
    contato: { nome: string | null; email: string; telefone: string },
  ): Promise<string> {
    const r = await cx
      .selectFrom('clientesContatos')
      .select(sql<number | null>`max(ordem)`.as('n'))
      .where('clienteId', '=', clienteId)
      .executeTakeFirstOrThrow()
    const id = randomUUID()
    await cx
      .insertInto('clientesContatos')
      .values({ ...contato, id, clienteId, principal: 0, ordem: Number(r.n ?? -1) + 1 })
      .execute()
    // Atualiza a busca geral com o contato novo.
    await atualizar(cx, clienteId, {})
    return id
  }

  async function inserir(
    cx: Conexao,
    dados: Omit<ClientesTable, 'id' | 'busca' | 'numero' | 'codigo'>,
    contatos: ContatoEntrada[],
    codigoDe: (numero: number) => string,
  ): Promise<string> {
    const r = await cx
      .selectFrom('clientes')
      .select(sql<number | null>`max(numero)`.as('n'))
      .executeTakeFirstOrThrow()
    const numero = Number(r.n ?? 0) + 1
    const codigo = codigoDe(numero)
    const id = randomUUID()
    await cx
      .insertInto('clientes')
      .values({ ...dados, id, numero, codigo, busca: textoBusca({ ...dados, codigo }, contatos) })
      .execute()
    await gravarContatos(cx, id, contatos)
    return id
  }

  async function atualizar(
    cx: Conexao,
    id: string,
    dados: Partial<Omit<ClientesTable, 'id' | 'busca' | 'numero' | 'codigo'>>,
    contatos?: ContatoEntrada[],
  ) {
    const atual = await obter(id, cx)
    if (!atual) return
    const novosContatos = contatos ?? atual.contatos
    await cx
      .updateTable('clientes')
      .set({ ...dados, busca: textoBusca({ ...atual, ...dados }, novosContatos) })
      .where('id', '=', id)
      .execute()
    if (contatos) await gravarContatos(cx, id, contatos)
  }

  async function registrarHistorico(
    cx: Conexao,
    clienteId: string,
    evento: Omit<EventoHistorico, 'id'>,
  ) {
    await cx
      .insertInto('clientesHistorico')
      .values({
        id: randomUUID(),
        clienteId,
        autor: evento.autor,
        em: evento.em,
        acao: evento.acao,
        mudancas: evento.mudancas ? JSON.stringify(evento.mudancas) : null,
        nota: evento.nota ?? null,
      })
      .execute()
  }

  /** Busca rápida (Ctrl+K). */
  async function buscar(termo: string, limite = 8) {
    const linhas = await db
      .selectFrom('clientesLista')
      .selectAll()
      .where(
        whereDaConsulta(
          COLUNAS_CLIENTE,
          {
            search: termo,
            sort: [],
            filters: [],
            advanced: { logic: 'and', conditions: [] },
            page: 1,
            pageSize: limite,
          },
          { colunaBusca: 'busca' },
        ),
      )
      .orderBy(sql`lower(nome)`)
      .limit(limite)
      .execute()
    return linhas.map(paraResumo)
  }

  return {
    listar,
    contarPorStatus,
    obter,
    cnpjEmUso,
    inserir,
    atualizar,
    registrarHistorico,
    adicionarContato,
    buscar,
    transacao: <T>(fn: (trx: Transaction<Database>) => Promise<T>) => db.transaction().execute(fn),
  }
}

export type RepositorioClientes = ReturnType<typeof criarRepositorioClientes>
