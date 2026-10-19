import { randomUUID } from 'node:crypto'
import { sql, type Selectable, type Transaction } from 'kysely'
import type { Db } from '../../db/database.js'
import type { Database, UsuariosHistoricoTable, UsuariosTable } from '../../db/schema.js'
import {
  ordemDaConsulta,
  whereDaConsulta,
  type ConsultaTabela,
} from '../../shared/consulta-tabela.js'
import { normalizar } from '../../shared/texto.js'
import { COLUNAS_USUARIO, acoesDe } from './usuarios.regras.js'
import type {
  EventoHistorico,
  Mudanca,
  PaginaUsuarios,
  Usuario,
  UsuarioPerfil,
  UsuarioResumo,
  UsuarioStatus,
} from './usuarios.types.js'

/* Acesso ao banco das tabelas `usuarios` e `usuarios_historico`. Sem regra de negócio. */

type Conexao = Db | Transaction<Database>
type Linha = Selectable<UsuariosTable>

const textoBusca = (u: Pick<Linha, 'nome' | 'email' | 'codigo'>) =>
  normalizar(`${u.nome} ${u.email} ${u.codigo}`)

function paraResumo(l: Linha): UsuarioResumo {
  return {
    id: l.id,
    codigo: l.codigo,
    nome: l.nome,
    email: l.email,
    perfil: l.perfil as UsuarioPerfil,
    status: l.status as UsuarioStatus,
    ultimoAcesso: l.ultimoAcesso,
    criadoEm: l.criadoEm,
  }
}

function paraEvento(h: Selectable<UsuariosHistoricoTable>): EventoHistorico {
  return {
    id: h.id,
    autor: h.autor,
    em: h.em,
    acao: h.acao as EventoHistorico['acao'],
    ...(h.mudancas ? { mudancas: JSON.parse(h.mudancas) as Mudanca[] } : {}),
    ...(h.nota ? { nota: h.nota } : {}),
  }
}

export function criarRepositorioUsuarios(db: Db) {
  async function listar(consulta: ConsultaTabela): Promise<PaginaUsuarios> {
    const where = whereDaConsulta(COLUNAS_USUARIO, consulta, { colunaBusca: 'busca' })
    let pagina = db.selectFrom('usuarios').selectAll().where(where)
    for (const o of ordemDaConsulta(COLUNAS_USUARIO, consulta, [{ id: 'nome', desc: false }]))
      pagina = pagina.orderBy(o)
    const [linhas, total] = await Promise.all([
      pagina
        .limit(consulta.pageSize)
        .offset((consulta.page - 1) * consulta.pageSize)
        .execute(),
      db
        .selectFrom('usuarios')
        .select(sql<number>`count(*)`.as('n'))
        .where(where)
        .executeTakeFirstOrThrow(),
    ])

    // Contagem por opção dos filtros de multisseleção, considerando os DEMAIS filtros.
    const facets: PaginaUsuarios['facets'] = {}
    for (const coluna of ['perfil', 'status'] as const) {
      const grupos = await db
        .selectFrom('usuarios')
        .select([coluna, sql<number>`count(*)`.as('n')])
        .where(
          whereDaConsulta(COLUNAS_USUARIO, consulta, { colunaBusca: 'busca', semFiltro: coluna }),
        )
        .groupBy(coluna)
        .execute()
      facets[coluna] = Object.fromEntries(grupos.map((g) => [g[coluna], Number(g.n)]))
    }

    return { rows: linhas.map(paraResumo), total: Number(total.n), totals: {}, facets }
  }

  async function contarPorStatus(): Promise<Record<string, number>> {
    const grupos = await db
      .selectFrom('usuarios')
      .select(['status', sql<number>`count(*)`.as('n')])
      .groupBy('status')
      .execute()
    return Object.fromEntries(grupos.map((g) => [g.status, Number(g.n)]))
  }

  async function obter(id: string, cx: Conexao = db): Promise<Usuario | undefined> {
    const linha = await cx
      .selectFrom('usuarios')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
    if (!linha) return undefined
    const historico = await cx
      .selectFrom('usuariosHistorico')
      .selectAll()
      .where('usuarioId', '=', id)
      .orderBy('em', 'desc')
      .orderBy('id', 'desc')
      .execute()
    return {
      ...paraResumo(linha),
      criadoPor: linha.criadoPor,
      alteradoPor: linha.alteradoPor,
      alteradoEm: linha.alteradoEm,
      historico: historico.map(paraEvento),
      acoesPermitidas: acoesDe(linha.status as UsuarioStatus),
    }
  }

  /** O perfil existe e está ativo? */
  async function perfilAtivo(perfilId: string, cx: Conexao = db) {
    const p = await cx
      .selectFrom('perfisAcesso')
      .select('status')
      .where('id', '=', perfilId)
      .executeTakeFirst()
    return p?.status === 'ativo'
  }

  /** Outro usuário (≠ `excetoId`) já usa o e-mail? */
  async function emailEmUso(email: string, excetoId?: string, cx: Conexao = db) {
    let q = cx.selectFrom('usuarios').select('id').where('email', '=', email)
    if (excetoId) q = q.where('id', '<>', excetoId)
    return Boolean(await q.executeTakeFirst())
  }

  async function proximoNumero(cx: Conexao) {
    const r = await cx
      .selectFrom('usuarios')
      .select(sql<number | null>`max(numero)`.as('n'))
      .executeTakeFirstOrThrow()
    return Number(r.n ?? 0) + 1
  }

  async function inserir(
    cx: Conexao,
    dados: Omit<Linha, 'id' | 'busca' | 'numero' | 'codigo'>,
    codigoDe: (numero: number) => string,
  ): Promise<string> {
    const numero = await proximoNumero(cx)
    const codigo = codigoDe(numero)
    const id = randomUUID()
    await cx
      .insertInto('usuarios')
      .values({ ...dados, id, numero, codigo, busca: textoBusca({ ...dados, codigo }) })
      .execute()
    return id
  }

  async function atualizar(cx: Conexao, id: string, dados: Partial<Omit<Linha, 'id' | 'busca'>>) {
    const atual = await cx
      .selectFrom('usuarios')
      .select(['nome', 'email', 'codigo'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
    await cx
      .updateTable('usuarios')
      .set({ ...dados, busca: textoBusca({ ...atual, ...dados }) })
      .where('id', '=', id)
      .execute()
  }

  async function registrarHistorico(
    cx: Conexao,
    usuarioId: string,
    evento: Omit<EventoHistorico, 'id'>,
  ) {
    await cx
      .insertInto('usuariosHistorico')
      .values({
        id: randomUUID(),
        usuarioId,
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
      .selectFrom('usuarios')
      .selectAll()
      .where(
        whereDaConsulta(
          COLUNAS_USUARIO,
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
    emailEmUso,
    perfilAtivo,
    inserir,
    atualizar,
    registrarHistorico,
    buscar,
    transacao: <T>(fn: (trx: Transaction<Database>) => Promise<T>) => db.transaction().execute(fn),
  }
}

export type RepositorioUsuarios = ReturnType<typeof criarRepositorioUsuarios>
