import { randomInt, randomUUID } from 'node:crypto'
import { Router } from 'express'
import type { Transaction } from 'kysely'
import { z } from 'zod'
import type { Db } from '../../db/database.js'
import type { Database, OrdensViagensTable } from '../../db/schema.js'
import { autorDa } from '../../shared/autor.js'
import { diaNoFuso } from '../../shared/datas.js'
import { ErroApi, naoEncontrado } from '../../shared/erros.js'
import { normalizar } from '../../shared/texto.js'
import type { EventoHistorico, Mudanca } from '../../shared/historico.js'
import { registrarHistorico } from '../../shared/historico.repositorio.js'
import type { Guardado } from '../integracao/gerenciamento.js'
import { FORMATOS, formatoValido, nomeBaseDoArquivo } from './exportar.js'
import {
  baseDoRastreador,
  campo,
  clienteDoRastreador,
  ehConflito,
  ehNaoEncontrado,
  lerResumo,
  statusDoRastreador,
  type ClienteRastreador,
  type MensagemRastreador,
  type ParadaRastreador,
  type PontoRastreador,
  type ResumoRastreador,
  type StatusViagem,
} from './rastreador.js'

/*
 * Ordens › Viagens (pedido do usuário, 20/10/2026): "Ao agendar uma ordem, ele gera em viagens um
 * card com a viagem do lote podendo acompanhar ele no mapa."
 *
 * O rastreio tem TRÊS peças: o iERP, o RASTREADOR de GPS (ReTeckTracker — recebe o GPS do celular
 * e avisa por SignalR) e o APP do motorista. O iERP nunca fala com o celular: ele manda ao
 * motorista um LINK (`<rastreador>/app/?os=LOT-…`) e o app abre a viagem no rastreador com o
 * código do lote. O rastreador é o MESMO do iERP antigo — os dois rodam juntos até o 2.0 assumir
 * (ordem do usuário): aqui só se acrescenta. Cada iERP cuida das viagens dos SEUS lotes (os códigos
 * não se cruzam: o antigo usa LOT-2026…, o 2.0 LOT-00001…); nada é apagado no rastreador.
 *
 * Decisões do usuário (20/10/2026):
 *  - a viagem nasce ao agendar com "Rastrear coleta = Sim" (situação "Aguardando motorista");
 *  - o CÓDIGO DE CHEGADA (6 dígitos) é sorteado aqui e gravado no rastreador quando a viagem
 *    começa; é falado no destino — nunca vai no link (é o que impede o motorista de encerrar a
 *    viagem sozinho no lugar errado);
 *  - receber o lote no iERP (Operação › Recebimento) ENCERRA a viagem;
 *  - os lotes do Gerenciamento de Projetos e do MSDC (rastreados pelo iERP antigo, com o LOT de
 *    lá) aparecem SÓ PARA VER;
 *  - emergência (com ciência) e chat com o motorista;
 *  - rastreador físico ("Usar rastreador") fica para depois — só o celular agora.
 *
 * O trajeto é ARQUIVADO aqui quando a viagem termina (o replay não depende do rastreador).
 *
 *   GET  /api/viagens?situacao=abertas|finalizadas[&desde=ISO]
 *   GET  /api/viagens/lote/:ordemId            as viagens do lote (uma por caminhão)
 *   POST /api/viagens/lote/:ordemId            { motoristaId, placa, rastreadorId? } — adicionar caminhão
 *   POST /api/viagens/:id/rastreios            { rastreadorId? } — mais um rastreador no mesmo caminhão
 *   GET  /api/viagens/:id                      detalhe + trajeto + paradas
 *   GET  /api/viagens/:id/chat                 conversa
 *   POST /api/viagens/:id/chat                 { texto } — mensagem para o motorista
 *   POST /api/viagens/:id/rastreador           { rastreadorId } — o caminhão vai pelo APARELHO de GPS
 *   POST /api/viagens/:id/finalizar            o operador encerra a viagem
 *   POST /api/viagens/:id/emergencia/ciente    ciência da emergência
 *   GET  /api/viagens/mapa/transito/:z/:x/:y.png   trânsito (TomTom), pela chave guardada aqui
 *   GET  /api/viagens/mapa/pois?s=&w=&n=&e=        postos e balanças (OpenStreetMap / Overpass)
 */

type Fetch = typeof fetch
type Conexao = Db | Transaction<Database>

export type FinalizadaPor = 'motorista' | 'operador' | 'recebimento' | 'rastreador'
export type OrigemGps = 'celular' | 'aparelho'

/** Um caminhão do lote: quem a Re-Teck escalou (motorista do cadastro e placa). */
export interface Caminhao {
  motoristaId: string | null
  placa: string | null
}

/** Placa para comparar (sem traço, maiúscula). */
const placaLimpa = (p: string | null | undefined) =>
  p ? p.replace(/[^0-9a-z]/gi, '').toUpperCase() : ''

export interface PosicaoViagem {
  latitude: number
  longitude: number
  /** m/s */
  velocidade: number | null
  em: string
}

export interface EmergenciaViagem {
  /** assalto | acidente | mecanico | medica (como o app manda) */
  tipo: string | null
  em: string
  latitude: number | null
  longitude: number | null
  cienteEm: string | null
  cientePor: string | null
}

export interface Viagem {
  id: string
  ordemId: string
  /** O caminhão do lote (1, 2, 3…) — 22/10/2026: várias viagens por lote. */
  numero: number
  /** celular (app do motorista) | aparelho (rastreador de GPS no caminhão). */
  origemGps: OrigemGps
  /** O aparelho (origem aparelho). */
  rastreadorId: string | null
  /** O id da placa do aparelho (ex.: gps-2998). */
  rastreadorAparelho: string | null
  loteCodigo: string
  /** IERP = lote agendado aqui; senão o sistema de onde o lote veio (só para ver). */
  origem: string
  somenteLeitura: boolean
  /** O código com que o motorista abre a viagem (nos lotes de fora, o LOT do iERP antigo). */
  codigoRastreio: string
  clienteNome: string
  siteCodigo: string | null
  siteEndereco: string | null
  siteLatitude: number | null
  siteLongitude: number | null
  /** Data da coleta: a confirmada ou, sem ela, a prevista. */
  dataColeta: string | null
  coletaConfirmada: boolean
  motoristaNome: string | null
  placa: string | null
  status: StatusViagem
  /** Só nos lotes daqui. */
  codigoChegada: string | null
  linkMotorista: string | null
  tripId: number | null
  iniciadaEm: string | null
  chegouEm: string | null
  terminadaEm: string | null
  finalizadaPor: FinalizadaPor | null
  posicao: PosicaoViagem | null
  totalPontos: number
  distanciaMetros: number | null
  emergencia: EmergenciaViagem | null
}

export interface PontoTrajeto {
  latitude: number
  longitude: number
  velocidade: number | null
  /** Precisão do GPS (m), quando o app manda. */
  precisao: number | null
  em: string
}

export interface ParadaViagem {
  id: number
  motivo: string
  latitude: number
  longitude: number
  fotoUrl: string | null
  em: string
}

export interface MensagemViagem {
  id: number
  remetente: 'operador' | 'motorista'
  texto: string | null
  midiaUrl: string | null
  em: string
}

export interface ViagemDetalhe extends Viagem {
  trajeto: PontoTrajeto[]
  paradas: ParadaViagem[]
  /** O rastreador não respondeu: o trajeto pode estar incompleto. */
  rastreadorIndisponivel: boolean
}

export interface ViagensResposta {
  /** Há rastreador cadastrado e ativo em Administração › Integração? */
  configurado: boolean
  /** Há chave do mapa de trânsito? (liga o botão Trânsito) */
  temTransito: boolean
  viagens: Viagem[]
  /** Último erro ao falar com o rastreador (null = tudo certo). */
  erro: string | null
  atualizadoEm: string
}

/** Situações em que a viagem ainda está "na rua" (ou esperando sair). */
export const ABERTAS: StatusViagem[] = ['aguardando_motorista', 'em_rota', 'chegou']

/** Código de chegada: 6 dígitos, nunca começando com zero (ninguém confunde ao ditar). */
export const gerarCodigoChegada = () => String(randomInt(100_000, 1_000_000))

/** Prefixo do id das viagens dos lotes de fora (vivem só na memória; o id é o do rastreador). */
const PREFIXO_DE_FORA = 'ext-'

