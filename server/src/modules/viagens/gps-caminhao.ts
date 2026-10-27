import { randomUUID } from 'node:crypto'
import type { Db } from '../../db/database.js'
import type { RastreadoresTable } from '../../db/schema.js'

/*
 * O APARELHO de GPS do caminhão (pedido do usuário, 22/10/2026: "utilize o mesmo método no 1.0,
 * esse sistema do gps não vai mudar"). O mesmo contrato do iERP 1.0 (`services/leitorGps.js` +
 * `lib/rastreadorGps.js` de lá): a placa (ESP32 + GPS, 4G) manda os pontos para o servidor de GPS
 * (Walker, um Cloudflare Worker) e o iERP BUSCA lá (pull):
 *
 *   GET <url da leitura>?after=<cursor>      Authorization: Bearer <chave>
 *   → { ok, cursor, more, batches: [{ deviceId, firmware, sentAt, points: [...], status }],
 *       devices: [{ deviceId, firmware, status }] }
 *
 * A chave é a MESMA do 1.0 (decisão dele); cada iERP guarda o SEU cursor (o 2.0 em
 * `integracoes.sincronizacao`), então ler aqui não mexe na leitura do 1.0. Ritmo do 1.0: a cada
 * 5 min; com `more`, páginas a cada 2 s até 28 por rodada (o Walker aceita 30/min); 429 espera o
 * `Retry-After`. A placa aparece sozinha; ponto sem viagem aberta só atualiza a última posição.
 * A viagem pelo aparelho começa no botão "Usar rastreador" e termina no botão Finalizar.
 */

type Fetch = typeof fetch

export const SISTEMA_GPS = 'GPS_CAMINHAO'
const INTERVALO_MS = Math.max(60_000, Number(process.env.GPS_LEITURA_INTERVALO_MS) || 300_000)
const TICK_MS = 60_000
const MAX_PAGINAS = 28
const ENTRE_PAGINAS_MS = 2_000
const TIMEOUT_MS = 8_000
const MAX_PONTOS = 500
/** Sem notícia da placa há mais que isto = sem conexão (como no 1.0). */
export const SEM_CONEXAO_APOS_MS = 10 * 60_000

export interface PontoDoAparelho {
  latitude: number
  longitude: number
  /** m/s */
  velocidade: number | null
  /** m */
  precisao: number | null
  em: string
  seq: number | null
}

export interface LoteDoAparelho {
  deviceId: string
  firmware: string | null
  enviadoEm: string | null
  status: Record<string, unknown> | null
  pontos: PontoDoAparelho[]
}

export interface LeituraGps {
  lotes: LoteDoAparelho[]
  dispositivos: {
    deviceId: string
    firmware: string | null
    status: Record<string, unknown> | null
  }[]
  cursor: string | null
  mais: boolean
}

export type EstadoRastreador =
  'nunca_conectou' | 'sem_conexao' | 'gps_com_problema' | 'sem_satelite' | 'online'

const DEVICE = /^[a-z0-9][a-z0-9._-]{2,63}$/
const COM_FUSO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/
/** O que se guarda do bloco `status` da placa. */
const CAMPOS_STATUS = [
  'fix',
  'satsUsed',
  'satsVisible',
  'hdop',
  'pdop',
  'gps',
  'lastFixAt',
  'wifiRssi',
  'queued',
  'dropped',
  'uptimeS',
  'online',
  'lastSeenAt',
  'reportedAt',
]

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const objeto = (v: unknown) =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null

export const normalizarDevice = (v: unknown) => {
  const d = texto(v)?.toLowerCase() ?? ''
  return DEVICE.test(d) ? d : null
}

/** O endereço da leitura com o cursor (marca `<cursor>`/`{cursor}` na URL; sem marca, `after`). */
export function urlDaLeitura(base: string, cursor: string | null) {
  if (/<cursor>|\{cursor\}/.test(base))
    return base.replace(/<cursor>|\{cursor\}/g, encodeURIComponent(cursor ?? ''))
  const u = new URL(base)
  if (cursor) u.searchParams.set('after', cursor)
  else u.searchParams.delete('after')
  return u.toString()
}

