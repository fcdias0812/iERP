import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { sql } from 'kysely'
import { z } from 'zod'
import type { Db } from '../../db/database.js'
import { autorDa } from '../../shared/autor.js'
import {
  acoesCadastro,
  destinoDe,
  type AcaoCadastro,
  type StatusCadastro,
} from '../../shared/cadastro.js'
import { ErroApi, naoEncontrado } from '../../shared/erros.js'
import type { EventoHistorico, Mudanca } from '../../shared/historico.js'
import { listarHistorico, registrarHistorico } from '../../shared/historico.repositorio.js'
import { NIVEIS, PAGINAS, type Nivel } from '../../shared/paginas.js'
import { normalizar } from '../../shared/texto.js'
import { original, textoTraduzidoSchema, type LocalizedText } from '../ordens/ordens.lote.js'

/*
 * Administração › Perfis de acesso (pedido do usuário, 19/10/2026): cada perfil diz o nível de
 * cada página do menu — sem acesso (ausente), visualizar (`ver`) ou editar (`editar`). Cada
 * usuário tem UM perfil. O Administrador é fixo: pode tudo, não se edita nem inativa.
 *
 *   GET  /api/perfis            lista (com quantos usuários usam cada perfil)
 *   GET  /api/perfis/:id        detalhe + histórico
 *   POST /api/perfis            cria { nome, descricao, permissoes }
 *   PUT  /api/perfis/:id        edita
 *   POST /api/perfis/:id/transicao   { acao: inativar | reativar } — perfil com usuário ativo
 *                                    não é inativado (409 profile_in_use)
 *
 * Hoje o login ainda é simulado: as permissões valem nas telas (botões e páginas). Quando o login
 * existir, o servidor passa a conferir também.
 */

export interface PerfilAcesso {
  id: string
  nome: LocalizedText
  descricao: LocalizedText | null
  /** Administrador: pode tudo, não muda. */
  fixo: boolean
  /** Página → nível; página ausente = sem acesso. */
  permissoes: Partial<Record<string, Nivel>>
  /** Usuários (de qualquer status) com este perfil. */
  usuarios: number
  status: StatusCadastro
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}
export interface PerfilAcessoDetalhe extends PerfilAcesso {
  historico: EventoHistorico[]
  acoesPermitidas: AcaoCadastro[]
}

const perfilSchema = z.object({
  nome: textoTraduzidoSchema,
  descricao: textoTraduzidoSchema.nullish().transform((v) => v ?? null),
  permissoes: z
    .record(z.string(), z.enum(NIVEIS).nullable())
    .default({})
    .transform((p) => {
      // Só páginas conhecidas; `null` = sem acesso (não é guardado).
      const limpo: Partial<Record<string, Nivel>> = {}
      for (const pagina of PAGINAS) {
        const nivel = p[pagina]
        if (nivel) limpo[pagina] = nivel
      }
      return limpo
    }),
})

const nomeEmPortugues = (t: LocalizedText) => t.textos['pt-BR']?.trim() || original(t)