/** Distância em metros entre dois pontos (Haversine). */
export function distanciaEmMetros(a: PontoTrajeto, b: PontoTrajeto) {
  const R = 6_371_000
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLng = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * Pontos do rastreador → trajeto, na ordem, SEM duplicados. Herança do iERP antigo: a fila
 * offline do app reenvia o lote inteiro (uma viagem chegou com 98,8% de pontos repetidos).
 */
export function trajetoDe(pontos: PontoRastreador[]): PontoTrajeto[] {
  const vistos = new Set<string>()
  const unicos: PontoTrajeto[] = []
  for (const p of [...pontos].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))) {
    const chave = `${p.recordedAt}|${p.latitude}|${p.longitude}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    unicos.push({
      latitude: p.latitude,
      longitude: p.longitude,
      velocidade: p.speedMps ?? null,
      precisao: p.accuracyM ?? null,
      em: p.recordedAt,
    })
  }
  return unicos
}

export function distanciaDoTrajeto(t: PontoTrajeto[]) {
  let total = 0
  for (let i = 1; i < t.length; i++) total += distanciaEmMetros(t[i - 1]!, t[i]!)
  return total
}

/**
 * Qual viagem do rastreador é a deste lote: a que já está amarrada (pelo id); senão a que está na
 * rua; senão a última finalizada — mas só se começou DEPOIS de a viagem nascer aqui (uma viagem
 * velha com o mesmo código, de teste, nunca é amarrada).
 */
export function escolherViagem(
  v: { tripId: number | null; criadoEm: string },
  doRastreador: ResumoRastreador[],
): ResumoRastreador | null {
  if (v.tripId !== null) {
    const mesma = doRastreador.find((t) => t.tripId === v.tripId)
    if (mesma) return mesma
  }
  const desde = Date.parse(v.criadoEm) - 10 * 60_000
  const validas = doRastreador.filter((t) => {
    const inicio = Date.parse(t.startedAt)
    return Number.isNaN(inicio) || inicio >= desde
  })
  const naRua = validas
    .filter((t) => {
      const s = statusDoRastreador(t.status)
      return s === 'em_rota' || s === 'chegou'
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  if (naRua[0]) return naRua[0]
  return (
    validas
      .filter((t) => statusDoRastreador(t.status) === 'finalizada')
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null
  )
}

/**
 * A viagem daqui terminou lá sem ser por nós (operador e recebimento marcam antes): depois do
 * "Cheguei", foi o motorista com o código de chegada; antes, o próprio rastreador.
 */
export const quemEncerrou = (status: string): FinalizadaPor =>
  status === 'chegou' ? 'motorista' : 'rastreador'

/**
 * O LOT do iERP antigo de um lote de fora — é com ele que o motorista abre a viagem no rastreador.
 * Vem no PAINEL (`lote` = `reteck_lote` no Gerenciamento e no MSDC); o `lote` da ORDEM é outra
 * coisa (o batch da Ericsson/Nokia, o PO da Microsoft). Só vale código "LOT-…".
 */
export function codigoDoIerpAntigo(externoDados: string | null): string | null {
  if (!externoDados) return null
  try {
    const g = JSON.parse(externoDados) as Guardado
    const doPainel = typeof g.painel?.lote === 'string' ? g.painel.lote.trim() : ''
    return /^LOT-\S+$/i.test(doPainel) ? doPainel.toUpperCase() : null
  } catch {
    return null
  }
}

/** Link do motorista: o app do rastreador já preenchido (o CPF ele digita — não vai no link). */
export function linkDoMotorista(
  base: string,
  d: { codigo: string; cliente: string; motorista: string | null; placa: string | null },
) {
  const qs = new URLSearchParams()
  qs.set('os', d.codigo)
  qs.set('client', d.cliente || 'Re-Teck')
  if (d.motorista) qs.set('driver', d.motorista)
  if (d.placa) qs.set('plate', d.placa)
  return `${baseDoRastreador(base)}/app/?${qs.toString()}`
}

/* ------------------------------------------------------------ serviço */

const PLACA_VALIDA = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/
export const caminhaoSchema = z.object({
  motoristaId: z
    .string()
    .trim()
    .max(60)
    .nullish()
    .transform((v) => v || null),
  placa: z
    .string()
    .nullish()
    .transform((v) => placaLimpa(v) || null)
    .refine((v) => v === null || PLACA_VALIDA.test(v), 'Placa inválida.'),
})

interface ConfigCompleta {
  id: string
  nome: string
  url: string
  chave: string
  ca: string | null
  chaveTransito: string | null
}

/** Viagem de um lote de fora (só na memória — quem cuida dela é o iERP antigo). */
interface DeFora {
  tripId: number
  ordemId: string
  origem: string
  codigo: string
  resumo: ResumoRastreador
  emergencia: EmergenciaViagem | null
  vistaEm: number
}

const linhaDaViagem = (db: Conexao) =>
  db
    .selectFrom('ordensViagens as v')
    .innerJoin('ordensLista as o', 'o.id', 'v.ordemId')
    .leftJoin('clientesSites as s', 's.id', 'o.siteId')
    .leftJoin('motoristas as m', 'm.id', 'v.motoristaId')
    .leftJoin('rastreadores as r', 'r.id', 'v.rastreadorId')
    .selectAll('v')
    .select([
      'm.nome as motoristaEscalado',
      'r.deviceId as rastreadorAparelho',
      'o.codigo as loteCodigo',
      'o.clienteNome',
      'o.siteCodigo',
      's.endereco as siteEndereco',
      's.latitude as siteLatitude',
      's.longitude as siteLongitude',
      'o.dataColeta',
      'o.coletaPrevista',
      'o.status as ordemStatus',
    ])

type LinhaViagem = Awaited<ReturnType<ReturnType<typeof linhaDaViagem>['execute']>>[number]

const ESPERA_DE_FORA_MS = 5 * 60_000

export function criarServicoViagens(db: Db, opcoes: { fetch?: Fetch } = {}) {
  const fazerFetch = opcoes.fetch ?? fetch
  const deFora = new Map<number, DeFora>()
  let ultimoErro: string | null = null
  let ultimaLeituraDeFora = 0

  async function config(): Promise<ConfigCompleta | null> {
    const i = await db
      .selectFrom('integracoes')
      .selectAll()
      .where('sistema', '=', 'RASTREADOR')
      .where('status', '=', 'ativo')
      .executeTakeFirst()
    if (!i?.urlPainel || !i.tokenPainel) return null
    return {
      id: i.id,
      nome: i.nome,
      url: i.urlPainel,
      chave: i.tokenPainel,
      ca: i.caPainel,
      chaveTransito: i.chaveTransito,
    }
  }

  async function cliente(): Promise<{ cfg: ConfigCompleta; api: ClienteRastreador }> {
    const cfg = await config()
    if (!cfg)
      throw new ErroApi(
        409,
        'tracker_not_configured',
        'O rastreador de GPS não está cadastrado em Administração › Integração.',
      )
    return { cfg, api: clienteDoRastreador(cfg, fazerFetch) }
  }

  const paraViagem = (l: LinhaViagem, base: string | null): Viagem => ({
    id: l.id,
    ordemId: l.ordemId,
    numero: l.numero,
    origemGps: l.origem as OrigemGps,
    rastreadorId: l.rastreadorId,
    rastreadorAparelho: l.rastreadorAparelho,
    loteCodigo: l.loteCodigo,
    origem: 'IERP',
    somenteLeitura: false,
    codigoRastreio: l.loteCodigo,
    clienteNome: l.clienteNome,
    siteCodigo: l.siteCodigo,
    siteEndereco: l.siteEndereco,
    siteLatitude: l.siteLatitude,
    siteLongitude: l.siteLongitude,
    dataColeta: l.dataColeta ?? l.coletaPrevista,
    coletaConfirmada: l.dataColeta !== null,
    motoristaNome: l.motoristaNome ?? l.motoristaEscalado,
    placa: l.placa ?? l.placaInformada,
    status: l.status as StatusViagem,
    // O código de chegada é do app do motorista (o aparelho do caminhão não tem "Cheguei").
    codigoChegada: l.origem === 'celular' ? l.codigoChegada : null,
    linkMotorista:
      base && l.origem === 'celular' && ABERTAS.includes(l.status as StatusViagem)
        ? linkDoMotorista(base, {
            codigo: l.loteCodigo,
            cliente: l.clienteNome,
            motorista: l.motoristaEscalado,
            placa: l.placaInformada,
          })
        : null,
    tripId: l.tripId,
    iniciadaEm: l.iniciadaEm,
    chegouEm: l.chegouEm,
    terminadaEm: l.terminadaEm,
    finalizadaPor: l.finalizadaPor as FinalizadaPor | null,
    posicao:
      l.ultimaLatitude !== null && l.ultimaLongitude !== null && l.ultimaEm
        ? {
            latitude: l.ultimaLatitude,
            longitude: l.ultimaLongitude,
            velocidade: l.ultimaVelocidade,
            em: l.ultimaEm,
          }
        : null,
    totalPontos: l.totalPontos,
    distanciaMetros: l.distanciaMetros,
    emergencia: l.emergenciaEm
      ? {
          tipo: l.emergenciaTipo,
          em: l.emergenciaEm,
          latitude: l.emergenciaLatitude,
          longitude: l.emergenciaLongitude,
          cienteEm: l.emergenciaCienteEm,
          cientePor: l.emergenciaCientePor,
        }
      : null,
  })

  /** A viagem de um lote de fora, montada com o lote daqui. */
  async function paraViagemDeFora(f: DeFora): Promise<Viagem | null> {
    const o = await db
      .selectFrom('ordensLista as o')
      .leftJoin('clientesSites as s', 's.id', 'o.siteId')
      .select([
        'o.id',
        'o.codigo',
        'o.clienteNome',
        'o.siteCodigo',
        's.endereco',
        's.latitude',
        's.longitude',
        'o.dataColeta',
        'o.coletaPrevista',
      ])
      .where('o.id', '=', f.ordemId)
      .executeTakeFirst()
    if (!o) return null
    const r = f.resumo
    const status = statusDoRastreador(r.status) ?? 'em_rota'
    return {
      id: `${PREFIXO_DE_FORA}${f.tripId}`,
      ordemId: o.id,
      numero: 1,
      origemGps: 'celular',
      rastreadorId: null,
      rastreadorAparelho: null,
      loteCodigo: o.codigo,
      origem: f.origem,
      somenteLeitura: true,
      codigoRastreio: f.codigo,
      clienteNome: o.clienteNome,
      siteCodigo: o.siteCodigo,
      siteEndereco: o.endereco,
      siteLatitude: o.latitude,
      siteLongitude: o.longitude,
      dataColeta: o.dataColeta ?? o.coletaPrevista,
      coletaConfirmada: o.dataColeta !== null,
      motoristaNome: r.driverName || null,
      placa: r.plate || null,
      status,
      codigoChegada: null,
      linkMotorista: null,
      tripId: f.tripId,
      iniciadaEm: r.startedAt || null,
      chegouEm: null,
      terminadaEm: r.endedAt,
      finalizadaPor: status === 'finalizada' ? 'rastreador' : null,
      posicao: r.lastPoint
        ? {
            latitude: r.lastPoint.latitude,
            longitude: r.lastPoint.longitude,
            velocidade: r.lastPoint.speedMps ?? null,
            em: r.lastPoint.recordedAt,
          }
        : null,
      totalPontos: r.pointCount,
      distanciaMetros: null,
      emergencia: f.emergencia,
    }
  }

  /* -------------------------------------------------- uma coisa de cada vez por viagem */

  /*
   * O mesmo acontecimento chega por dois caminhos (o evento ao vivo e a conferência de minuto), e
   * o operador ou o recebimento podem agir ao mesmo tempo. Tudo o que muda uma viagem passa por
   * esta fila (uma por viagem; o servidor é um processo só) e RELÊ a viagem antes de mudar — nunca
   * age sobre uma leitura velha (revisão de 20/10/2026).
   */
  const filas = new Map<string, Promise<void>>()
  function umDeCadaVez<T>(viagemId: string, f: () => Promise<T>): Promise<T> {
    const anterior = filas.get(viagemId) ?? Promise.resolve()
    const vez = anterior.then(f, f)
    const cauda = vez.then(
      () => undefined,
      () => undefined,
    )
    filas.set(viagemId, cauda)
    void cauda.then(() => {
      if (filas.get(viagemId) === cauda) filas.delete(viagemId)
    })
    return vez
  }

  const lerViagem = (id: string) =>
    db
      .selectFrom('ordensViagens as v')
      .innerJoin('ordens as o', 'o.id', 'v.ordemId')
      .selectAll('v')
      .select('o.codigo')
      .where('v.id', '=', id)
      .executeTakeFirst()

  /** Emergências de viagens que ainda não foram amarradas (o evento chegou antes). */
  const emergenciasPendentes = new Map<number, EmergenciaViagem>()

  /* -------------------------------------------------- nascimento (agendamento e edição) */

  /**
   * Agendou (ou editou) o lote. Rastreio ligado: um caminhão = uma viagem (22/10/2026: "vários
   * caminhões podem ir fazer essa viagem ao mesmo tempo"). A lista vale pela ordem: o caminhão N
   * esperando o motorista ganha o motorista e a placa da posição N; posições novas viram viagens
   * novas; as que sobram e ainda esperam são canceladas. Viagem que já saiu (ou terminou) fica
   * como está — ela termina pelo código, pelo botão Finalizar. Desligado: cancela as que esperam.
   */
  async function aoMudarRastreio(
    trx: Conexao,
    ordemId: string,
    caminhoes: Caminhao[] | null,
    autor: string,
    agora: string,
  ) {
    const todas = await trx
      .selectFrom('ordensViagens')
      .selectAll()
      .where('ordemId', '=', ordemId)
      .orderBy('numero')
      .orderBy('criadoEm')
      .execute()
    // Um caminhão pode ter mais de um rastreador (28/10/2026): o mesmo número = o mesmo caminhão.
    const grupos = new Map<number, OrdensViagensTable[]>()
    for (const v of todas.filter((x) => x.status !== 'cancelada'))
      grupos.set(v.numero, [...(grupos.get(v.numero) ?? []), v])
    const vivos = [...grupos.values()]
    const lista = caminhoes ?? []
    // Saiu ou terminou: não se desliga nem se tira pela edição.
    const naoMexe = (g: OrdensViagensTable[]) => g.some((v) => v.status !== 'aguardando_motorista')
    if (
      vivos
        .slice(lista.length)
        .some((g) => g.some((v) => v.status === 'em_rota' || v.status === 'chegou'))
    )
      throw new ErroApi(
        409,
        'trip_in_progress',
        'Um caminhão deste lote já saiu: finalize a viagem dele em Ordens › Viagens antes de tirá-lo.',
      )
    let proximo = Math.max(0, ...todas.map((v) => v.numero)) + 1
    for (const [i, c] of lista.entries()) {
      const g = vivos[i]
      if (!g) {
        await trx
          .insertInto('ordensViagens')
          .values(novaViagem(ordemId, agora, proximo++, c))
          .execute()
        continue
      }
      if (naoMexe(g)) continue
      for (const v of g)
        if (v.motoristaId !== c.motoristaId || v.placaInformada !== c.placa)
          await trx
            .updateTable('ordensViagens')
            .set({ motoristaId: c.motoristaId, placaInformada: c.placa, alteradoEm: agora })
            .where('id', '=', v.id)
            .execute()
    }
    for (const g of vivos.slice(lista.length)) {
      let cancelou = false
      for (const v of g) {
        if (v.status !== 'aguardando_motorista') continue
        const r = await trx
          .updateTable('ordensViagens')
          .set({ status: 'cancelada', terminadaEm: agora, alteradoEm: agora })
          .where('id', '=', v.id)
          .where('status', '=', 'aguardando_motorista')
          .executeTakeFirst()
        if (Number(r.numUpdatedRows)) cancelou = true
      }
      if (cancelou)
        await registrarHistorico(trx, 'ordem', ordemId, {
          autor,
          em: agora,
          acao: 'viagem_cancelada',
          mudancas: [{ campo: 'caminhao', antes: null, depois: g[0]!.numero }],
        })
    }
  }

  /** O rastreador que vai num caminhão: o aparelho de GPS (null = o celular do motorista). */
  const rastreadorSchema = z.object({
    rastreadorId: z
      .string()
      .nullish()
      .transform((v) => v || null),
  })

  /**
   * "Adicionar caminhão" no lote — e "Nova viagem" em Ordens › Viagens (28/10/2026), que é o
   * mesmo com o lote escolhido lá: mais um caminhão (um card), com motorista e placa próprios e o
   * rastreador (celular do motorista ou aparelho de GPS, que começa a viagem na hora).
   */
  async function adicionarCaminhao(ordemId: string, corpo: unknown, autor: string) {
    const c = caminhaoSchema.parse(corpo)
    const { rastreadorId } = rastreadorSchema.parse(corpo ?? {})
    const o = await db
      .selectFrom('ordens')
      .select(['id', 'status', 'externoSistema'])
      .where('id', '=', ordemId)
      .executeTakeFirst()
    if (!o) throw naoEncontrado('Lote não encontrado.')
    if (o.externoSistema)
      throw new ErroApi(409, 'external_lot', 'Este lote é de outro sistema: o rastreio é de lá.')
    if (o.status !== 'agendado')
      throw new ErroApi(409, 'invalid_transition', 'Só se adiciona caminhão a lote agendado.')
    // A mesma placa é o mesmo caminhão (28/10/2026): mais um rastreador vai no card dele.
    if (c.placa) {
      const mesmo = await db
        .selectFrom('ordensViagens')
        .select(['numero', 'placaInformada'])
        .where('ordemId', '=', ordemId)
        .where('status', 'in', ABERTAS)
        .execute()
      if (mesmo.some((v) => placaLimpa(v.placaInformada) === c.placa))
        throw new ErroApi(
          409,
          'truck_already_in_lot',
          `O caminhão ${c.placa} já está neste lote: para mais um rastreador nele, use "Adicionar rastreador" no card dele.`,
        )
    }
    if (c.motoristaId) {
      const m = await db
        .selectFrom('motoristas')
        .select('id')
        .where('id', '=', c.motoristaId)
        .executeTakeFirst()
      if (!m) throw new ErroApi(422, 'validation', 'Motorista não encontrado.')
    }
    const agora = new Date().toISOString()
    const id = await db.transaction().execute(async (trx) => {
      const r = await trx
        .selectFrom('ordensViagens')
        .select((eb) => eb.fn.max('numero').as('n'))
        .where('ordemId', '=', ordemId)
        .executeTakeFirst()
      const nova = novaViagem(ordemId, agora, Number(r?.n ?? 0) + 1, c)
      await trx.insertInto('ordensViagens').values(nova).execute()
      // O lote passa a ser rastreado (é o que o caminhão novo pede).
      await trx
        .updateTable('ordens')
        .set({ rastrear: 1, alteradoEm: agora, alteradoPor: autor })
        .where('id', '=', ordemId)
        .execute()
      await registrarHistorico(trx, 'ordem', ordemId, {
        autor,
        em: agora,
        acao: 'viagem_adicionada',
        mudancas: [
          { campo: 'caminhao', antes: null, depois: nova.numero },
          ...(c.placa ? [{ campo: 'placa', antes: null, depois: c.placa }] : []),
        ],
      })
      return nova.id
    })
    if (rastreadorId) return usarRastreador(id, { rastreadorId }, autor)
    return obter(id)
  }

  /**
   * "Adicionar rastreador" no card do caminhão (pedido do usuário, 28/10/2026: "ter a opção de
   * adicionar um ou mais rastreadores/rastreios de celular no mesmo caminhão"). Cada rastreador é
   * uma viagem no rastreador de GPS, mas é o MESMO caminhão: mesmo lote, mesmo número (o card é um
   * só), mesmo motorista, placa e código de chegada. Celular: o motorista abre o mesmo link (a
   * placa amarra a viagem); aparelho de GPS: começa na hora.
   */
  async function adicionarRastreio(viagemId: string, corpo: unknown, autor: string) {
    const { rastreadorId } = rastreadorSchema.parse(corpo ?? {})
    const base = await lerViagem(viagemId)
    if (!base) throw naoEncontrado('Viagem não encontrada.')
    const o = await db
      .selectFrom('ordens')
      .select(['status', 'externoSistema'])
      .where('id', '=', base.ordemId)
      .executeTakeFirstOrThrow()
    if (o.externoSistema)
      throw new ErroApi(409, 'external_lot', 'Este lote é de outro sistema: o rastreio é de lá.')
    if (o.status !== 'agendado' || !ABERTAS.includes(base.status as StatusViagem))
      throw new ErroApi(
        409,
        'trip_not_open',
        'Este caminhão já terminou a viagem: o rastreador entra só enquanto ela está aberta.',
      )
    if (rastreadorId) {
      const repetido = await db
        .selectFrom('ordensViagens')
        .select('id')
        .where('ordemId', '=', base.ordemId)
        .where('numero', '=', base.numero)
        .where('rastreadorId', '=', rastreadorId)
        .where('status', 'in', ABERTAS)
        .executeTakeFirst()
      if (repetido)
        throw new ErroApi(
          409,
          'tracker_already_on_truck',
          'Este rastreador já está neste caminhão.',
        )
    }
    const agora = new Date().toISOString()
    const nova: OrdensViagensTable = {
      ...novaViagem(base.ordemId, agora, base.numero, {
        motoristaId: base.motoristaId,
        placa: base.placaInformada,
      }),
      codigoChegada: base.codigoChegada,
    }
    await db.transaction().execute(async (trx) => {
      await trx.insertInto('ordensViagens').values(nova).execute()
      await registrarHistorico(trx, 'ordem', base.ordemId, {
        autor,
        em: agora,
        acao: 'rastreador_adicionado',
        mudancas: [{ campo: 'caminhao', antes: null, depois: base.numero }],
      })
    })
    if (rastreadorId) return usarRastreador(nova.id, { rastreadorId }, autor)
    return obter(nova.id)
  }

  /**
   * Antes de desligar o rastreio na edição: o motorista pode ter saído há segundos (a
   * conferência ainda não viu). Pergunta ao rastreador; achou, amarra — e a edição recusa.
   * Rastreador fora do ar não segura a edição.
   */
  async function antesDeDesligar(ordemId: string) {
    const esperando = await db
      .selectFrom('ordensViagens')
      .select('id')
      .where('ordemId', '=', ordemId)
      .where('status', '=', 'aguardando_motorista')
      .where('origem', '=', 'celular')
      .execute()
    if (!esperando.length) return
    const cfg = await config()
    if (!cfg) return
    const api = clienteDoRastreador(cfg, fazerFetch)
    for (const v of esperando)
      await umDeCadaVez(v.id, () => conferirUma(v.id, cfg, api)).catch((e: unknown) =>
        console.error('[viagens] conferir antes de desligar:', e),
      )
  }

  const novaViagem = (
    ordemId: string,
    agora: string,
    numero: number,
    c: Caminhao,
  ): OrdensViagensTable => ({
    id: randomUUID(),
    ordemId,
    numero,
    motoristaId: c.motoristaId,
    placaInformada: c.placa,
    origem: 'celular',
    rastreadorId: null,
    codigoChegada: gerarCodigoChegada(),
    status: 'aguardando_motorista',
    tripId: null,
    codigoRegistrado: 0,
    encerrarNoRastreador: 0,
    finalizadaPor: null,
    motoristaNome: null,
    placa: null,
    iniciadaEm: null,
    chegouEm: null,
    terminadaEm: null,
    ultimaLatitude: null,
    ultimaLongitude: null,
    ultimaVelocidade: null,
    ultimaEm: null,
    totalPontos: 0,
    distanciaMetros: null,
    emergenciaTipo: null,
    emergenciaEm: null,
    emergenciaLatitude: null,
    emergenciaLongitude: null,
    emergenciaCienteEm: null,
    emergenciaCientePor: null,
    chat: null,
    paradas: null,
    arquivada: 0,
    criadoEm: agora,
    alteradoEm: agora,
  })

  /**
   * Lote agendado com rastreio e sem viagem (criado antes desta tela): ganha a dele. Lote JUNTADO
   * a outro não: os caminhões dele passaram para o principal (28/10/2026 — sem isso, cada
   * conferência criava um caminhão novo que o reagrupar levava para o principal, sem fim).
   */
  async function garantirViagens() {
    const sem = await db
      .selectFrom('ordens as o')
      .leftJoin('ordensViagens as v', 'v.ordemId', 'o.id')
      .select(['o.id', 'o.criadoEm', 'o.motoristaId', 'o.placa'])
      .where('o.rastrear', '=', 1)
      .where('o.status', '=', 'agendado')
      .where('o.externoSistema', 'is', null)
      .where('o.juntadoA', 'is', null)
      .where('v.id', 'is', null)
      .execute()
    for (const o of sem)
      await db
        .insertInto('ordensViagens')
        .values(novaViagem(o.id, o.criadoEm, 1, { motoristaId: o.motoristaId, placa: o.placa }))
        .execute()
  }

  /* -------------------------------------------------- amarração com o rastreador */

  /** Evento da viagem no histórico do lote (os valores são códigos: a tela traduz). */
  async function historico(
    ordemId: string,
    autor: string,
    acao: EventoHistorico['acao'],
    mudancas: Mudanca[] = [],
  ) {
    await registrarHistorico(db, 'ordem', ordemId, {
      autor,
      em: new Date().toISOString(),
      acao,
      ...(mudancas.length ? { mudancas } : {}),
    })
  }
  const porQuem = (quem: FinalizadaPor): Mudanca[] => [
    { campo: 'finalizadaPor', antes: null, depois: quem },
  ]

  /** Grava a emergência na viagem (e no histórico do lote). */
  async function gravarEmergencia(
    v: { id: string; ordemId: string },
    e: EmergenciaViagem,
    autor: string,
  ) {
    await db
      .updateTable('ordensViagens')
      .set({
        emergenciaTipo: e.tipo,
        emergenciaEm: e.em,
        emergenciaLatitude: e.latitude,
        emergenciaLongitude: e.longitude,
        emergenciaCienteEm: null,
        emergenciaCientePor: null,
        alteradoEm: new Date().toISOString(),
      })
      .where('id', '=', v.id)
      .execute()
    await historico(
      v.ordemId,
      autor,
      'viagem_emergencia',
      e.tipo ? [{ campo: 'emergencia', antes: null, depois: e.tipo }] : [],
    )
  }

  /**
   * Aplica o que o rastreador diz da viagem do lote. Chamada SEMPRE dentro de `umDeCadaVez` e com
   * a viagem recém-lida. Só grava o que mudou; nunca volta uma viagem encerrada aqui
   * (recebimento/operador) para "na rua".
   */
  async function aplicar(
    v: OrdensViagensTable,
    r: ResumoRastreador,
    cfg: ConfigCompleta,
    api: ClienteRastreador,
  ) {
    const status = statusDoRastreador(r.status)
    if (!status) return
    const agora = new Date().toISOString()
    const mudar: Partial<OrdensViagensTable> = {}
    if (v.tripId !== r.tripId) mudar.tripId = r.tripId
    if (r.driverName && v.motoristaNome !== r.driverName) mudar.motoristaNome = r.driverName
    if (r.plate && v.placa !== r.plate) mudar.placa = r.plate
    if (!v.iniciadaEm && r.startedAt) mudar.iniciadaEm = r.startedAt
    // Só posição MAIS NOVA (a fila offline do app manda lotes atrasados).
    if (r.lastPoint && (!v.ultimaEm || r.lastPoint.recordedAt > v.ultimaEm)) {
      mudar.ultimaLatitude = r.lastPoint.latitude
      mudar.ultimaLongitude = r.lastPoint.longitude
      mudar.ultimaVelocidade = r.lastPoint.speedMps ?? null
      mudar.ultimaEm = r.lastPoint.recordedAt
    }
    if (r.pointCount > v.totalPontos) mudar.totalPontos = r.pointCount
    const aindaAberta = ABERTAS.includes(v.status as StatusViagem)
    if (aindaAberta && status !== v.status && status !== 'finalizada') {
      mudar.status = status
      if (status === 'chegou' && !v.chegouEm) mudar.chegouEm = agora
    }
    let mudou = false
    if (Object.keys(mudar).length) {
      const res = await db
        .updateTable('ordensViagens')
        .set({ ...mudar, alteradoEm: agora })
        .where('id', '=', v.id)
        .where('status', '=', v.status)
        .executeTakeFirst()
      mudou = Number(res.numUpdatedRows) > 0
      if (!mudou) return // alguém mudou a viagem no meio (edição do lote): a próxima vez confere.
    }

    if (
      mudou &&
      aindaAberta &&
      v.status === 'aguardando_motorista' &&
      status !== 'aguardando_motorista'
    )
      await historico(
        v.ordemId,
        cfg.nome,
        'viagem_iniciada',
        [
          { campo: 'motorista', antes: null, depois: r.driverName || null },
          { campo: 'placa', antes: null, depois: r.plate || null },
        ].filter((m) => m.depois),
      )
    if (mudou && aindaAberta && mudar.status === 'chegou')
      await historico(v.ordemId, cfg.nome, 'viagem_chegou')

    // A emergência que chegou antes de a viagem ser amarrada.
    const pendente = emergenciasPendentes.get(r.tripId)
    if (pendente) {
      emergenciasPendentes.delete(r.tripId)
      await gravarEmergencia(v, pendente, cfg.nome)
    }

    // O código de chegada vai para o rastreador assim que a viagem existe lá — UMA vez (gravar
    // de novo zeraria lá o limite de 5 tentativas).
    if (!v.codigoRegistrado && status !== 'finalizada' && aindaAberta) {
      try {
        await api.registrarCodigo(r.tripId, v.codigoChegada)
        await db
          .updateTable('ordensViagens')
          .set({ codigoRegistrado: 1 })
          .where('id', '=', v.id)
          .execute()
      } catch (e) {
        console.error(`[viagens] código de chegada da viagem ${r.tripId}:`, e)
      }
    }

    if (status === 'finalizada' && (aindaAberta || !v.arquivada))
      await arquivar(v.id, r.tripId, aindaAberta ? quemEncerrou(v.status) : null, cfg, api)
  }

  /**
   * A viagem terminou: guarda o trajeto (sem duplicados), as paradas e a conversa, e marca
   * finalizada. `por` = null mantém quem já encerrou (recebimento/operador). Chamada dentro de
   * `umDeCadaVez`. Viagem que sumiu do rastreador (404) é arquivada sem trajeto.
   */
  async function arquivar(
    viagemId: string,
    tripId: number,
    por: FinalizadaPor | null,
    cfg: ConfigCompleta,
    api: ClienteRastreador,
  ) {
    const atual = await db
      .selectFrom('ordensViagens')
      .selectAll()
      .where('id', '=', viagemId)
      .executeTakeFirst()
    if (!atual || atual.arquivada) return
    let detalhe: Awaited<ReturnType<ClienteRastreador['detalhe']>> | null = null
    try {
      detalhe = await api.detalhe(tripId)
    } catch (e) {
      if (!ehNaoEncontrado(e)) throw e
    }
    const [paradas, chat] = detalhe
      ? await Promise.all([
          api.paradas(tripId).catch(() => [] as ParadaRastreador[]),
          api.chat(tripId).catch(() => [] as MensagemRastreador[]),
        ])
      : [[] as ParadaRastreador[], [] as MensagemRastreador[]]
    const trajeto = trajetoDe(detalhe?.points ?? [])
    const ultimo = trajeto.at(-1)
    const agora = new Date().toISOString()
    const eraAberta = ABERTAS.includes(atual.status as StatusViagem)
    await db.transaction().execute(async (trx) => {
      await trx.deleteFrom('ordensViagensPontos').where('viagemId', '=', viagemId).execute()
      for (let i = 0; i < trajeto.length; i += 500)
        await trx
          .insertInto('ordensViagensPontos')
          .values(
            trajeto.slice(i, i + 500).map((p, j) => ({
              viagemId,
              seq: i + j,
              latitude: p.latitude,
              longitude: p.longitude,
              velocidade: p.velocidade,
              precisao: p.precisao,
              registradoEm: p.em,
            })),
          )
          .execute()
      await trx
        .updateTable('ordensViagens')
        .set({
          status: 'finalizada',
          tripId,
          arquivada: 1,
          encerrarNoRastreador: 0,
          finalizadaPor: atual.finalizadaPor ?? por ?? 'rastreador',
          motoristaNome: detalhe?.driverName || atual.motoristaNome,
          placa: detalhe?.plate || atual.placa,
          iniciadaEm: atual.iniciadaEm ?? (detalhe?.startedAt || null),
          terminadaEm: atual.terminadaEm ?? detalhe?.endedAt ?? agora,
          totalPontos: trajeto.length || atual.totalPontos,
          distanciaMetros: trajeto.length ? distanciaDoTrajeto(trajeto) : atual.distanciaMetros,
          ...(ultimo
            ? {
                ultimaLatitude: ultimo.latitude,
                ultimaLongitude: ultimo.longitude,
                ultimaVelocidade: ultimo.velocidade,
                ultimaEm: ultimo.em,
              }
            : {}),
          paradas: JSON.stringify(paradas.map(paraParada)),
          chat: JSON.stringify(chat.map(paraMensagem)),
          alteradoEm: agora,
        })
        .where('id', '=', viagemId)
        .where('arquivada', '=', 0)
        .execute()
    })
    if (eraAberta)
      await historico(atual.ordemId, cfg.nome, 'viagem_finalizada', porQuem(por ?? 'rastreador'))
  }

  /**
   * Encerrada AQUI (recebimento ou operador) e o rastreador ainda não soube — ou o recebimento
   * cancelou uma viagem que esperava o motorista: confere se ele saiu nesse meio-tempo. Chamada
   * dentro de `umDeCadaVez`.
   */
  async function encerrarPendente(
    v: OrdensViagensTable,
    codigo: string,
    cfg: ConfigCompleta,
    api: ClienteRastreador,
  ) {
    let tripId = v.tripId
    if (tripId === null) {
      const t = escolherViagem(v, await api.viagensDoLote(codigo))
      if (!t || statusDoRastreador(t.status) === null) {
        await db
          .updateTable('ordensViagens')
          .set({ encerrarNoRastreador: 0 })
          .where('id', '=', v.id)
          .execute()
        return
      }
      tripId = t.tripId
      // O motorista tinha saído: a viagem que parecia cancelada termina pelo recebimento.
      const agora = new Date().toISOString()
      await db
        .updateTable('ordensViagens')
        .set({
          tripId,
          status: 'finalizada',
          motoristaNome: t.driverName || v.motoristaNome,
          placa: t.plate || v.placa,
          iniciadaEm: t.startedAt || v.iniciadaEm,
          alteradoEm: agora,
        })
        .where('id', '=', v.id)
        .execute()
      if (v.status === 'cancelada')
        await historico(v.ordemId, cfg.nome, 'viagem_finalizada', porQuem('recebimento'))
    }
    await api.encerrar(tripId).catch((e: unknown) => {
      // 409 = já terminou lá; 404 = sumiu de lá.
      if (!ehConflito(e) && !ehNaoEncontrado(e)) throw e
    })
    await db
      .updateTable('ordensViagens')
      .set({ encerrarNoRastreador: 0 })
      .where('id', '=', v.id)
      .execute()
    await arquivar(v.id, tripId, null, cfg, api)
  }

  /**
   * Vários caminhões no mesmo lote (22/10/2026): as viagens do rastreador já amarradas a OUTRO
   * caminhão do lote ficam de fora; sem amarração ainda, vale a da placa deste caminhão (o link
   * do motorista leva a placa) e, sem placa, qualquer uma livre.
   */
  async function livresPara(
    v: Pick<OrdensViagensTable, 'id' | 'ordemId' | 'tripId' | 'placaInformada'>,
    lista: ResumoRastreador[],
  ) {
    if (v.tripId !== null) return lista
    const outras = await db
      .selectFrom('ordensViagens')
      .select(['tripId', 'placaInformada'])
      .where('ordemId', '=', v.ordemId)
      .where('id', '<>', v.id)
      .where('status', '<>', 'cancelada')
      .execute()
    const presas = new Set(outras.map((o) => o.tripId).filter((t) => t !== null))
    const livres = lista.filter((t) => !presas.has(t.tripId))
    const minha = placaLimpa(v.placaInformada)
    if (minha) {
      const mesma = livres.filter((t) => placaLimpa(t.plate) === minha)
      if (mesma.length) return mesma
      // Placa de outro caminhão do lote não serve para este.
      const deOutros = new Set(outras.map((o) => placaLimpa(o.placaInformada)).filter(Boolean))
      return livres.filter((t) => !deOutros.has(placaLimpa(t.plate)) && !placaLimpa(t.plate))
    }
    const deOutros = new Set(outras.map((o) => placaLimpa(o.placaInformada)).filter(Boolean))
    return livres.filter((t) => !deOutros.has(placaLimpa(t.plate)))
  }

  /** Confere UMA viagem com o rastreador (dentro de `umDeCadaVez`, relendo-a). */
  async function conferirUma(viagemId: string, cfg: ConfigCompleta, api: ClienteRastreador) {
    const linha = await lerViagem(viagemId)
    if (!linha) return
    const { codigo, ...v } = linha
    if (v.encerrarNoRastreador) return encerrarPendente(v, codigo, cfg, api)
    if (ABERTAS.includes(v.status as StatusViagem)) {
      const escolhida = escolherViagem(v, await livresPara(v, await api.viagensDoLote(codigo)))
      if (escolhida) await aplicar(v, escolhida, cfg, api)
      return
    }
    if (v.status === 'finalizada' && !v.arquivada && v.tripId !== null)
      await arquivar(v.id, v.tripId, null, cfg, api)
  }

  /** Confere com o rastreador as viagens daqui que ainda não terminaram. */
  async function conferirDaqui(cfg: ConfigCompleta, api: ClienteRastreador) {
    const pendentes = await db
      .selectFrom('ordensViagens')
      .select('id')
      .where('origem', '=', 'celular')
      .where((eb) =>
        eb.or([
          eb('status', 'in', ['aguardando_motorista', 'em_rota', 'chegou']),
          eb('encerrarNoRastreador', '=', 1),
          eb.and([eb('status', '=', 'finalizada'), eb('arquivada', '=', 0)]),
        ]),
      )
      .execute()
    let falhas = 0
    for (const { id } of pendentes)
      await umDeCadaVez(id, () => conferirUma(id, cfg, api)).catch((e: unknown) => {
        falhas++
        console.error(`[viagens] viagem ${id}:`, e)
      })
    return falhas
  }

  /**
   * Os lotes de fora (Gerenciamento, MSDC) que estão para sair ou na rua: procura no rastreador
   * pelo LOT do iERP antigo (é com ele que o motorista abre a viagem) — só para ver.
   */
  async function conferirDeFora(api: ClienteRastreador) {
    const hoje = diaNoFuso()
    const de = new Date(Date.parse(`${hoje}T12:00:00Z`) - 15 * 86_400_000).toISOString()
    const ate = new Date(Date.parse(`${hoje}T12:00:00Z`) + 15 * 86_400_000).toISOString()
    const lotes = await db
      .selectFrom('ordens')
      .select(['id', 'externoSistema', 'externoDados', 'dataColeta', 'coletaPrevista'])
      .where('externoSistema', 'is not', null)
      .where('status', '=', 'agendado')
      .execute()
    const candidatos = lotes.flatMap((l) => {
      const dia = l.dataColeta ?? l.coletaPrevista
      if (dia < de || dia > ate || !l.externoDados) return []
      const codigo = codigoDoIerpAntigo(l.externoDados)
      return codigo ? [{ ordemId: l.id, origem: l.externoSistema!, codigo }] : []
    })
    const vistos = new Set<number>()
    for (let i = 0; i < candidatos.length; i += 4) {
      await Promise.all(
        candidatos.slice(i, i + 4).map(async (c) => {
          const naRua = (await api.viagensDoLote(c.codigo)).filter((t) => {
            const s = statusDoRastreador(t.status)
            return s === 'em_rota' || s === 'chegou'
          })
          for (const t of naRua) {
            vistos.add(t.tripId)
            const pendente = emergenciasPendentes.get(t.tripId)
            const antes = deFora.get(t.tripId)
            deFora.set(t.tripId, {
              tripId: t.tripId,
              ordemId: c.ordemId,
              origem: c.origem,
              codigo: c.codigo,
              resumo: t,
              emergencia: antes?.emergencia ?? emergenciasPendentes.get(t.tripId) ?? null,
              vistaEm: Date.now(),
            })
            if (pendente) emergenciasPendentes.delete(t.tripId)
          }
        }),
      )
    }
    for (const id of [...deFora.keys()]) if (!vistos.has(id)) deFora.delete(id)
    ultimaLeituraDeFora = Date.now()
  }

  /**
   * A conferência periódica (a rede para o evento perdido do SignalR — o rastreador hiberna e o
   * evento pode cair). Nunca lança: o erro fica guardado e aparece na tela de Viagens.
   */
  async function sincronizar(opcoesSinc: { forcarDeFora?: boolean } = {}) {
    await garantirViagens()
    const cfg = await config()
    if (!cfg) return { configurado: false }
    const api = clienteDoRastreador(cfg, fazerFetch)
    try {
      const falhas = await conferirDaqui(cfg, api)
      if (opcoesSinc.forcarDeFora || Date.now() - ultimaLeituraDeFora > ESPERA_DE_FORA_MS)
        await conferirDeFora(api)
      ultimoErro = falhas ? `${falhas} viagem(ns) não puderam ser conferidas.` : null
      await db
        .updateTable('integracoes')
        .set({ ultimoPainelEm: new Date().toISOString(), ultimoErro: null, ultimoErroEm: null })
        .where('id', '=', cfg.id)
        .execute()
    } catch (e) {
      ultimoErro = e instanceof Error ? e.message : String(e)
      await db
        .updateTable('integracoes')
        .set({ ultimoErro, ultimoErroEm: new Date().toISOString() })
        .where('id', '=', cfg.id)
        .execute()
        .catch(() => undefined)
    }
    return { configurado: true }
  }

  /* -------------------------------------------------- eventos ao vivo (SignalR) */

  async function viagemDoTrip(tripId: number) {
    return db
      .selectFrom('ordensViagens')
      .selectAll()
      .where('tripId', '=', tripId)
      .executeTakeFirst()
  }

  /** Conferência pedida por um evento de viagem que ainda não conhecemos (fora da fila do relógio). */
  function conferirLogo() {
    ultimaLeituraDeFora = 0
    void sincronizar().catch((e: unknown) => console.error('[viagens] conferência:', e))
  }

  const tempoReal = {
    /** TripStarted: amarra na hora (registra o código de chegada) — ou guarda, se é de fora. */
    async viagemIniciada(dados: unknown) {
      const r = lerResumo(dados)
      if (!r?.serviceOrder) return
      const abertas = await db
        .selectFrom('ordensViagens as v')
        .innerJoin('ordens as o', 'o.id', 'v.ordemId')
        .select(['v.id', 'v.tripId', 'v.placaInformada'])
        .where('o.codigo', '=', r.serviceOrder)
        .where('v.origem', '=', 'celular')
        .where('v.status', 'in', ['aguardando_motorista', 'em_rota', 'chegou'])
        .orderBy('v.numero')
        .execute()
      // Já amarrada; senão o caminhão da mesma placa; senão o primeiro sem placa e sem viagem.
      const linha =
        abertas.find((v) => v.tripId === r.tripId) ??
        abertas.find(
          (v) => v.tripId === null && placaLimpa(v.placaInformada) === placaLimpa(r.plate),
        ) ??
        abertas.find((v) => v.tripId === null && !placaLimpa(v.placaInformada))
      if (linha) {
        const { cfg, api } = await cliente()
        await umDeCadaVez(linha.id, async () => {
          const atual = await lerViagem(linha.id)
          if (!atual || !ABERTAS.includes(atual.status as StatusViagem)) return
          const { codigo: _c, ...v } = atual
          void _c
          const escolhida = escolherViagem(v, await livresPara(v, [r]))
          if (escolhida) await aplicar(v, escolhida, cfg, api)
        })
        return
      }
      // De fora? A próxima conferência dos lotes de fora acha (já pedida agora).
      ultimaLeituraDeFora = 0
    },
    async ponto(dados: unknown) {
      const tripId = Number(campo(dados, 'tripId'))
      const latitude = campo<number>(dados, 'latitude')
      const longitude = campo<number>(dados, 'longitude')
      const em = campo<string>(dados, 'recordedAt') ?? new Date().toISOString()
      if (
        !Number.isInteger(tripId) ||
        typeof latitude !== 'number' ||
        typeof longitude !== 'number'
      )
        return
      const velocidade = campo<number | null>(dados, 'speedMps') ?? null
      const f = deFora.get(tripId)
      if (f) {
        if (!f.resumo.lastPoint || em > f.resumo.lastPoint.recordedAt)
          f.resumo = {
            ...f.resumo,
            pointCount: f.resumo.pointCount + 1,
            lastPoint: { latitude, longitude, speedMps: velocidade, recordedAt: em },
          }
        return
      }
      // Só posição mais nova (a fila offline do app manda lotes atrasados).
      await db
        .updateTable('ordensViagens')
        .set((eb) => ({
          ultimaLatitude: latitude,
          ultimaLongitude: longitude,
          ultimaVelocidade: velocidade,
          ultimaEm: em,
          totalPontos: eb('totalPontos', '+', 1),
        }))
        .where('tripId', '=', tripId)
        .where('status', 'in', ['em_rota', 'chegou'])
        .where((eb) => eb.or([eb('ultimaEm', 'is', null), eb('ultimaEm', '<', em)]))
        .execute()
    },
    async aguardandoConfirmacao(dados: unknown) {
      const tripId = Number(campo(dados, 'tripId'))
      if (!Number.isInteger(tripId)) return
      const f = deFora.get(tripId)
      if (f) f.resumo = { ...f.resumo, status: 'AguardandoConfirmação' }
      const v = await viagemDoTrip(tripId)
      if (!v) {
        if (!f) conferirLogo()
        return
      }
      await umDeCadaVez(v.id, async () => {
        const agora = new Date().toISOString()
        const r = await db
          .updateTable('ordensViagens')
          .set({ status: 'chegou', chegouEm: agora, alteradoEm: agora })
          .where('id', '=', v.id)
          .where('status', 'in', ['em_rota', 'aguardando_motorista'])
          .executeTakeFirst()
        if (Number(r.numUpdatedRows)) {
          const cfg = await config()
          await historico(v.ordemId, cfg?.nome ?? 'Rastreador', 'viagem_chegou')
        }
      })
    },
    async viagemTerminada(dados: unknown) {
      const tripId = Number(campo(dados, 'tripId'))
      if (!Number.isInteger(tripId)) return
      deFora.delete(tripId)
      const v = await viagemDoTrip(tripId)
      if (!v) return
      const { cfg, api } = await cliente()
      await umDeCadaVez(v.id, async () => {
        const atual = await viagemDoTrip(tripId)
        if (!atual || atual.arquivada) return
        await arquivar(
          atual.id,
          tripId,
          ABERTAS.includes(atual.status as StatusViagem) ? quemEncerrou(atual.status) : null,
          cfg,
          api,
        )
      })
    },
    async emergencia(dados: unknown) {
      const tripId = Number(campo(dados, 'tripId'))
      if (!Number.isInteger(tripId)) return
      // "Assalto", "MECANICO", "médica"… → código sem acento, minúsculo (a tela traduz).
      const tipo = normalizar(campo<string>(dados, 'type') ?? '').trim() || null
      const e: EmergenciaViagem = {
        tipo,
        em: new Date().toISOString(),
        latitude: campo<number>(dados, 'lat') ?? null,
        longitude: campo<number>(dados, 'lon') ?? null,
        cienteEm: null,
        cientePor: null,
      }
      const f = deFora.get(tripId)
      if (f) {
        f.emergencia = e
        return
      }
      const v = await viagemDoTrip(tripId)
      if (!v) {
        // Viagem ainda não amarrada (o início se perdeu): guarda o alarme e confere agora — o
        // rastreador não devolve a emergência na lista, então ela NUNCA pode se perder aqui.
        emergenciasPendentes.set(tripId, e)
        conferirLogo()
        return
      }
      const cfg = await config()
      await umDeCadaVez(v.id, () => gravarEmergencia(v, e, cfg?.nome ?? 'Rastreador'))
    },
    /** Parada reportada ou mensagem nova: a próxima leitura vai ao rastreador (sem esperar 10 s). */
    novidade(tipo: 'parada' | 'chat') {
      return (dados: unknown) => {
        const tripId = Number(campo(dados, 'tripId'))
        if (Number.isInteger(tripId)) lidos.delete(`${tipo === 'parada' ? 'd' : 'c'}${tripId}`)
        return Promise.resolve()
      }
    },
    async emergenciaCiente(dados: unknown) {
      const tripId = Number(campo(dados, 'tripId'))
      if (!Number.isInteger(tripId)) return
      emergenciasPendentes.delete(tripId)
      const f = deFora.get(tripId)
      if (f?.emergencia && !f.emergencia.cienteEm) f.emergencia.cienteEm = new Date().toISOString()
      // Ciência dada no outro iERP: cala o alarme aqui também.
      const agora = new Date().toISOString()
      await db
        .updateTable('ordensViagens')
        .set({ emergenciaCienteEm: agora, emergenciaCientePor: 'Rastreador' })
        .where('tripId', '=', tripId)
        .where('emergenciaEm', 'is not', null)
        .where('emergenciaCienteEm', 'is', null)
        .execute()
    },
  }

  /* -------------------------------------------------- recebimento */

  /* -------------------------------------------------- leitura e ações da tela */

  const consultaSchema = z.object({
    situacao: z.enum(['abertas', 'finalizadas']).default('abertas'),
    desde: z.iso.datetime({ offset: true }).optional(),
  })

  async function listar(entrada: unknown): Promise<ViagensResposta> {
    const { situacao, desde } = consultaSchema.parse(entrada)
    const cfg = await config()
    let q = linhaDaViagem(db)
    q =
      situacao === 'abertas'
        ? q.where('v.status', 'in', ABERTAS)
        : q.where('v.status', 'in', ['finalizada', 'cancelada'])
    if (situacao === 'finalizadas' && desde)
      q = q.where('v.alteradoEm', '>=', new Date(desde).toISOString())
    const linhas = await q.orderBy('v.criadoEm', 'desc').execute()
    const viagens = linhas.map((l) => paraViagem(l, cfg?.url ?? null))
    if (situacao === 'abertas')
      for (const f of deFora.values()) {
        const v = await paraViagemDeFora(f)
        if (v) viagens.push(v)
      }
    return {
      configurado: Boolean(cfg),
      temTransito: Boolean(cfg?.chaveTransito),
      viagens,
      erro: cfg ? ultimoErro : null,
      atualizadoEm: new Date().toISOString(),
    }
  }

  async function daqui(id: string) {
    const l = await linhaDaViagem(db).where('v.id', '=', id).executeTakeFirst()
    if (!l) throw naoEncontrado('Viagem não encontrada.')
    return l
  }

  function deForaPorId(id: string) {
    const f = deFora.get(Number(id.slice(PREFIXO_DE_FORA.length)))
    if (!f) throw naoEncontrado('Viagem não encontrada.')
    return f
  }

  const paraParada = (p: ParadaRastreador): ParadaViagem => ({
    id: p.id,
    motivo: p.reason,
    latitude: p.latitude,
    longitude: p.longitude,
    fotoUrl: p.mediaUrl,
    em: p.createdAt,
  })
  const paraMensagem = (m: MensagemRastreador): MensagemViagem => ({
    id: m.id,
    remetente: m.sender === 'operador' ? 'operador' : 'motorista',
    texto: m.text,
    midiaUrl: m.mediaUrl,
    em: m.createdAt,
  })

  /*
   * O rastreador é compartilhado (o iERP antigo também lê) e o detalhe traz TODOS os pontos: a
   * leitura de uma viagem na rua vale 10 s para todas as telas abertas.
   */
  const lidos = new Map<string, { em: number; valor: Promise<unknown> }>()
  function lerGuardado<T>(chave: string, f: () => Promise<T>): Promise<T> {
    const g = lidos.get(chave)
    if (g && Date.now() - g.em < 10_000) return g.valor as Promise<T>
    const valor = f()
    lidos.set(chave, { em: Date.now(), valor })
    valor.catch(() => lidos.delete(chave))
    if (lidos.size > 200)
      for (const [k, x] of lidos) if (Date.now() - x.em >= 10_000) lidos.delete(k)
    return valor
  }
  const trajetoEParadas = (api: ClienteRastreador, tripId: number) =>
    lerGuardado(`d${tripId}`, async () => {
      const [d, paradas] = await Promise.all([api.detalhe(tripId), api.paradas(tripId)])
      return { trajeto: trajetoDe(d.points), paradas: paradas.map(paraParada) }
    })

  async function obter(id: string): Promise<ViagemDetalhe> {
    if (id.startsWith(PREFIXO_DE_FORA)) {
      const f = deForaPorId(id)
      const v = await paraViagemDeFora(f)
      if (!v) throw naoEncontrado('Viagem não encontrada.')
      const { api } = await cliente()
      try {
        return { ...v, ...(await trajetoEParadas(api, f.tripId)), rastreadorIndisponivel: false }
      } catch {
        return { ...v, trajeto: [], paradas: [], rastreadorIndisponivel: true }
      }
    }
    const l = await daqui(id)
    const cfg = await config()
    const v = paraViagem(l, cfg?.url ?? null)
    if (l.arquivada || l.origem === 'aparelho') {
      const pontos = await db
        .selectFrom('ordensViagensPontos')
        .select(['latitude', 'longitude', 'velocidade', 'precisao', 'registradoEm'])
        .where('viagemId', '=', id)
        .orderBy('seq')
        .execute()
      return {
        ...v,
        trajeto: pontos.map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
          velocidade: p.velocidade,
          precisao: p.precisao,
          em: p.registradoEm,
        })),
        paradas: l.paradas ? (JSON.parse(l.paradas) as ParadaViagem[]) : [],
        rastreadorIndisponivel: false,
      }
    }
    if (l.tripId === null || !cfg)
      return { ...v, trajeto: [], paradas: [], rastreadorIndisponivel: false }
    const api = clienteDoRastreador(cfg, fazerFetch)
    try {
      return { ...v, ...(await trajetoEParadas(api, l.tripId)), rastreadorIndisponivel: false }
    } catch {
      return { ...v, trajeto: [], paradas: [], rastreadorIndisponivel: true }
    }
  }

  async function chat(id: string): Promise<MensagemViagem[]> {
    let tripId: number | null
    if (id.startsWith(PREFIXO_DE_FORA)) tripId = deForaPorId(id).tripId
    else {
      const l = await daqui(id)
      if (l.arquivada) return l.chat ? (JSON.parse(l.chat) as MensagemViagem[]) : []
      tripId = l.tripId
    }
    if (tripId === null) return []
    const { api } = await cliente()
    const t = tripId
    return lerGuardado(`c${t}`, async () => (await api.chat(t)).map(paraMensagem))
  }

  /** Só nas viagens daqui que estão na rua. */
  async function naRua(id: string) {
    if (id.startsWith(PREFIXO_DE_FORA))
      throw new ErroApi(
        409,
        'trip_read_only',
        'Esta viagem é de um lote de outro sistema — quem cuida dela é o iERP antigo.',
      )
    const l = await daqui(id)
    if (l.tripId === null || (l.status !== 'em_rota' && l.status !== 'chegou'))
      throw new ErroApi(409, 'trip_not_active', 'A viagem não está em andamento.')
    return { l, tripId: l.tripId }
  }

  const textoSchema = z.object({
    texto: z.string().trim().min(1, 'Escreva a mensagem.').max(1000),
  })

  async function enviarChat(id: string, corpo: unknown) {
    const { texto } = textoSchema.parse(corpo)
    const { tripId } = await naRua(id)
    const { api } = await cliente()
    await api.enviarChat(tripId, texto)
    lidos.delete(`c${tripId}`)
    return chat(id)
  }

  /**
   * O operador encerra a viagem: grava AQUI primeiro (quem encerrou e o histórico — o evento
   * "terminou" que o rastreador manda logo em seguida já encontra a viagem finalizada), depois
   * avisa o rastreador e guarda o trajeto. Rastreador fora do ar: a conferência termina.
   */
  async function finalizar(id: string, autor: string) {
    const peloAparelho = id.startsWith(PREFIXO_DE_FORA) ? null : await lerViagem(id)
    if (peloAparelho?.origem === 'aparelho') return finalizarAparelho(id, autor)
    await naRua(id)
    const { cfg, api } = await cliente()
    await umDeCadaVez(id, async () => {
      const v = await lerViagem(id)
      if (!v || v.tripId === null || (v.status !== 'em_rota' && v.status !== 'chegou'))
        throw new ErroApi(409, 'trip_not_active', 'A viagem não está em andamento.')
      const agora = new Date().toISOString()
      const r = await db
        .updateTable('ordensViagens')
        .set({
          status: 'finalizada',
          finalizadaPor: 'operador',
          terminadaEm: agora,
          encerrarNoRastreador: 1,
          alteradoEm: agora,
        })
        .where('id', '=', id)
        .where('status', '=', v.status)
        .executeTakeFirst()
      if (!Number(r.numUpdatedRows))
        throw new ErroApi(409, 'trip_not_active', 'A viagem não está em andamento.')
      await historico(v.ordemId, autor, 'viagem_finalizada', porQuem('operador'))
      try {
        await conferirUma(id, cfg, api)
      } catch (e) {
        console.error(`[viagens] encerrar a viagem ${v.tripId}:`, e)
      }
    })
    return obter(id)
  }

  /**
   * O aparelho do caminhão não tem "Cheguei" nem código: a viagem termina no botão Finalizar
   * (como no 1.0). O trajeto já está aqui (a leitura do servidor de GPS grava os pontos).
   */
  async function finalizarAparelho(id: string, autor: string) {
    await umDeCadaVez(id, async () => {
      const v = await lerViagem(id)
      if (!v || (v.status !== 'em_rota' && v.status !== 'chegou'))
        throw new ErroApi(409, 'trip_not_active', 'A viagem não está em andamento.')
      const agora = new Date().toISOString()
      await db
        .updateTable('ordensViagens')
        .set({
          status: 'finalizada',
          finalizadaPor: 'operador',
          terminadaEm: agora,
          arquivada: 1,
          alteradoEm: agora,
        })
        .where('id', '=', id)
        .where('status', '=', v.status)
        .execute()
      await historico(v.ordemId, autor, 'viagem_finalizada', porQuem('operador'))
    })
    return obter(id)
  }

  /**
   * "Usar rastreador" (como no 1.0): o caminhão que ainda espera o motorista vai pelo APARELHO
   * de GPS. A viagem começa na hora; os pontos chegam pela leitura do servidor de GPS. O aparelho
   * precisa estar ativo e livre (uma viagem aberta por aparelho).
   */
  async function usarRastreador(id: string, corpo: unknown, autor: string) {
    const { rastreadorId } = z.object({ rastreadorId: z.string().min(1) }).parse(corpo)
    const r = await db
      .selectFrom('rastreadores')
      .selectAll()
      .where('id', '=', rastreadorId)
      .executeTakeFirst()
    if (!r) throw new ErroApi(422, 'validation', 'Rastreador não encontrado.')
    if (r.status !== 'ativo')
      throw new ErroApi(409, 'tracker_inactive', 'Este rastreador está inativo.')
    await umDeCadaVez(id, async () => {
      const v = await lerViagem(id)
      if (!v) throw naoEncontrado('Viagem não encontrada.')
      if (v.status !== 'aguardando_motorista' || v.tripId !== null)
        throw new ErroApi(
          409,
          'trip_in_progress',
          'Este caminhão já saiu: o rastreador só entra antes da viagem começar.',
        )
      // O mesmo aparelho em duas viagens só vale para o mesmo cliente no mesmo dia (28/10/2026: um
      // caminhão que passa em dois lotes "é só colocarmos o mesmo rastreador em ambas").
      const coleta = db.selectFrom('ordens').select(['clienteId', 'dataColeta', 'coletaPrevista'])
      const meu = await coleta.where('id', '=', v.ordemId).executeTakeFirstOrThrow()
      const dia = (o: { dataColeta: string | null; coletaPrevista: string }) =>
        diaNoFuso(new Date(o.dataColeta ?? o.coletaPrevista))
      const usos = await db
        .selectFrom('ordensViagens as x')
        .innerJoin('ordens as o', 'o.id', 'x.ordemId')
        .select(['o.codigo', 'o.clienteId', 'o.dataColeta', 'o.coletaPrevista'])
        .where('x.rastreadorId', '=', rastreadorId)
        .where('x.origem', '=', 'aparelho')
        .where('x.status', 'in', ['em_rota', 'chegou'])
        .execute()
      const ocupado = usos.find((u) => u.clienteId !== meu.clienteId || dia(u) !== dia(meu))
      if (ocupado)
        throw new ErroApi(
          409,
          'tracker_in_use',
          `Este rastreador está numa viagem aberta (${ocupado.codigo}).`,
        )
      const agora = new Date().toISOString()
      const placa = r.placa ?? v.placaInformada
      await db
        .updateTable('ordensViagens')
        .set({
          origem: 'aparelho',
          rastreadorId,
          status: 'em_rota',
          iniciadaEm: agora,
          placa,
          ...(r.ultimaLatitude !== null && r.ultimaLongitude !== null && r.ultimoPontoEm
            ? {
                ultimaLatitude: r.ultimaLatitude,
                ultimaLongitude: r.ultimaLongitude,
                ultimaVelocidade: r.ultimaVelocidade,
                ultimaEm: r.ultimoPontoEm,
              }
            : {}),
          alteradoEm: agora,
        })
        .where('id', '=', id)
        .where('status', '=', 'aguardando_motorista')
        .execute()
      await historico(v.ordemId, autor, 'viagem_iniciada', [
        { campo: 'rastreador', antes: null, depois: r.deviceId },
        ...(placa ? [{ campo: 'placa', antes: null, depois: placa }] : []),
      ])
    })
    return obter(id)
  }

  async function cienteEmergencia(id: string, autor: string) {
    if (id.startsWith(PREFIXO_DE_FORA))
      throw new ErroApi(
        409,
        'trip_read_only',
        'Esta viagem é de um lote de outro sistema — quem cuida dela é o iERP antigo.',
      )
    await daqui(id)
    await umDeCadaVez(id, async () => {
      const l = await lerViagem(id)
      if (!l?.emergenciaEm || l.emergenciaCienteEm)
        throw new ErroApi(409, 'no_emergency', 'Não há emergência esperando ciência nesta viagem.')
      if (l.tripId !== null) {
        const cfg = await config()
        // O alarme do rastreador (e do iERP antigo) para também; fora do ar, a ciência vale aqui.
        if (cfg)
          await clienteDoRastreador(cfg, fazerFetch)
            .cienteEmergencia(l.tripId)
            .catch((e: unknown) => console.error(`[viagens] ciência da emergência ${l.tripId}:`, e))
      }
      const agora = new Date().toISOString()
      await db
        .updateTable('ordensViagens')
        .set({ emergenciaCienteEm: agora, emergenciaCientePor: autor, alteradoEm: agora })
        .where('id', '=', id)
        .execute()
      await historico(l.ordemId, autor, 'viagem_emergencia_ciente')
    })
    return obter(id)
  }

  /** Viagem do lote (detalhe do lote e painel de recebimento). */
  /**
   * Os arquivos do trajeto (GPX, KML, CSV — como no iERP antigo) de uma viagem TERMINADA: o
   * trajeto guardado aqui (não depende do rastreador).
   */
  async function exportar(id: string, formato: string) {
    const f = formato.toLowerCase()
    if (!formatoValido(f))
      throw new ErroApi(422, 'validation', 'Formato inválido — use gpx, kml ou csv.')
    if (id.startsWith(PREFIXO_DE_FORA)) throw naoEncontrado('Viagem não encontrada.')
    const l = await daqui(id)
    if (!l.arquivada)
      throw new ErroApi(
        409,
        'trip_not_finished',
        'O trajeto só é baixado depois que a viagem termina.',
      )
    const pontos = await db
      .selectFrom('ordensViagensPontos')
      .select(['latitude', 'longitude', 'velocidade', 'precisao', 'registradoEm'])
      .where('viagemId', '=', id)
      .orderBy('seq')
      .execute()
    if (!pontos.length)
      throw new ErroApi(409, 'trip_no_points', 'Esta viagem não tem pontos para exportar.')
    const viagem = {
      codigoLote: l.loteCodigo,
      cliente: l.clienteNome,
      placa: l.placa ?? l.placaInformada,
      iniciadaEm: l.iniciadaEm,
    }
    const { gerar, contentType } = FORMATOS[f]
    return {
      nome: `${nomeBaseDoArquivo(viagem)}.${f}`,
      contentType,
      conteudo: gerar(viagem, pontos),
    }
  }

  /** As viagens do lote (uma por rastreador; as canceladas ficam de fora). */
  async function doLote(ordemId: string): Promise<Viagem[]> {
    const linhas = await linhaDaViagem(db)
      .where('v.ordemId', '=', ordemId)
      .where('v.status', '<>', 'cancelada')
      .orderBy('v.numero')
      .orderBy('v.criadoEm')
      .execute()
    const cfg = await config()
    const viagens = linhas.map((l) => paraViagem(l, cfg?.url ?? null))
    for (const f of deFora.values())
      if (f.ordemId === ordemId) {
        const v = await paraViagemDeFora(f)
        if (v) viagens.push(v)
      }
    return viagens
  }

  return {
    config,
    aoMudarRastreio,
    antesDeDesligar,
    adicionarCaminhao,
    adicionarRastreio,
    usarRastreador,
    sincronizar,
    tempoReal,
    listar,
    obter,
    chat,
    enviarChat,
    finalizar,
    cienteEmergencia,
    doLote,
    exportar,
  }
}

export type ServicoViagens = ReturnType<typeof criarServicoViagens>

/* ------------------------------------------------------------ mapa */

/** Postos e balanças por região (Overpass/OpenStreetMap), guardados um dia. */
interface Poi {
  latitude: number
  longitude: number
  tipo: 'posto' | 'balanca'
  nome: string | null
}

/**
 * Os servidores públicos do Overpass (wiki.openstreetmap.org/wiki/Overpass_API): o principal
 * (FOSSGIS) e o reserva (private.coffee, antigo kumi.systems). Eles pedem uso moderado: uma
 * consulta por região (meio grau), guardada um dia; depois de uma falha, a região espera 2 min.
 */
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
const GRADE = 0.5
const CACHE_POIS_MS = 24 * 3_600_000
const ESPERA_FALHA_MS = 2 * 60_000

function criarMapa(servico: ServicoViagens, fazerFetch: Fetch) {
  const pois = new Map<string, { em: number; lista: Poi[] }>()
  const falhou = new Map<string, number>()

  async function consultar(bbox: string): Promise<Poi[]> {
    const consulta = `[out:json][timeout:25];(node[amenity=fuel](${bbox});node[amenity=weighbridge](${bbox}););out 600;`
    let ultimo = ''
    for (const url of OVERPASS) {
      try {
        const r = await fazerFetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Re-Teck-iERP/2.0 (Ordens > Viagens)',
          },
          body: `data=${encodeURIComponent(consulta)}`,
          signal: AbortSignal.timeout(30_000),
        })
        if (!r.ok) {
          ultimo = `${r.status}`
          continue
        }
        const corpo = (await r.json()) as {
          elements?: { lat?: number; lon?: number; tags?: Record<string, string> }[]
        }
        return (corpo.elements ?? []).flatMap((e) =>
          typeof e.lat === 'number' && typeof e.lon === 'number'
            ? [
                {
                  latitude: e.lat,
                  longitude: e.lon,
                  tipo:
                    e.tags?.amenity === 'weighbridge' ? ('balanca' as const) : ('posto' as const),
                  nome: e.tags?.name ?? e.tags?.brand ?? null,
                },
              ]
            : [],
        )
      } catch (e) {
        ultimo = e instanceof Error ? e.message : String(e)
      }
    }
    throw new ErroApi(502, 'map_unavailable', `O OpenStreetMap não respondeu (${ultimo}).`)
  }

  const caixaSchema = z.object({
    s: z.coerce.number().min(-90).max(90),
    w: z.coerce.number().min(-180).max(180),
    n: z.coerce.number().min(-90).max(90),
    e: z.coerce.number().min(-180).max(180),
  })

  return {
    async pois(entrada: unknown): Promise<Poi[]> {
      const c = caixaSchema.parse(entrada)
      // A região arredondada para a grade (no máximo 1,5° × 1,5° — o mapa só pede com zoom de
      // estrada): a mesma vista, a mesma chave.
      const s = Math.floor(c.s / GRADE) * GRADE
      const w = Math.floor(c.w / GRADE) * GRADE
      const n = Math.min(Math.ceil(c.n / GRADE) * GRADE, s + 3 * GRADE)
      const e = Math.min(Math.ceil(c.e / GRADE) * GRADE, w + 3 * GRADE)
      const chave = `${s},${w},${n},${e}`
      const guardado = pois.get(chave)
      if (guardado && Date.now() - guardado.em < CACHE_POIS_MS) return guardado.lista
      if (Date.now() - (falhou.get(chave) ?? 0) < ESPERA_FALHA_MS)
        throw new ErroApi(502, 'map_unavailable', 'O OpenStreetMap não respondeu há pouco.')
      try {
        const lista = await consultar(chave)
        if (pois.size > 300) pois.clear()
        pois.set(chave, { em: Date.now(), lista })
        falhou.delete(chave)
        return lista
      } catch (erro) {
        falhou.set(chave, Date.now())
        throw erro
      }
    },
    async transito(z: number, x: number, y: number) {
      const cfg = await servico.config()
      if (!cfg?.chaveTransito) throw naoEncontrado('Sem chave do mapa de trânsito.')
      const r = await fazerFetch(
        `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/${z}/${x}/${y}.png?key=${encodeURIComponent(cfg.chaveTransito)}`,
        { signal: AbortSignal.timeout(15_000) },
      )
      if (!r.ok)
        throw new ErroApi(502, 'map_unavailable', `O mapa de trânsito respondeu ${r.status}.`)
      return Buffer.from(await r.arrayBuffer())
    },
  }
}

/* ------------------------------------------------------------ rotas */

export function rotasViagens(servico: ServicoViagens, fazerFetch: Fetch = fetch) {
  const r = Router()
  const mapa = criarMapa(servico, fazerFetch)

  r.get('/', async (req, res) => {
    res.json(await servico.listar(req.query))
  })
  r.get('/mapa/pois', async (req, res) => {
    res.json(await mapa.pois(req.query))
  })
  r.get('/mapa/transito/:z/:x/:y.png', async (req, res) => {
    const [z, x, y] = [req.params.z, req.params.x, req.params.y].map(Number)
    if (
      ![z, x, y].every((n) => Number.isInteger(n) && n! >= 0) ||
      z! > 22 ||
      x! >= 2 ** z! ||
      y! >= 2 ** z!
    )
      throw new ErroApi(422, 'validation', 'Tile inválido.')
    const png = await mapa.transito(z!, x!, y!)
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'private, max-age=60')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.send(png)
  })
  r.get('/lote/:ordemId', async (req, res) => {
    res.json(await servico.doLote(String(req.params.ordemId)))
  })
  r.post('/lote/:ordemId', async (req, res) => {
    res
      .status(201)
      .json(await servico.adicionarCaminhao(String(req.params.ordemId), req.body, autorDa(req)))
  })
  r.get('/:id', async (req, res) => {
    res.json(await servico.obter(String(req.params.id)))
  })
  r.get('/:id/exportar/:formato', async (req, res) => {
    const a = await servico.exportar(String(req.params.id), String(req.params.formato))
    res.setHeader('Content-Type', a.contentType)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.attachment(a.nome)
    res.send(a.conteudo)
  })
  r.get('/:id/chat', async (req, res) => {
    res.json(await servico.chat(String(req.params.id)))
  })
  r.post('/:id/chat', async (req, res) => {
    res.status(201).json(await servico.enviarChat(String(req.params.id), req.body))
  })
  r.post('/:id/rastreios', async (req, res) => {
    res
      .status(201)
      .json(await servico.adicionarRastreio(String(req.params.id), req.body, autorDa(req)))
  })
  r.post('/:id/rastreador', async (req, res) => {
    res.json(await servico.usarRastreador(String(req.params.id), req.body, autorDa(req)))
  })
  r.post('/:id/finalizar', async (req, res) => {
    res.json(await servico.finalizar(String(req.params.id), autorDa(req)))
  })
  r.post('/:id/emergencia/ciente', async (req, res) => {
    res.json(await servico.cienteEmergencia(String(req.params.id), autorDa(req)))
  })
  return r
}
