import { Router, type NextFunction, type Request, type Response } from 'express'
import { z, ZodError } from 'zod'
import type { Db } from '../../db/database.js'
import type { IntegracoesTable } from '../../db/schema.js'
import { ErroApi } from '../../shared/erros.js'
import { registrarHistorico } from '../../shared/historico.repositorio.js'
import { ordemNoContrato } from './contrato.js'
import { autenticarChave } from './integracao.js'
import { aplicarAndamento } from './sincronizacao.js'

/*
 * CONTRATO DE INTEGRAÇÃO v1 — o MESMO do iERP antigo, para os sistemas de fora (MoonShot)
 * funcionarem com os dois iERPs ao mesmo tempo (ordem do usuário, 19/10/2026: o antigo e o
 * novo rodam juntos até o novo substituir tudo; nada do contrato antigo muda).
 *
 * Autenticação: `X-Api-Key` (a chave gerada em Administração › Integração). Cada chave só
 * enxerga os lotes do SEU sistema (Dell → MOONSHOT). Respostas no formato da casa:
 * `{ success: true, data }` ou `{ success: false, error: { message, code } }`.
 *
 *   GET    /api/integracao/v1/ping
 *   GET    /api/integracao/v1/ordens?desde=<ISO>      { lotes, temMais, proximoDesde }
 *   GET    /api/integracao/v1/ordens/:codigo
 *   GET    /api/integracao/v1/ordens/:codigo/anexos/:numero   o arquivo
 *   POST   /api/integracao/v1/ordens/:codigo/balanco          retrato do balanço (o último vence)
 *   POST   /api/integracao/v1/ordens/:codigo/devolucao        { motivo, pedidoPor } → ordem
 *   DELETE /api/integracao/v1/ordens/:codigo/devolucao        → ordem
 */

const POR_PAGINA = 50

type Arquivo = { tipoConteudo: string; nome: string; conteudo: Buffer }

declare module 'express-serve-static-core' {
  interface Request {
    integracao?: IntegracoesTable
  }
}

const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data })

