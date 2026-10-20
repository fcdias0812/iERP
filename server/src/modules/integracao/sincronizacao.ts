import { randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import type { Db } from '../../db/database.js'
import type { IntegracoesTable } from '../../db/schema.js'
import { registrarHistorico } from '../../shared/historico.repositorio.js'
import { sistemaDoLote, tipoDoSistema } from './destinos.js'
import { criarSincronizacaoGerenciamento } from './gerenciamento.js'

/*
 * Conversa com os sistemas de fora (hoje o MoonShot, da Dell) — o mesmo protocolo do iERP
 * antigo:
 *  - AVISO (iERP → sistema): "olha o lote LOT-00001". O aviso é só uma campainha: o sistema de
 *    fora BUSCA o lote com a chave dele. Fila em `integracoes_avisos`, reenviada com espera
 *    crescente quando ele está fora do ar (resposta que não é 2xx).
 *  - PAINEL (sistema → iERP, lido daqui a cada 30 s): em que fase está cada lote lá
 *    (`GET .../api/ierp2/painel` — só os lotes do 2.0 —, com o token do painel em `X-Reteck-Token` e `X-Api-Key`).
 *  - BALANÇO (sistema → iERP, rota do contrato): traz a fase também.
 *
 * O STATUS do lote (pedido do usuário, 19/10/2026): recebido aqui → vai para o MoonShot e fica
 * em "Recebidos" (inspeção) ATÉ A PRIMEIRA AÇÃO LÁ (o painel diz `ultimaAtividadeEm`); daí vira
 * "Processamento i/N · <fase>" (status `processo`); com o lote encerrado lá, fica Concluído (o SLA
 * da Dell termina no encerramento).
 */

export interface Andamento {
  etapa: string | null
  indice: number | null
  total: number | null
  /** Entrou na fase atual. */
  desde: string | null
  /** Tela do lote no sistema de fora. */
  url?: string | null
  /** Última coisa que alguém FEZ lá (null = ninguém mexeu ainda). */
  ultimaAtividadeEm: string | null
  /** O lote foi encerrado lá. */
  encerradoEm: string | null
}

type Fetch = typeof fetch

const agoraIso = () => new Date().toISOString()

/** Apaga o último erro só se ele for deste assunto ("Aviso…" ou "Painel…"). */
const limparErro = (assunto: string) =>
  sql<string | null>`case when ultimo_erro like ${`${assunto}%`} then null else ultimo_erro end`
const limparErroEm = (assunto: string) =>
  sql<string | null>`case when ultimo_erro like ${`${assunto}%`} then null else ultimo_erro_em end`

const rotuloFase = (a: { etapa: string | null; indice: number | null; total: number | null }) =>
  a.etapa === null && a.indice === null
    ? null
    : `${a.indice ?? '?'}/${a.total ?? '?'}${a.etapa ? ` · ${a.etapa}` : ''}`

/**
 * Aplica no lote o andamento informado pelo sistema de fora. Devolve true se algo mudou.
 * Lote ainda não recebido (agendado) é ignorado; lote concluído não volta atrás.
 */
export async function aplicarAndamento(
  db: Db,
  ordemId: string,
  integracao: Pick<IntegracoesTable, 'sistema' | 'nome'>,
  a: Andamento,
): Promise<boolean> {
  return db.transaction().execute(async (trx) => {
    const o = await trx
      .selectFrom('ordens')
      .select([
        'status',
        'processamentoSistema',
        'processamentoEtapa',
        'processamentoIndice',
        'processamentoTotal',
        'processamentoDesde',
        'processamentoUrl',
      ])
      .where('id', '=', ordemId)
      .executeTakeFirst()
    if (!o || o.status === 'agendado') return false

    const encerrado = Boolean(a.encerradoEm)
    // Concluído aqui é o fim: um painel que ainda mostra o lote aberto (atrasado, ou um lote
    // que lá nem começou) não volta a fase mostrada para trás.
    if (o.status === 'concluido' && !encerrado) return false
    let novoStatus = o.status
    if (o.status !== 'concluido') {
      if (encerrado) novoStatus = 'concluido'
      else if (a.ultimaAtividadeEm) novoStatus = 'processo'
    }

    const faseAntes = rotuloFase({
      etapa: o.processamentoEtapa,
      indice: o.processamentoIndice,
      total: o.processamentoTotal,
    })
    const faseDepois = rotuloFase(a)
    const url = a.url === undefined ? o.processamentoUrl : a.url
    const mudouFase =
      faseAntes !== faseDepois ||
      o.processamentoSistema !== integracao.sistema ||
      (a.desde ?? null) !== (o.processamentoDesde ?? null)
    const mudouStatus = novoStatus !== o.status
    if (!mudouFase && !mudouStatus && url === o.processamentoUrl) return false

    const agora = agoraIso()
    await trx
      .updateTable('ordens')
      .set({
        processamentoSistema: integracao.sistema,
        processamentoEtapa: a.etapa,
        processamentoIndice: a.indice,
        processamentoTotal: a.total,
        processamentoDesde: a.desde,
        processamentoUrl: url ?? null,
        processamentoAtualizadoEm: agora,
        ...(mudouStatus
          ? {
              status: novoStatus,
              etapaDesde:
                novoStatus === 'concluido' ? (a.encerradoEm ?? agora) : (a.desde ?? agora),
              ...(novoStatus === 'concluido' ? { codEmitidoEm: a.encerradoEm ?? agora } : {}),
            }
          : {}),
        ...(mudouFase || mudouStatus ? { alteradoEm: agora, alteradoPor: integracao.nome } : {}),
      })
      .where('id', '=', ordemId)
      .execute()

    if (mudouStatus) {
      const em =
        novoStatus === 'concluido' ? (a.encerradoEm ?? agora) : (a.ultimaAtividadeEm ?? agora)
      await trx
        .insertInto('ordensEtapas')
        .values({ id: randomUUID(), ordemId, etapa: novoStatus, em, autor: integracao.nome })
        .execute()
      await registrarHistorico(trx, 'ordem', ordemId, {
        autor: integracao.nome,
        em: agora,
        acao: 'status',
        mudancas: [{ campo: 'status', antes: o.status, depois: novoStatus }],
      })
    }
    // A fase só entra no histórico depois da primeira ação (antes disso o lote está parado lá).
    if (faseAntes !== faseDepois && (novoStatus === 'processo' || novoStatus === 'concluido'))
      await registrarHistorico(trx, 'ordem', ordemId, {
        autor: integracao.nome,
        em: agora,
        acao: 'processamento',
        mudancas: [{ campo: 'processamento', antes: faseAntes, depois: faseDepois }],
      })
    return true
  })
}

/* ------------------------------------------------------------------ avisos */

/**
 * Põe na fila um aviso ao sistema que processa o lote (se houver e estiver ativo com endereço
 * de aviso). Um aviso PENDENTE por lote e sistema: o conteúdo é sempre buscado na hora.
 */
export async function enfileirarAviso(db: Db, ordemId: string, evento: string) {
  const o = await db
    .selectFrom('ordensLista')
    .select(['codigo', 'clienteNome', 'externoSistema'])
    .where('id', '=', ordemId)
    .executeTakeFirst()
  if (!o) return
  const sistema = sistemaDoLote(o)
  if (!sistema) return
  const integracao = await db
    .selectFrom('integracoes')
    .select(['id', 'urlAvisos'])
    .where('sistema', '=', sistema)
    .where('status', '=', 'ativo')
    .executeTakeFirst()
  if (!integracao?.urlAvisos) return
  const agora = agoraIso()
  const pendente = await db
    .selectFrom('integracoesAvisos')
    .select('id')
    .where('integracaoId', '=', integracao.id)
    .where('ordemId', '=', ordemId)
    .where('enviadoEm', 'is', null)
    .executeTakeFirst()
  if (pendente)
    await db
      .updateTable('integracoesAvisos')
      .set({ evento, proximaEm: agora })
      .where('id', '=', pendente.id)
      .execute()
  else
    await db
      .insertInto('integracoesAvisos')
      .values({
        id: randomUUID(),
        integracaoId: integracao.id,
        ordemId,
        codigo: o.codigo,
        evento,
        tentativas: 0,
        proximaEm: agora,
        erro: null,
        criadoEm: agora,
        enviadoEm: null,
      })
      .execute()
}

/** Espera antes da tentativa n (15 s, 30 s, 1 min… até 1 h). */
const espera = (tentativas: number) =>
  Math.min(15_000 * 2 ** Math.max(0, tentativas - 1), 3_600_000)

const TIMEOUT_MS = 15_000

/** Envia os avisos vencidos. Devolve quantos foram entregues. */
export async function enviarAvisos(db: Db, fazerFetch: Fetch = fetch): Promise<number> {
  const agora = agoraIso()
  const pendentes = await db
    .selectFrom('integracoesAvisos as a')
    .innerJoin('integracoes as i', 'i.id', 'a.integracaoId')
    .select(['a.id', 'a.codigo', 'a.evento', 'a.tentativas', 'a.integracaoId', 'i.urlAvisos'])
    .where('a.enviadoEm', 'is', null)
    .where('a.proximaEm', '<=', agora)
    .where('i.status', '=', 'ativo')
    .orderBy('a.proximaEm')
    .limit(20)
    .execute()
  let entregues = 0
  for (const p of pendentes) {
    let erro: string | null = null
    let definitivo = false
    try {
      if (!p.urlAvisos) throw new Error('Sem endereço de aviso cadastrado.')
      const r = await fazerFetch(p.urlAvisos, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Reteck-Evento': p.evento },
        body: JSON.stringify({ codigo: p.codigo, evento: p.evento }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!r.ok) {
        const texto = await r.text().catch(() => '')
        erro = `O sistema respondeu ${r.status}${texto ? `: ${texto.slice(0, 300)}` : ''}`
        // 4xx (fora 408/429) é "analisei e recusei": reenviar não muda a resposta.
        definitivo = r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429
      }
    } catch (e) {
      erro = `Não consegui avisar: ${(e as Error).message}`
    }
    const quando = agoraIso()
    if (!erro || definitivo) {
      if (!erro) entregues++
      await db
        .updateTable('integracoesAvisos')
        .set({ enviadoEm: quando, erro, tentativas: p.tentativas + 1 })
        .where('id', '=', p.id)
        .execute()
    } else {
      await db
        .updateTable('integracoesAvisos')
        .set({
          tentativas: p.tentativas + 1,
          erro,
          proximaEm: new Date(Date.now() + espera(p.tentativas + 1)).toISOString(),
        })
        .where('id', '=', p.id)
        .execute()
    }
    await db
      .updateTable('integracoes')
      .set(
        erro
          ? { ultimoErro: `Aviso do ${p.codigo}: ${erro}`, ultimoErroEm: quando }
          : // Deu certo: o erro antigo DOS AVISOS sai (o do painel, se houver, fica).
            {
              ultimoAvisoEm: quando,
              ultimoErro: limparErro('Aviso'),
              ultimoErroEm: limparErroEm('Aviso'),
            },
      )
      .where('id', '=', p.integracaoId)
      .execute()
  }
  return entregues
}

/* ------------------------------------------------------------------ painel */

interface LotePainel {
  lote?: string
  grupo?: string
  etapa?: { nome?: string; desde?: string | null; indice?: number; total?: number } | null
  encerradoEm?: string | null
  ultimaAtividadeEm?: string | null
}

/** Lê o painel de UMA integração e aplica o andamento dos lotes. Devolve o resultado. */
export async function lerPainel(
  db: Db,
  integracao: IntegracoesTable,
  fazerFetch: Fetch = fetch,
): Promise<{ ok: boolean; lotes: number; atualizados: number; erro?: string }> {
  const quando = agoraIso()
  const falhar = async (erro: string) => {
    await db
      .updateTable('integracoes')
      .set({ ultimoErro: `Painel: ${erro}`, ultimoErroEm: quando })
      .where('id', '=', integracao.id)
      .execute()
    return { ok: false, lotes: 0, atualizados: 0, erro }
  }
  if (!integracao.urlPainel || !integracao.tokenPainel)
    return falhar('Sem endereço ou token do painel cadastrado.')
  let corpo: { ok?: boolean; lotes?: LotePainel[] }
  try {
    const r = await fazerFetch(integracao.urlPainel, {
      headers: { 'X-Reteck-Token': integracao.tokenPainel, 'X-Api-Key': integracao.tokenPainel },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!r.ok) return falhar(`O sistema respondeu ${r.status}.`)
    corpo = (await r.json()) as typeof corpo
  } catch (e) {
    return falhar(`Não consegui ler o painel: ${(e as Error).message}`)
  }
  const lotes = Array.isArray(corpo.lotes) ? corpo.lotes : []
  const codigos = lotes.map((l) => l.lote).filter((c): c is string => typeof c === 'string')
  const ordens = codigos.length
    ? await db
        .selectFrom('ordensLista')
        .select(['id', 'codigo', 'clienteNome', 'externoSistema'])
        .where('codigo', 'in', codigos)
        .execute()
    : []
  const porCodigo = new Map(ordens.map((o) => [o.codigo, o]))
  let atualizados = 0
  for (const l of lotes) {
    const o = l.lote ? porCodigo.get(l.lote) : undefined
    // Só os lotes DESTE iERP que vão para ESTE sistema (o painel traz também os do iERP antigo).
    if (!o || sistemaDoLote(o) !== integracao.sistema) continue
    const mudou = await aplicarAndamento(db, o.id, integracao, {
      etapa: l.etapa?.nome ?? null,
      indice: typeof l.etapa?.indice === 'number' ? l.etapa.indice : null,
      total: typeof l.etapa?.total === 'number' ? l.etapa.total : null,
      desde: l.etapa?.desde ?? null,
      ultimaAtividadeEm: l.ultimaAtividadeEm ?? null,
      encerradoEm: l.grupo === 'encerrado' ? (l.encerradoEm ?? quando) : (l.encerradoEm ?? null),
    })
    if (mudou) atualizados++
  }
  await db
    .updateTable('integracoes')
    .set({
      ultimoPainelEm: quando,
      ultimoErro: limparErro('Painel'),
      ultimoErroEm: limparErroEm('Painel'),
    })
    .where('id', '=', integracao.id)
    .execute()
  return { ok: true, lotes: lotes.length, atualizados }
}

/**
 * Lê o painel de todas as integrações ativas que têm painel: dos sistemas que PROCESSAM os lotes
 * daqui (MoonShot), o andamento; dos sistemas de onde os lotes VÊM (Gerenciamento de Projetos),
 * os lotes inteiros (`gerenciamento.ts`).
 */
export async function lerPaineis(db: Db, fazerFetch: Fetch = fetch) {
  const integracoes = await db
    .selectFrom('integracoes')
    .selectAll()
    .where('status', '=', 'ativo')
    .where('urlPainel', 'is not', null)
    .where('tokenPainel', 'is not', null)
    .execute()
    // Só os sistemas de lotes: o rastreador (`modules/viagens/`) e os de estoque
    // (`modules/estoque/`, lidos ao abrir a tela) têm o caminho deles.
    .then((l) =>
      l.filter((i) => ['processamento', 'origem'].includes(tipoDoSistema(i.sistema))),
    )
  const gerenciamento = criarSincronizacaoGerenciamento(db, fazerFetch)
  // Cada sistema por conta própria, em paralelo: um lento ou com erro não segura o outro.
  const resultados = await Promise.allSettled(
    integracoes.map((i) =>
      tipoDoSistema(i.sistema) === 'origem'
        ? gerenciamento.sincronizar(i)
        : lerPainel(db, i, fazerFetch),
    ),
  )
  for (const [n, r] of resultados.entries())
    if (r.status === 'rejected') {
      const erro = r.reason instanceof Error ? r.reason.message : String(r.reason)
      console.error(`[integracao] ${integracoes[n]!.nome}:`, r.reason)
      await db
        .updateTable('integracoes')
        .set({ ultimoErro: `Painel: ${erro}`, ultimoErroEm: new Date().toISOString() })
        .where('id', '=', integracoes[n]!.id)
        .execute()
        .catch(() => undefined)
    }
}

/**
 * Liga os trabalhos de fundo (só no servidor de verdade, não nos testes): avisos a cada 5 s,
 * painel a cada 30 s (o mesmo ritmo do iERP antigo). Devolve a função que desliga.
 */
export function iniciarSincronizacao(db: Db) {
  let ocupadoAvisos = false
  let ocupadoPainel = false
  const avisos = setInterval(() => {
    if (ocupadoAvisos) return
    ocupadoAvisos = true
    void enviarAvisos(db)
      .catch((e: unknown) => console.error('[integracao] avisos:', e))
      .finally(() => (ocupadoAvisos = false))
  }, 5_000)
  const painel = setInterval(() => {
    if (ocupadoPainel) return
    ocupadoPainel = true
    void lerPaineis(db)
      .catch((e: unknown) => console.error('[integracao] painel:', e))
      .finally(() => (ocupadoPainel = false))
  }, 30_000)
  return () => {
    clearInterval(avisos)
    clearInterval(painel)
  }
}
