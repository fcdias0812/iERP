import { ErroApi } from '../../shared/erros.js'
import { normalizar } from '../../shared/texto.js'
import { fetchComCa } from '../integracao/rede.js'

/*
 * O cliente HTTP do RASTREADOR de GPS (ReTeckTracker — `C:\Trabalho\01_Sistemas\reteck-truck-tracking`).
 * É o ÚNICO lugar do iERP 2.0 que fala com ele, sempre pelo servidor e com a chave INTERNA
 * (`X-Api-Key`; o navegador nunca vê a chave). O rastreador é o MESMO que o iERP antigo usa:
 * aqui só se LÊ e se age sobre as viagens dos lotes do 2.0 — nada é apagado lá (o `DELETE` do
 * rastreador nunca é chamado daqui).
 *
 * Rotas usadas (todas com a chave interna):
 *   GET  /api/trips?serviceOrder=LOT-00001   viagens do lote (resumo + último ponto)
 *   GET  /api/trips/{id}                     detalhe com TODOS os pontos
 *   POST /api/trips/{id}/arrival-code        grava o código de chegada (o rastreador guarda o hash)
 *   POST /api/trips/{id}/end                 o operador encerra a viagem
 *   GET  /api/trips/{id}/stops | /chat       paradas reportadas e conversa
 *   POST /api/trips/{id}/chat/internal       mensagem do escritório para o motorista
 *   POST /api/trips/{id}/emergency/ack       ciência da emergência (o alarme para)
 */

type Fetch = typeof fetch

export interface ConfigRastreador {
  /** Endereço base (https://rastreador…); o app do motorista mora em `<url>/app/`. */
  url: string
  chave: string
  ca: string | null
}

export interface PontoRastreador {
  latitude: number
  longitude: number
  altitude?: number | null
  speedMps?: number | null
  accuracyM?: number | null
  recordedAt: string
}

export interface ResumoRastreador {
  tripId: number
  clientName: string
  serviceOrder: string
  driverName: string
  plate: string
  status: string
  startedAt: string
  endedAt: string | null
  pointCount: number
  lastPoint: PontoRastreador | null
}

export interface DetalheRastreador extends Omit<ResumoRastreador, 'pointCount' | 'lastPoint'> {
  points: PontoRastreador[]
}

export interface ParadaRastreador {
  id: number
  reason: string
  latitude: number
  longitude: number
  mediaUrl: string | null
  createdAt: string
}

export interface MensagemRastreador {
  id: number
  sender: string
  text: string | null
  mediaUrl: string | null
  createdAt: string
}

/** Situação da viagem no iERP. */
export type StatusViagem =
  'aguardando_motorista' | 'em_rota' | 'chegou' | 'finalizada' | 'cancelada'

/** "Ativa" / "AguardandoConfirmação" / "Finalizada" (o rastreador grava em português, com acento). */
export function statusDoRastreador(status: string | null | undefined): StatusViagem | null {
  const s = normalizar(String(status ?? '')).replace(/\s+/g, '')
  if (s === 'ativa') return 'em_rota'
  if (s === 'aguardandoconfirmacao') return 'chegou'
  if (s === 'finalizada') return 'finalizada'
  return null
}

const TIMEOUT_MS = 15_000
/** O detalhe traz todos os pontos (uma viagem longa tem milhares). */
const TIMEOUT_DETALHE_MS = 60_000

/** Lê o campo em camelCase ou PascalCase (o .NET pode mandar dos dois jeitos). */
export function campo<T = unknown>(o: unknown, nome: string): T | undefined {
  if (!o || typeof o !== 'object') return undefined
  const r = o as Record<string, unknown>
  return (r[nome] ?? r[nome.charAt(0).toUpperCase() + nome.slice(1)]) as T | undefined
}

const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const textoDe = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

export function lerPonto(p: unknown): PontoRastreador | null {
  const latitude = numero(campo(p, 'latitude'))
  const longitude = numero(campo(p, 'longitude'))
  const recordedAt = textoDe(campo(p, 'recordedAt'))
  if (latitude === null || longitude === null || !recordedAt) return null
  return {
    latitude,
    longitude,
    altitude: numero(campo(p, 'altitude')),
    speedMps: numero(campo(p, 'speedMps')),
    accuracyM: numero(campo(p, 'accuracyM')),
    recordedAt,
  }
}

export function lerResumo(v: unknown): ResumoRastreador | null {
  const tripId = numero(campo(v, 'tripId') ?? campo(v, 'id'))
  if (tripId === null) return null
  return {
    tripId,
    clientName: textoDe(campo(v, 'clientName')) ?? '',
    serviceOrder: textoDe(campo(v, 'serviceOrder')) ?? '',
    driverName: textoDe(campo(v, 'driverName')) ?? '',
    plate: textoDe(campo(v, 'plate')) ?? '',
    status: textoDe(campo(v, 'status')) ?? '',
    startedAt: textoDe(campo(v, 'startedAt')) ?? '',
    endedAt: textoDe(campo(v, 'endedAt')),
    pointCount: numero(campo(v, 'pointCount')) ?? 0,
    lastPoint: lerPonto(campo(v, 'lastPoint')),
  }
}

/** O rastreador respondeu 409 (ex.: encerrar uma viagem que já terminou lá). */
export const ehConflito = (e: unknown) =>
  e instanceof ErroApi && (e.details as { status?: number } | undefined)?.status === 409

/** A viagem não existe (mais) no rastreador. */
export const ehNaoEncontrado = (e: unknown) =>
  e instanceof ErroApi && e.code === 'tracker_not_found'

/** O endereço base, sem barra no fim. */
export const baseDoRastreador = (url: string) => url.trim().replace(/\/+$/, '')