function filtrarStatus(s: unknown) {
  const o = objeto(s)
  if (!o) return null
  const r: Record<string, unknown> = {}
  for (const k of CAMPOS_STATUS) if (o[k] !== undefined) r[k] = o[k]
  return Object.keys(r).length ? r : null
}

/** Um ponto válido (um ponto ruim recusa o lote inteiro, como no 1.0); simulado = null. */
function lerPonto(p: unknown): PontoDoAparelho | 'ruim' | null {
  const o = objeto(p)
  if (!o) return 'ruim'
  const lat = num(o.latitude ?? o.lat)
  const lng = num(o.longitude ?? o.lng ?? o.lon)
  const em = texto(o.recordedAt)
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180)
    return 'ruim'
  if (lat === 0 && lng === 0) return 'ruim'
  if (!em || !COM_FUSO.test(em) || Number.isNaN(Date.parse(em))) return 'ruim'
  const vel = o.speedMps === undefined || o.speedMps === null ? null : num(o.speedMps)
  const prec = o.accuracyM === undefined || o.accuracyM === null ? null : num(o.accuracyM)
  if ((vel !== null && vel < 0) || (prec !== null && prec < 0)) return 'ruim'
  if (o.simulated === true) return null
  const seq = num(o.seq)
  return {
    latitude: lat,
    longitude: lng,
    velocidade: vel,
    precisao: prec,
    em: new Date(em).toISOString(),
    seq: seq !== null && Number.isInteger(seq) && seq >= 0 ? seq : null,
  }
}

function lerLote(b: unknown): LoteDoAparelho | null {
  const o = objeto(b)
  if (!o) return null
  const deviceId = normalizarDevice(o.deviceId)
  if (!deviceId) return null
  const brutos = Array.isArray(o.points) ? o.points : []
  if (brutos.length > MAX_PONTOS) return null
  const pontos: PontoDoAparelho[] = []
  for (const p of brutos) {
    const r = lerPonto(p)
    if (r === 'ruim') return null
    if (r) pontos.push(r)
  }
  pontos.sort((a, c) => a.em.localeCompare(c.em))
  return {
    deviceId,
    firmware: texto(o.firmware),
    enviadoEm: texto(o.sentAt),
    status: filtrarStatus(o.status),
    pontos,
  }
}

/**
 * A resposta da leitura, tolerante como no 1.0: o formato do Walker (`batches` + `devices`),
 * um envelope só, uma lista de envelopes ou uma lista plana de pontos com `deviceId`.
 */
export function lerRespostaDaLeitura(corpo: unknown): LeituraGps {
  const o = objeto(corpo)
  let brutos: unknown[] = []
  if (Array.isArray(corpo)) brutos = corpo
  else if (o && Array.isArray(o.batches)) brutos = o.batches
  else if (o && Array.isArray(o.boards)) brutos = o.boards
  else if (o && o.deviceId) brutos = [o]
  // Lista plana de pontos (cada um com deviceId): agrupa por placa.
  if (brutos.length && brutos.every((x) => objeto(x)?.recordedAt !== undefined)) {
    const por = new Map<string, unknown[]>()
    for (const p of brutos) {
      const d = String(objeto(p)?.deviceId ?? '')
      por.set(d, [...(por.get(d) ?? []), p])
    }
    brutos = [...por].map(([deviceId, points]) => ({ deviceId, points }))
  }
  const lotes = brutos.map(lerLote).filter((l): l is LoteDoAparelho => l !== null)
  const dispositivos = (o && Array.isArray(o.devices) ? o.devices : [])
    .map((d) => {
      const x = objeto(d)
      const deviceId = normalizarDevice(x?.deviceId)
      return deviceId
        ? { deviceId, firmware: texto(x?.firmware), status: filtrarStatus(x?.status) }
        : null
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)
  const c = o ? (o.next ?? o.cursor ?? o.nextSince ?? o.since) : undefined
  let cursor = c === undefined || c === null || c === '' ? null : String(c)
  if (cursor === null) {
    const ultimo = lotes
      .flatMap((l) => l.pontos.map((p) => p.em))
      .sort()
      .at(-1)
    cursor = ultimo ?? null
  }
  return { lotes, dispositivos, cursor, mais: Boolean(o?.more) }
}

/** A situação do aparelho (a mesma régua do 1.0). */
export function estadoDoRastreador(
  r: Pick<RastreadoresTable, 'ultimoContatoEm' | 'ultimoStatus'>,
  agora = Date.now(),
): EstadoRastreador {
  if (!r.ultimoContatoEm) return 'nunca_conectou'
  const s = r.ultimoStatus ? (JSON.parse(r.ultimoStatus) as Record<string, unknown>) : {}
  if (s.online === false) return 'sem_conexao'
  if (agora - Date.parse(r.ultimoContatoEm) > SEM_CONEXAO_APOS_MS) return 'sem_conexao'
  if (s.gps === 'not_found' || s.gps === 'detecting') return 'gps_com_problema'
  if (s.fix === 'none') return 'sem_satelite'
  return 'online'
}

/** Distância (m) entre dois pontos (haversine). */
function metros(a: { latitude: number; longitude: number }, b: typeof a) {
  const R = 6_371_000
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLng = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms))

