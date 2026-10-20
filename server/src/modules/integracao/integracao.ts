import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import type { Db } from '../../db/database.js'
import type { IntegracoesTable } from '../../db/schema.js'
import { autorDa } from '../../shared/autor.js'
import { ErroApi, naoEncontrado } from '../../shared/erros.js'
import type { EventoHistorico, Mudanca } from '../../shared/historico.js'
import { listarHistorico, registrarHistorico } from '../../shared/historico.repositorio.js'
import { DESTINOS, SISTEMAS } from './destinos.js'

/*
 * Administração › Integração (pedido do usuário, 19/10/2026): os sistemas de fora que
 * conversam com o iERP (hoje o MoonShot, da Dell). Para cada um:
 *  - a CHAVE com que ele entra no iERP (`X-Api-Key`). Só o HASH fica guardado; a chave aparece
 *    UMA vez, ao gerar. Gerar de novo troca a chave (a antiga para de valer na hora);
 *  - para onde vão os AVISOS ("olha o lote LOT-00001" — ele busca o lote com a chave);
 *  - de onde se lê o PAINEL de andamento (`GET .../api/ierp2/painel` — o endereço do 2.0; o antigo lê `/api/ierp/painel`).
 *
 *   GET    /api/integracoes                lista
 *   GET    /api/integracoes/:id            detalhe + histórico + últimos avisos
 *   POST   /api/integracoes                cria { sistema, nome, urlAvisos, urlPainel, tokenPainel }
 *   PUT    /api/integracoes/:id            edita (tokenPainel ausente = mantém; '' = apaga)
 *   POST   /api/integracoes/:id/chave      gera uma chave nova → { chave } (só desta vez)
 *   DELETE /api/integracoes/:id/chave      revoga a chave
 *   POST   /api/integracoes/:id/transicao  { acao: inativar | reativar }
 */

export interface Integracao {
  id: string
  sistema: string
  nome: string
  /** Começo da chave (para reconhecer); null = sem chave. */
  chavePrefixo: string | null
  chaveCriadaEm: string | null
  urlAvisos: string | null
  urlPainel: string | null
  /** Há token do painel guardado? (o token em si nunca sai daqui) */
  temTokenPainel: boolean
  status: 'ativo' | 'inativo'
  ultimoUsoEm: string | null
  ultimoAvisoEm: string | null
  ultimoPainelEm: string | null
  ultimoErro: string | null
  ultimoErroEm: string | null
  avisosPendentes: number
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}

export interface AvisoIntegracao {
  id: string
  codigo: string
  evento: string
  tentativas: number
  erro: string | null
  criadoEm: string
  enviadoEm: string | null
}

export interface IntegracaoDetalhe extends Integracao {
  historico: EventoHistorico[]
  avisos: AvisoIntegracao[]
  acoesPermitidas: ('inativar' | 'reativar')[]
}

/** Tamanho mínimo do token do painel — o MoonShot recusa (503) token com menos de 32. */
export const TOKEN_PAINEL_MIN = 32

const url = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v),
    'Endereço inválido (use http:// ou https://).',
  )
  .nullish()
  .transform((v) => v || null)

const schemaBase = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do sistema.').max(80),
  urlAvisos: url,
  urlPainel: url,
  tokenPainel: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => v === '' || v.length >= TOKEN_PAINEL_MIN,
      `O token do painel precisa ter pelo menos ${TOKEN_PAINEL_MIN} caracteres.`,
    )
    .optional(),
})
const schemaNovo = schemaBase.extend({
  sistema: z.enum(SISTEMAS as [string, ...string[]], 'Escolha o sistema.'),
})

/** Hash da chave (SHA-256, hex). A chave crua nunca é guardada. */
export const hashDaChave = (chave: string) => createHash('sha256').update(chave).digest('hex')

/** Chave nova: `rtk_` + 32 caracteres aleatórios. */
const novaChave = () => `rtk_${randomBytes(24).toString('base64url')}`

const PREFIXO = 8