export function criarServicoPerfis(db: Db) {
  async function listar(): Promise<PerfilAcesso[]> {
    const [linhas, usos] = await Promise.all([
      db
        .selectFrom('perfisAcesso')
        .selectAll()
        .orderBy('fixo', 'desc')
        .orderBy('nomeOrdem')
        .execute(),
      db
        .selectFrom('usuarios')
        .select(['perfil', sql<number>`count(*)`.as('n')])
        .groupBy('perfil')
        .execute(),
    ])
    const contagem = new Map(usos.map((u) => [u.perfil, Number(u.n)]))
    return linhas.map((l) => ({
      id: l.id,
      nome: JSON.parse(l.nome) as LocalizedText,
      descricao: l.descricao ? (JSON.parse(l.descricao) as LocalizedText) : null,
      fixo: l.fixo === 1,
      permissoes: JSON.parse(l.permissoes) as Partial<Record<string, Nivel>>,
      usuarios: contagem.get(l.id) ?? 0,
      status: l.status as StatusCadastro,
      criadoEm: l.criadoEm,
      criadoPor: l.criadoPor,
      alteradoEm: l.alteradoEm,
      alteradoPor: l.alteradoPor,
    }))
  }

  async function obter(id: string): Promise<PerfilAcessoDetalhe> {
    const p = (await listar()).find((x) => x.id === id)
    if (!p) throw naoEncontrado('Perfil de acesso não encontrado.')
    return {
      ...p,
      historico: await listarHistorico(db, 'perfil', id),
      // O Administrador não muda de status.
      acoesPermitidas: p.fixo ? [] : acoesCadastro(p.status),
    }
  }

  const fixo = () =>
    new ErroApi(409, 'fixed_profile', 'O perfil Administrador é fixo: não se edita nem inativa.')

  async function salvar(id: string | null, corpo: unknown, autor: string) {
    const v = perfilSchema.parse(corpo)
    const nomeOrdem = nomeEmPortugues(v.nome)
    const outros = await db
      .selectFrom('perfisAcesso')
      .select(['id', 'nomeOrdem'])
      .where('id', '<>', id ?? '')
      .execute()
    if (outros.some((o) => normalizar(o.nomeOrdem) === normalizar(nomeOrdem)))
      throw new ErroApi(409, 'name_in_use', 'Já existe um perfil com este nome.')
    const agora = new Date().toISOString()
    const novoId = id ?? randomUUID()
    const linha = {
      nome: JSON.stringify(v.nome),
      nomeOrdem,
      descricao: v.descricao ? JSON.stringify(v.descricao) : null,
      permissoes: JSON.stringify(v.permissoes),
      busca: normalizar(Object.values(v.nome.textos).join(' ')),
      alteradoEm: agora,
      alteradoPor: autor,
    }
    await db.transaction().execute(async (trx) => {
      if (!id) {
        await trx
          .insertInto('perfisAcesso')
          .values({
            id: novoId,
            ...linha,
            fixo: 0,
            status: 'ativo',
            criadoEm: agora,
            criadoPor: autor,
          })
          .execute()
        await registrarHistorico(trx, 'perfil', novoId, { autor, em: agora, acao: 'criado' })
        return
      }
      const atual = await trx
        .selectFrom('perfisAcesso')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst()
      if (!atual) throw naoEncontrado('Perfil de acesso não encontrado.')
      if (atual.fixo === 1) throw fixo()
      const mudancas: Mudanca[] = []
      const nomeAntes = original(JSON.parse(atual.nome) as LocalizedText)
      if (nomeAntes !== original(v.nome))
        mudancas.push({ campo: 'nome', antes: nomeAntes, depois: original(v.nome) })
      const descAntes = atual.descricao
        ? original(JSON.parse(atual.descricao) as LocalizedText)
        : null
      const descDepois = v.descricao ? original(v.descricao) : null
      if (descAntes !== descDepois)
        mudancas.push({ campo: 'descricao', antes: descAntes, depois: descDepois })
      // Uma linha por página que mudou de nível ("nenhum" = sem acesso).
      const antes = JSON.parse(atual.permissoes) as Partial<Record<string, Nivel>>
      for (const pagina of PAGINAS) {
        const a = antes[pagina] ?? 'nenhum'
        const d = v.permissoes[pagina] ?? 'nenhum'
        if (a !== d) mudancas.push({ campo: `pagina:${pagina}`, antes: a, depois: d })
      }
      const mudouTexto = atual.nome !== linha.nome || atual.descricao !== linha.descricao
      if (!mudancas.length && !mudouTexto) return
      await trx.updateTable('perfisAcesso').set(linha).where('id', '=', id).execute()
      if (mudancas.length)
        await registrarHistorico(trx, 'perfil', id, { autor, em: agora, acao: 'editado', mudancas })
    })
    return obter(novoId)
  }

  async function transicionar(id: string, corpo: unknown, autor: string) {
    const { acao } = z.object({ acao: z.enum(['inativar', 'reativar']) }).parse(corpo)
    await db.transaction().execute(async (trx) => {
      const atual = await trx
        .selectFrom('perfisAcesso')
        .select(['status', 'fixo'])
        .where('id', '=', id)
        .executeTakeFirst()
      if (!atual) throw naoEncontrado('Perfil de acesso não encontrado.')
      if (atual.fixo === 1) throw fixo()
      const destino = destinoDe(atual.status as StatusCadastro, acao)
      if (destino === 'inativo') {
        const ativos = await trx
          .selectFrom('usuarios')
          .select(sql<number>`count(*)`.as('n'))
          .where('perfil', '=', id)
          .where('status', '<>', 'inativo')
          .executeTakeFirstOrThrow()
        if (Number(ativos.n) > 0)
          throw new ErroApi(
            409,
            'profile_in_use',
            'Há usuários usando este perfil: troque o perfil deles antes de inativar.',
          )
      }
      const agora = new Date().toISOString()
      await trx
        .updateTable('perfisAcesso')
        .set({ status: destino, alteradoEm: agora, alteradoPor: autor })
        .where('id', '=', id)
        .execute()
      await registrarHistorico(trx, 'perfil', id, {
        autor,
        em: agora,
        acao: 'status',
        mudancas: [{ campo: 'status', antes: atual.status, depois: destino }],
      })
    })
    return obter(id)
  }

  return { listar, obter, salvar, transicionar }
}

export type ServicoPerfis = ReturnType<typeof criarServicoPerfis>

export function rotasPerfis(servico: ServicoPerfis) {
  const r = Router()
  r.get('/', async (_req, res) => {
    res.json(await servico.listar())
  })
  r.get('/:id', async (req, res) => {
    res.json(await servico.obter(String(req.params.id)))
  })
  r.post('/', async (req, res) => {
    res.status(201).json(await servico.salvar(null, req.body, autorDa(req)))
  })
  r.put('/:id', async (req, res) => {
    res.json(await servico.salvar(String(req.params.id), req.body, autorDa(req)))
  })
  r.post('/:id/transicao', async (req, res) => {
    res.json(await servico.transicionar(String(req.params.id), req.body, autorDa(req)))
  })
  return r
}