export function criarLeitorGps(db: Db, opcoes: { fetch?: Fetch; semEspera?: boolean } = {}) {
  const fazerFetch = opcoes.fetch ?? fetch
  let ultimaLeitura = 0
  let esperarAte = 0
  let lendo: Promise<void> | null = null

  async function config() {
    const c = await db
      .selectFrom('integracoes')
      .select(['id', 'urlPainel', 'tokenPainel', 'sincronizacao'])
      .where('sistema', '=', SISTEMA_GPS)
      .where('status', '=', 'ativo')
      .executeTakeFirst()
    if (!c?.urlPainel || !c.tokenPainel) return null
    const guardado = c.sincronizacao
      ? (JSON.parse(c.sincronizacao) as { cursor?: string | null })
      : {}
    return { id: c.id, url: c.urlPainel, chave: c.tokenPainel, cursor: guardado.cursor ?? null }
  }

  async function registrarErro(id: string, mensagem: string) {
    await db
      .updateTable('integracoes')
      .set({ ultimoErro: mensagem.slice(0, 300), ultimoErroEm: new Date().toISOString() })
      .where('id', '=', id)
      .execute()
  }

  /** Guarda o que veio de UMA placa: o aparelho (cria se novo) e os pontos na viagem aberta. */
  async function processarLote(l: LoteDoAparelho) {
    const agora = new Date().toISOString()
    await db.transaction().execute(async (trx) => {
      let r = await trx
        .selectFrom('rastreadores')
        .selectAll()
        .where('deviceId', '=', l.deviceId)
        .executeTakeFirst()
      if (!r) {
        r = {
          id: randomUUID(),
          deviceId: l.deviceId,
          placa: null,
          descricao: null,
          status: 'ativo',
          firmware: l.firmware,
          ultimoContatoEm: null,
          ultimoStatus: null,
          ultimaLatitude: null,
          ultimaLongitude: null,
          ultimaVelocidade: null,
          ultimoPontoEm: null,
          ultimoSeq: null,
          pontosPerdidos: 0,
          criadoEm: agora,
          alteradoEm: agora,
        }
        await trx.insertInto('rastreadores').values(r).execute()
      }
      if (r.status !== 'ativo') return

      // Último contato: o "visto por último" da placa, o ponto mais novo, o envio ou agora —
      // nunca anda para trás e nunca passa de agora.
      const ultimoPonto = l.pontos.at(-1)
      const visto = texto(l.status?.lastSeenAt) ?? ultimoPonto?.em ?? l.enviadoEm ?? agora
      const vistoIso = Number.isNaN(Date.parse(visto)) ? agora : new Date(visto).toISOString()
      const contato = [r.ultimoContatoEm, vistoIso < agora ? vistoIso : agora]
        .filter((x): x is string => Boolean(x))
        .sort()
        .at(-1)!
      // Pontos perdidos: buracos no seq (seq que volta = a placa reiniciou, não conta).
      let seq = r.ultimoSeq
      let perdidos = r.pontosPerdidos
      for (const p of l.pontos) {
        if (p.seq === null) continue
        if (seq !== null && p.seq > seq + 1) perdidos += p.seq - seq - 1
        seq = p.seq
      }
      const novo = ultimoPonto && (!r.ultimoPontoEm || ultimoPonto.em > r.ultimoPontoEm)
      await trx
        .updateTable('rastreadores')
        .set({
          firmware: l.firmware ?? r.firmware,
          ultimoContatoEm: contato,
          ...(l.status ? { ultimoStatus: JSON.stringify(l.status) } : {}),
          ...(novo
            ? {
                ultimaLatitude: ultimoPonto.latitude,
                ultimaLongitude: ultimoPonto.longitude,
                ultimaVelocidade: ultimoPonto.velocidade,
                ultimoPontoEm: ultimoPonto.em,
              }
            : {}),
          ultimoSeq: seq,
          pontosPerdidos: perdidos,
          alteradoEm: agora,
        })
        .where('id', '=', r.id)
        .execute()

      // A viagem aberta deste aparelho recebe os pontos (sem repetir a mesma hora).
      if (!l.pontos.length) return
      const v = await trx
        .selectFrom('ordensViagens')
        .selectAll()
        .where('rastreadorId', '=', r.id)
        .where('origem', '=', 'aparelho')
        .where('status', 'in', ['em_rota', 'chegou'])
        .executeTakeFirst()
      if (!v) return
      const ja = new Set(
        (
          await trx
            .selectFrom('ordensViagensPontos')
            .select('registradoEm')
            .where('viagemId', '=', v.id)
            .where(
              'registradoEm',
              'in',
              l.pontos.map((p) => p.em),
            )
            .execute()
        ).map((x) => x.registradoEm),
      )
      // Sem repetir a mesma hora (nem dentro do mesmo envio).
      const novos = l.pontos.filter((p) => !ja.has(p.em) && (ja.add(p.em), true))
      if (!novos.length) return
      const ultimo = await trx
        .selectFrom('ordensViagensPontos')
        .select(['seq', 'latitude', 'longitude'])
        .where('viagemId', '=', v.id)
        .orderBy('seq', 'desc')
        .executeTakeFirst()
      let proximo = (ultimo?.seq ?? 0) + 1
      let anterior = ultimo ?? null
      let distancia = v.distanciaMetros ?? 0
      for (const p of novos) {
        if (anterior) distancia += metros(anterior, p)
        anterior = { seq: proximo, latitude: p.latitude, longitude: p.longitude }
        await trx
          .insertInto('ordensViagensPontos')
          .values({
            viagemId: v.id,
            seq: proximo++,
            latitude: p.latitude,
            longitude: p.longitude,
            velocidade: p.velocidade,
            precisao: p.precisao,
            registradoEm: p.em,
          })
          .execute()
      }
      const maisNovo = novos.at(-1)!
      await trx
        .updateTable('ordensViagens')
        .set({
          totalPontos: v.totalPontos + novos.length,
          distanciaMetros: Math.round(distancia),
          ...(!v.ultimaEm || maisNovo.em > v.ultimaEm
            ? {
                ultimaLatitude: maisNovo.latitude,
                ultimaLongitude: maisNovo.longitude,
                ultimaVelocidade: maisNovo.velocidade,
                ultimaEm: maisNovo.em,
              }
            : {}),
          alteradoEm: agora,
        })
        .where('id', '=', v.id)
        .execute()
    })
  }

  /** Só firmware, status e último contato (a lista `devices`). */
  async function processarDispositivo(d: LeituraGps['dispositivos'][number]) {
    const r = await db
      .selectFrom('rastreadores')
      .selectAll()
      .where('deviceId', '=', d.deviceId)
      .executeTakeFirst()
    if (!r || r.status !== 'ativo') return
    const agora = new Date().toISOString()
    const visto = texto(d.status?.lastSeenAt)
    const vistoIso =
      visto && !Number.isNaN(Date.parse(visto)) ? new Date(visto).toISOString() : null
    const contato = [r.ultimoContatoEm, vistoIso && vistoIso < agora ? vistoIso : null]
      .filter((x): x is string => Boolean(x))
      .sort()
      .at(-1)
    await db
      .updateTable('rastreadores')
      .set({
        firmware: d.firmware ?? r.firmware,
        ...(d.status ? { ultimoStatus: JSON.stringify(d.status) } : {}),
        ...(contato ? { ultimoContatoEm: contato } : {}),
        alteradoEm: agora,
      })
      .where('id', '=', r.id)
      .execute()
  }

  /** Uma rodada de leitura (até 28 páginas). Nunca lança: o erro fica na Integração. */
  async function rodada() {
    const cfg = await config()
    if (!cfg) return
    let cursor = cfg.cursor
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      let res: Response
      try {
        res = await fazerFetch(urlDaLeitura(cfg.url, cursor), {
          headers: { Authorization: `Bearer ${cfg.chave}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          redirect: 'manual',
        })
      } catch (e) {
        await registrarErro(cfg.id, `O servidor de GPS não respondeu (${(e as Error).message}).`)
        esperarAte = Date.now() + TICK_MS
        return
      }
      if (res.status === 429) {
        const s = Number(res.headers.get('retry-after'))
        esperarAte = Date.now() + (Number.isFinite(s) && s > 0 ? s * 1000 : TICK_MS)
        return
      }
      if (res.status === 401 || res.status === 403) {
        await registrarErro(cfg.id, 'O servidor de GPS recusou a chave de leitura.')
        esperarAte = Date.now() + TICK_MS
        return
      }
      if (!res.ok) {
        await registrarErro(cfg.id, `O servidor de GPS respondeu ${res.status}.`)
        esperarAte = Date.now() + TICK_MS
        return
      }
      let corpo: unknown
      try {
        corpo = await res.json()
      } catch {
        await registrarErro(cfg.id, 'O servidor de GPS não respondeu em JSON.')
        esperarAte = Date.now() + TICK_MS
        return
      }
      const leitura = lerRespostaDaLeitura(corpo)
      for (const l of leitura.lotes)
        await processarLote(l).catch((e: unknown) => console.error(`[gps] placa ${l.deviceId}:`, e))
      for (const d of leitura.dispositivos)
        await processarDispositivo(d).catch((e: unknown) =>
          console.error(`[gps] placa ${d.deviceId}:`, e),
        )
      // O cursor é gravado a cada página (a próxima rodada continua daqui).
      cursor = leitura.cursor ?? cursor
      await db
        .updateTable('integracoes')
        .set({
          sincronizacao: JSON.stringify({ cursor }),
          ultimoPainelEm: new Date().toISOString(),
          ultimoErro: null,
          ultimoErroEm: null,
        })
        .where('id', '=', cfg.id)
        .execute()
      if (!leitura.mais) return
      if (pagina === MAX_PAGINAS - 1) {
        // Sobrou fila: a próxima rodada vem em 1 min.
        ultimaLeitura = Date.now() - INTERVALO_MS + TICK_MS
        return
      }
      if (!opcoes.semEspera) await espera(ENTRE_PAGINAS_MS)
    }
  }

  /** "Ler agora" (e o relógio): uma leitura por vez. */
  function lerAgora() {
    lendo ??= rodada()
      .catch((e: unknown) => console.error('[gps] leitura:', e))
      .finally(() => {
        ultimaLeitura = Date.now()
        lendo = null
      })
    return lendo
  }

  /** O relógio: confere a cada minuto; lê a cada 5 min (ou antes, se sobrou fila). */
  function iniciar() {
    const tick = () => {
      if (Date.now() < esperarAte || Date.now() - ultimaLeitura < INTERVALO_MS) return
      void lerAgora()
    }
    tick()
    const t = setInterval(tick, TICK_MS)
    t.unref?.()
    return () => clearInterval(t)
  }

  return { lerAgora, iniciar }
}

export type LeitorGps = ReturnType<typeof criarLeitorGps>