export function rotasContratoIntegracao(
  db: Db,
  arquivoDoAnexo: (ordemId: string, anexoId: string) => Promise<Arquivo>,
) {
  const r = Router()

  r.use(async (req, _res, next) => {
    const integracao = await autenticarChave(db, req.header('X-Api-Key') ?? undefined)
    if (!integracao)
      throw new ErroApi(
        401,
        'invalid_key',
        'Chave de integração ausente, revogada ou inválida. Gere uma em Administração › Integração.',
      )
    req.integracao = integracao
    next()
  })

  /** O lote pelo código — só se for do sistema desta chave (senão, para ela, não existe). */
  async function loteDaChave(req: Request) {
    const codigo = String(req.params.codigo ?? '').trim()
    const o = await db
      .selectFrom('ordens')
      .select(['id', 'status'])
      .where('codigo', '=', codigo)
      .executeTakeFirst()
    const contrato = o ? await ordemNoContrato(db, o.id) : null
    if (!o || !contrato || contrato.sistema !== req.integracao!.sistema)
      throw new ErroApi(404, 'not_found', `Lote ${codigo} não encontrado para este sistema.`)
    return { id: o.id, status: o.status, contrato }
  }

  r.get('/ping', (req, res) => {
    ok(res, {
      sistema: req.integracao!.sistema,
      nome: req.integracao!.nome,
      ierp: 'v2',
      em: new Date().toISOString(),
    })
  })

  r.get('/ordens', async (req, res) => {
    const desde = typeof req.query.desde === 'string' && req.query.desde ? req.query.desde : null
    // Todas as ordens que mudaram desde o instante (na ordem em que mudaram) e são deste sistema.
    let consulta = db
      .selectFrom('ordensLista')
      .select(['id', 'alteradoEm', 'clienteNome'])
      .orderBy('alteradoEm')
      .orderBy('id')
    if (desde) consulta = consulta.where('alteradoEm', '>', desde)
    const linhas = await consulta.execute()
    const lotes: unknown[] = []
    let ultimo: string | null = null
    let temMais = false
    for (const l of linhas) {
      const c = await ordemNoContrato(db, l.id)
      if (c?.sistema !== req.integracao!.sistema) continue
      if (lotes.length === POR_PAGINA) {
        temMais = true
        break
      }
      lotes.push(c.corpo)
      ultimo = l.alteradoEm
    }
    ok(res, { lotes, temMais, proximoDesde: ultimo ?? desde })
  })

  r.get('/ordens/:codigo', async (req, res) => {
    ok(res, (await loteDaChave(req)).contrato.corpo)
  })

  r.get('/ordens/:codigo/anexos/:numero', async (req, res) => {
    const lote = await loteDaChave(req)
    const numero = Number(req.params.numero)
    const anexo = await db
      .selectFrom('ordensAnexos')
      .select('id')
      .where('ordemId', '=', lote.id)
      .where('numero', '=', Number.isInteger(numero) ? numero : -1)
      .executeTakeFirst()
    if (!anexo) throw new ErroApi(404, 'not_found', 'Anexo não encontrado neste lote.')
    const a = await arquivoDoAnexo(lote.id, anexo.id)
    res.setHeader('Content-Type', a.tipoConteudo)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.attachment(a.nome)
    res.send(a.conteudo)
  })

  const balancoSchema = z.object({
    fase: z
      .object({
        nome: z.string().nullish(),
        indice: z.number().int().nullish(),
        total: z.number().int().nullish(),
        momento: z.string().nullish(),
      })
      .nullish(),
    externo: z
      .object({ url: z.string().nullish(), fechadoEm: z.string().nullish() })
      .passthrough()
      .nullish(),
  })

  r.post('/ordens/:codigo/balanco', async (req, res) => {
    const lote = await loteDaChave(req)
    const v = balancoSchema.passthrough().parse(req.body)
    const agora = new Date().toISOString()
    const payload = JSON.stringify(req.body)
    await db
      .insertInto('ordensBalancos')
      .values({ ordemId: lote.id, sistema: req.integracao!.sistema, payload, recebidoEm: agora })
      .onConflict((oc) =>
        oc
          .column('ordemId')
          .doUpdateSet({ sistema: req.integracao!.sistema, payload, recebidoEm: agora }),
      )
      .execute()
    const fase = v.fase
    if (fase) {
      const encerrado = fase.momento === 'fim'
      // Pela fase do balanço só dá para afirmar que houve ação a partir da 2ª fase (a 1ª é a
      // pesagem das caixas, que o PAINEL informa — ele diz `ultimaAtividadeEm`).
      const houveAcao = encerrado || (fase.indice ?? 0) >= 2
      const atual = await db
        .selectFrom('ordens')
        .select(['processamentoDesde', 'status'])
        .where('id', '=', lote.id)
        .executeTakeFirstOrThrow()
      await aplicarAndamento(db, lote.id, req.integracao!, {
        etapa: fase.nome ?? null,
        indice: fase.indice ?? null,
        total: fase.total ?? null,
        desde: atual.processamentoDesde,
        url: v.externo?.url ?? null,
        ultimaAtividadeEm: houveAcao ? agora : atual.status === 'processo' ? agora : null,
        encerradoEm: encerrado ? (v.externo?.fechadoEm ?? agora) : null,
      })
    }
    ok(res, { recebido: true, codigo: lote.contrato.corpo.codigo })
  })

  const devolucaoSchema = z.object({
    motivo: z.string().trim().min(1, 'Diga o motivo da devolução.').max(2000),
    pedidoPor: z.string().trim().max(200).nullish(),
  })

  r.post('/ordens/:codigo/devolucao', async (req, res) => {
    const lote = await loteDaChave(req)
    const v = devolucaoSchema.parse(req.body)
    if (lote.status === 'agendado' || lote.status === 'concluido')
      throw new ErroApi(
        409,
        'invalid_transition',
        lote.status === 'agendado'
          ? 'O lote ainda não foi recebido no iERP.'
          : 'O lote já foi concluído no iERP: a devolução não é mais possível.',
      )
    const agora = new Date().toISOString()
    const autor = v.pedidoPor ? `${v.pedidoPor} (${req.integracao!.nome})` : req.integracao!.nome
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('ordens')
        .set({
          devolucaoMotivo: v.motivo,
          devolucaoPedidoPor: v.pedidoPor ?? null,
          devolucaoEm: agora,
          alteradoEm: agora,
          alteradoPor: req.integracao!.nome,
        })
        .where('id', '=', lote.id)
        .execute()
      await registrarHistorico(trx, 'ordem', lote.id, {
        autor,
        em: agora,
        acao: 'devolucao_pedida',
        mudancas: [{ campo: 'motivoDevolucao', antes: null, depois: v.motivo }],
      })
    })
    ok(res, (await ordemNoContrato(db, lote.id))!.corpo)
  })

  r.delete('/ordens/:codigo/devolucao', async (req, res) => {
    const lote = await loteDaChave(req)
    const agora = new Date().toISOString()
    if (lote.contrato.corpo.devolucao)
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable('ordens')
          .set({
            devolucaoMotivo: null,
            devolucaoPedidoPor: null,
            devolucaoEm: null,
            alteradoEm: agora,
            alteradoPor: req.integracao!.nome,
          })
          .where('id', '=', lote.id)
          .execute()
        await registrarHistorico(trx, 'ordem', lote.id, {
          autor: req.integracao!.nome,
          em: agora,
          acao: 'devolucao_cancelada',
        })
      })
    ok(res, (await ordemNoContrato(db, lote.id))!.corpo)
  })

  // Erros no formato da casa: o MoonShot mostra a `message` como veio (ela diz o que fazer).
  r.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err)
    if (err instanceof ErroApi)
      return res.status(err.status).json({
        success: false,
        error: { message: err.message, code: err.code },
      })
    if (err instanceof ZodError)
      return res.status(422).json({
        success: false,
        error: {
          message: err.issues.map((i) => i.message).join(' '),
          code: 'validation',
        },
      })
    console.error('[integracao]', err)
    return res.status(500).json({
      success: false,
      error: { message: 'Erro no iERP ao atender a integração.', code: 'server' },
    })
  })
  return r
}