export function criarServicoIntegracoes(db: Db) {
  const linhaParaIntegracao = (l: IntegracoesTable, pendentes: number): Integracao => ({
    id: l.id,
    sistema: l.sistema,
    nome: l.nome,
    chavePrefixo: l.chaveHash ? l.chavePrefixo : null,
    chaveCriadaEm: l.chaveHash ? l.chaveCriadaEm : null,
    urlAvisos: l.urlAvisos,
    urlPainel: l.urlPainel,
    temTokenPainel: Boolean(l.tokenPainel),
    status: l.status as Integracao['status'],
    ultimoUsoEm: l.ultimoUsoEm,
    ultimoAvisoEm: l.ultimoAvisoEm,
    ultimoPainelEm: l.ultimoPainelEm,
    ultimoErro: l.ultimoErro,
    ultimoErroEm: l.ultimoErroEm,
    avisosPendentes: pendentes,
    criadoEm: l.criadoEm,
    criadoPor: l.criadoPor,
    alteradoEm: l.alteradoEm,
    alteradoPor: l.alteradoPor,
  })

  async function pendentesPorIntegracao() {
    const linhas = await db
      .selectFrom('integracoesAvisos')
      .select(['integracaoId', db.fn.countAll<number>().as('n')])
      .where('enviadoEm', 'is', null)
      .groupBy('integracaoId')
      .execute()
    return new Map(linhas.map((l) => [l.integracaoId, Number(l.n)]))
  }

  async function listar(): Promise<Integracao[]> {
    const [linhas, pendentes] = await Promise.all([
      db.selectFrom('integracoes').selectAll().orderBy('nome').execute(),
      pendentesPorIntegracao(),
    ])
    return linhas.map((l) => linhaParaIntegracao(l, pendentes.get(l.id) ?? 0))
  }

  async function linha(id: string) {
    const l = await db.selectFrom('integracoes').selectAll().where('id', '=', id).executeTakeFirst()
    if (!l) throw naoEncontrado('Integração não encontrada.')
    return l
  }

  async function obter(id: string): Promise<IntegracaoDetalhe> {
    const l = await linha(id)
    const [pendentes, historico, avisos] = await Promise.all([
      pendentesPorIntegracao(),
      listarHistorico(db, 'integracao', id),
      db
        .selectFrom('integracoesAvisos')
        .select(['id', 'codigo', 'evento', 'tentativas', 'erro', 'criadoEm', 'enviadoEm'])
        .where('integracaoId', '=', id)
        .orderBy('criadoEm', 'desc')
        .limit(20)
        .execute(),
    ])
    return {
      ...linhaParaIntegracao(l, pendentes.get(id) ?? 0),
      historico,
      avisos,
      acoesPermitidas: l.status === 'ativo' ? ['inativar'] : ['reativar'],
    }
  }

  async function criar(corpo: unknown, autor: string) {
    const v = schemaNovo.parse(corpo)
    const existe = await db
      .selectFrom('integracoes')
      .select('id')
      .where('sistema', '=', v.sistema)
      .executeTakeFirst()
    if (existe) throw new ErroApi(409, 'system_in_use', 'Este sistema já está cadastrado.')
    const agora = new Date().toISOString()
    const id = randomUUID()
    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto('integracoes')
        .values({
          id,
          sistema: v.sistema,
          nome: v.nome,
          chaveHash: null,
          chavePrefixo: null,
          chaveCriadaEm: null,
          urlAvisos: v.urlAvisos,
          urlPainel: v.urlPainel,
          tokenPainel: v.tokenPainel || null,
          status: 'ativo',
          ultimoUsoEm: null,
          ultimoAvisoEm: null,
          ultimoPainelEm: null,
          ultimoErro: null,
          ultimoErroEm: null,
          criadoEm: agora,
          criadoPor: autor,
          alteradoEm: agora,
          alteradoPor: autor,
        })
        .execute()
      await registrarHistorico(trx, 'integracao', id, { autor, em: agora, acao: 'criado' })
    })
    return obter(id)
  }

  async function atualizar(id: string, corpo: unknown, autor: string) {
    const v = schemaBase.parse(corpo)
    const atual = await linha(id)
    const mudancas: Mudanca[] = []
    const comparar = (campo: string, antes: string | null, depois: string | null) => {
      if ((antes ?? null) !== (depois ?? null)) mudancas.push({ campo, antes, depois })
    }
    comparar('nome', atual.nome, v.nome)
    comparar('urlAvisos', atual.urlAvisos, v.urlAvisos)
    comparar('urlPainel', atual.urlPainel, v.urlPainel)
    const token = v.tokenPainel === undefined ? atual.tokenPainel : v.tokenPainel || null
    // O token é segredo: o histórico diz que mudou, nunca o valor.
    if (token !== atual.tokenPainel)
      mudancas.push({
        campo: 'tokenPainel',
        antes: atual.tokenPainel ? 'definido' : null,
        depois: token ? 'definido' : null,
      })
    if (!mudancas.length) return obter(id)
    const agora = new Date().toISOString()
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('integracoes')
        .set({
          nome: v.nome,
          urlAvisos: v.urlAvisos,
          urlPainel: v.urlPainel,
          tokenPainel: token,
          alteradoEm: agora,
          alteradoPor: autor,
        })
        .where('id', '=', id)
        .execute()
      await registrarHistorico(trx, 'integracao', id, {
        autor,
        em: agora,
        acao: 'editado',
        mudancas,
      })
    })
    return obter(id)
  }

  /** Gera (ou troca) a chave. Devolve a chave crua — a única vez que ela aparece. */
  async function gerarChave(id: string, autor: string) {
    const atual = await linha(id)
    const chave = novaChave()
    const agora = new Date().toISOString()
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('integracoes')
        .set({
          chaveHash: hashDaChave(chave),
          chavePrefixo: chave.slice(0, PREFIXO),
          chaveCriadaEm: agora,
          alteradoEm: agora,
          alteradoPor: autor,
        })
        .where('id', '=', id)
        .execute()
      await registrarHistorico(trx, 'integracao', id, {
        autor,
        em: agora,
        acao: atual.chaveHash ? 'chave_trocada' : 'chave_gerada',
        mudancas: [
          { campo: 'chave', antes: atual.chavePrefixo ?? null, depois: chave.slice(0, PREFIXO) },
        ],
      })
    })
    return { chave, integracao: await obter(id) }
  }

  async function revogarChave(id: string, autor: string) {
    const atual = await linha(id)
    if (!atual.chaveHash) return obter(id)
    const agora = new Date().toISOString()
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('integracoes')
        .set({ chaveHash: null, alteradoEm: agora, alteradoPor: autor })
        .where('id', '=', id)
        .execute()
      await registrarHistorico(trx, 'integracao', id, {
        autor,
        em: agora,
        acao: 'chave_revogada',
        mudancas: [{ campo: 'chave', antes: atual.chavePrefixo, depois: null }],
      })
    })
    return obter(id)
  }

  async function transicionar(id: string, corpo: unknown, autor: string) {
    const { acao } = z.object({ acao: z.enum(['inativar', 'reativar']) }).parse(corpo)
    const atual = await linha(id)
    const destino = acao === 'inativar' ? 'inativo' : 'ativo'
    if (atual.status === destino)
      throw new ErroApi(409, 'invalid_transition', 'A integração já está nesse status.')
    const agora = new Date().toISOString()
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('integracoes')
        .set({ status: destino, alteradoEm: agora, alteradoPor: autor })
        .where('id', '=', id)
        .execute()
      await registrarHistorico(trx, 'integracao', id, {
        autor,
        em: agora,
        acao: 'status',
        mudancas: [{ campo: 'status', antes: atual.status, depois: destino }],
      })
    })
    return obter(id)
  }

  return { listar, obter, criar, atualizar, gerarChave, revogarChave, transicionar }
}