/** Mídia do rastreador (`/api/media/<guid>`, pública por desenho) → endereço completo. */
export function urlDaMidia(base: string, mediaUrl: string | null | undefined) {
  if (!mediaUrl) return null
  // Só a mídia do PRÓPRIO rastreador: a chave do app do motorista é pública (vai no APK), então
  // um link qualquer mandado no chat não vira "Ver anexo" aqui.
  const raiz = baseDoRastreador(base)
  let url: URL
  try {
    url = new URL(mediaUrl, `${raiz}/`)
  } catch {
    return null
  }
  if (url.origin !== new URL(raiz).origin || !url.pathname.startsWith('/api/media/')) return null
  return url.toString()
}

export function clienteDoRastreador(cfg: ConfigRastreador, fazerFetch: Fetch = fetch) {
  const base = baseDoRastreador(cfg.url)
  const f = fetchComCa(cfg.ca, fazerFetch)

  async function pedir<T>(
    caminho: string,
    opcoes: { metodo?: string; corpo?: unknown; espera?: number } = {},
  ): Promise<T> {
    let r: Response
    try {
      r = await f(`${base}${caminho}`, {
        method: opcoes.metodo ?? 'GET',
        headers: {
          'X-Api-Key': cfg.chave,
          Accept: 'application/json',
          ...(opcoes.corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
        signal: AbortSignal.timeout(opcoes.espera ?? TIMEOUT_MS),
      })
    } catch (e) {
      throw new ErroApi(
        502,
        'tracker_unavailable',
        `O rastreador não respondeu (${e instanceof Error ? e.message : String(e)}).`,
      )
    }
    if (r.status === 404)
      throw new ErroApi(404, 'tracker_not_found', 'Viagem não encontrada no rastreador.')
    if (r.status === 401 || r.status === 403)
      throw new ErroApi(502, 'tracker_unauthorized', 'O rastreador recusou a chave interna.')
    if (!r.ok) {
      let detalhe = ''
      try {
        const corpo = (await r.json()) as unknown
        detalhe = textoDe(campo(corpo, 'error')) ?? textoDe(campo(corpo, 'message')) ?? ''
      } catch {
        /* sem corpo */
      }
      throw new ErroApi(
        502,
        'tracker_error',
        `O rastreador respondeu ${r.status}${detalhe ? `: ${detalhe}` : ''}.`,
        { status: r.status },
      )
    }
    const texto = await r.text()
    return (texto ? JSON.parse(texto) : null) as T
  }

  return {
    base,
    async viagensDoLote(codigoLote: string): Promise<ResumoRastreador[]> {
      const lista = await pedir<unknown[]>(
        `/api/trips?serviceOrder=${encodeURIComponent(codigoLote)}`,
      )
      return (
        (Array.isArray(lista) ? lista : [])
          .map(lerResumo)
          .filter((v): v is ResumoRastreador => Boolean(v))
          // A busca do rastreador é exata, mas confere (nunca amarrar viagem de outro lote).
          .filter((v) => v.serviceOrder === codigoLote)
      )
    },
    async detalhe(tripId: number): Promise<DetalheRastreador> {
      const d = await pedir<unknown>(`/api/trips/${tripId}`, { espera: TIMEOUT_DETALHE_MS })
      const resumo = lerResumo(d)
      if (!resumo)
        throw new ErroApi(502, 'tracker_error', 'O rastreador devolveu uma viagem sem id.')
      const { pointCount: _n, lastPoint: _u, ...resto } = resumo
      void _n
      void _u
      const pontos = campo<unknown[]>(d, 'points')
      return {
        ...resto,
        points: (Array.isArray(pontos) ? pontos : [])
          .map(lerPonto)
          .filter((p): p is PontoRastreador => Boolean(p)),
      }
    },
    registrarCodigo: (tripId: number, codigo: string) =>
      pedir(`/api/trips/${tripId}/arrival-code`, { metodo: 'POST', corpo: { code: codigo } }),
    encerrar: (tripId: number) => pedir(`/api/trips/${tripId}/end`, { metodo: 'POST' }),
    async paradas(tripId: number): Promise<ParadaRastreador[]> {
      const l = await pedir<unknown[]>(`/api/trips/${tripId}/stops`)
      return (Array.isArray(l) ? l : []).flatMap((s) => {
        const latitude = numero(campo(s, 'latitude'))
        const longitude = numero(campo(s, 'longitude'))
        if (latitude === null || longitude === null) return []
        return [
          {
            id: numero(campo(s, 'id')) ?? 0,
            reason: textoDe(campo(s, 'reason')) ?? '',
            latitude,
            longitude,
            mediaUrl: urlDaMidia(base, textoDe(campo(s, 'mediaUrl'))),
            createdAt: textoDe(campo(s, 'createdAt')) ?? '',
          },
        ]
      })
    },
    async chat(tripId: number): Promise<MensagemRastreador[]> {
      const l = await pedir<unknown[]>(`/api/trips/${tripId}/chat`)
      return (Array.isArray(l) ? l : []).map((m) => ({
        id: numero(campo(m, 'id')) ?? 0,
        sender: textoDe(campo(m, 'sender')) ?? '',
        text: textoDe(campo(m, 'text')),
        mediaUrl: urlDaMidia(base, textoDe(campo(m, 'mediaUrl'))),
        createdAt: textoDe(campo(m, 'createdAt')) ?? '',
      }))
    },
    enviarChat: (tripId: number, texto: string) =>
      pedir(`/api/trips/${tripId}/chat/internal`, { metodo: 'POST', corpo: { text: texto } }),
    cienteEmergencia: (tripId: number) =>
      pedir(`/api/trips/${tripId}/emergency/ack`, { metodo: 'POST' }),
  }
}

export type ClienteRastreador = ReturnType<typeof clienteDoRastreador>