export type ServicoIntegracoes = ReturnType<typeof criarServicoIntegracoes>

/**
 * A integração ATIVA dona desta chave (null = chave errada, revogada ou integração inativa).
 * Anota o último uso (no máximo uma escrita por minuto).
 */
export async function autenticarChave(db: Db, chave: string | undefined) {
  if (!chave || chave.length < 10) return null
  const hash = hashDaChave(chave.trim())
  const l = await db
    .selectFrom('integracoes')
    .selectAll()
    .where('chaveHash', '=', hash)
    .where('status', '=', 'ativo')
    .executeTakeFirst()
  // Comparação em tempo constante (a consulta já filtrou; isto evita confiar só no índice).
  if (!l?.chaveHash || !timingSafeEqual(Buffer.from(l.chaveHash), Buffer.from(hash))) return null
  const agora = new Date()
  if (!l.ultimoUsoEm || agora.getTime() - Date.parse(l.ultimoUsoEm) > 60_000)
    await db
      .updateTable('integracoes')
      .set({ ultimoUsoEm: agora.toISOString() })
      .where('id', '=', l.id)
      .execute()
  return l
}

export function rotasIntegracoes(servico: ServicoIntegracoes) {
  const r = Router()
  r.get('/sistemas', (_req, res) => {
    res.json(DESTINOS.map((d) => ({ sistema: d.sistema, nome: d.nome })))
  })
  r.get('/', async (_req, res) => {
    res.json(await servico.listar())
  })
  r.get('/:id', async (req, res) => {
    res.json(await servico.obter(String(req.params.id)))
  })
  r.post('/', async (req, res) => {
    res.status(201).json(await servico.criar(req.body, autorDa(req)))
  })
  r.put('/:id', async (req, res) => {
    res.json(await servico.atualizar(String(req.params.id), req.body, autorDa(req)))
  })
  r.post('/:id/chave', async (req, res) => {
    res.json(await servico.gerarChave(String(req.params.id), autorDa(req)))
  })
  r.delete('/:id/chave', async (req, res) => {
    res.json(await servico.revogarChave(String(req.params.id), autorDa(req)))
  })
  r.post('/:id/transicao', async (req, res) => {
    res.json(await servico.transicionar(String(req.params.id), req.body, autorDa(req)))
  })
  return r
}
