import { http, HttpResponse } from 'msw/http'
import type {
  MensagemViagem,
  PontoTrajeto,
  Viagem,
  ViagemDetalhe,
  ViagensResposta,
} from '@/services/types'
import { useSessionStore } from '@/stores/session-store'
import { apiError, simulateNetwork } from '../config'

/*
 * API SIMULADA de Ordens › Viagens (mesmo contrato de server/src/modules/viagens/viagens.ts):
 * uma viagem na rua (LOT-00002, com trajeto e uma parada), uma esperando o motorista (LOT-00003),
 * a de um lote do Gerenciamento (só para ver) e uma finalizada (LOT-00001, com replay).
 */

const RASTREADOR = 'https://rastreador.exemplo.com.br'
const agora = () => new Date().toISOString()
const minutos = (n: number) => new Date(Date.now() - n * 60_000).toISOString()

/** Um trajeto pela Marginal (pontos inventados, só para a demonstração). */
function trajeto(inicio: number, n: number): PontoTrajeto[] {
  return Array.from({ length: n }, (_, i) => ({
    latitude: -23.55 + i * 0.004,
    longitude: -46.7 + i * 0.006,
    velocidade: 12 + (i % 5),
    precisao: 5,
    em: minutos(inicio - i * 2),
  }))
}

const base = (extra: Partial<Viagem>): Viagem => ({
  id: 'v',
  ordemId: 'ord00001',
  loteCodigo: 'LOT-00001',
  origem: 'IERP',
  somenteLeitura: false,
  codigoRastreio: 'LOT-00001',
  clienteNome: 'TechNova Soluções Ltda',
  siteCodigo: 'DC-01',
  siteEndereco: null,
  siteLatitude: -23.5,
  siteLongitude: -46.6,
  dataColeta: `${new Date().toISOString().slice(0, 10)}T03:00:00.000Z`,
  coletaConfirmada: true,
  motoristaNome: 'João da Silva',
  placa: 'ABC1D23',
  status: 'aguardando_motorista',
  codigoChegada: '256471',
  linkMotorista: null,
  tripId: null,
  iniciadaEm: null,
  chegouEm: null,
  terminadaEm: null,
  finalizadaPor: null,
  posicao: null,
  totalPontos: 0,
  distanciaMetros: null,
  emergencia: null,
  ...extra,
})

const link = (codigo: string) =>
  `${RASTREADOR}/app/?os=${codigo}&client=TechNova+Solu%C3%A7%C3%B5es+Ltda&driver=Jo%C3%A3o+da+Silva&plate=ABC1D23`

interface Registro extends Viagem {
  trajeto: PontoTrajeto[]
  chat: MensagemViagem[]
}

let banco: Registro[] | null = null

/**
 * Demonstração do alarme: com `sessionStorage['ierp-mock-emergencia']`, a viagem na rua chega com
 * uma emergência sem ciência (os e2e ligam; sem isso o aviso apareceria em todas as telas).
 */
function emergenciaDeDemonstracao() {
  try {
    return globalThis.sessionStorage?.getItem('ierp-mock-emergencia') === '1'
  } catch {
    return false
  }
}

function db(): Registro[] {
  if (banco) return banco
  const naRua = trajeto(60, 25)
  const feita = trajeto(1500, 40)
  banco = [
    {
      ...base({
        id: 'vg00002',
        ordemId: 'ordvg002',
        loteCodigo: 'LOT-00002',
        codigoRastreio: 'LOT-00002',
        status: 'em_rota',
        codigoChegada: '481930',
        linkMotorista: link('LOT-00002'),
        tripId: 12,
        iniciadaEm: naRua[0]!.em,
        posicao: naRua.at(-1)!,
        totalPontos: naRua.length,
        emergencia: emergenciaDeDemonstracao()
          ? {
              tipo: 'assalto',
              em: minutos(3),
              latitude: naRua.at(-1)!.latitude,
              longitude: naRua.at(-1)!.longitude,
              cienteEm: null,
              cientePor: null,
            }
          : null,
      }),
      trajeto: naRua,
      chat: [
        {
          id: 1,
          remetente: 'motorista',
          texto: 'Saindo do cliente agora.',
          midiaUrl: null,
          em: minutos(20),
        },
      ],
    },
    {
      ...base({
        id: 'vg00003',
        ordemId: 'ordvg003',
        loteCodigo: 'LOT-00003',
        codigoRastreio: 'LOT-00003',
        motoristaNome: null,
        placa: null,
        codigoChegada: '730215',
        linkMotorista: `${RASTREADOR}/app/?os=LOT-00003&client=TechNova+Solu%C3%A7%C3%B5es+Ltda`,
        dataColeta: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) + 'T03:00:00.000Z',
      }),
      trajeto: [],
      chat: [],
    },
    {
      ...base({
        id: 'ext-31',
        ordemId: 'ordgp001',
        loteCodigo: 'LOT-00090',
        origem: 'GERENCIAMENTO',
        somenteLeitura: true,
        codigoRastreio: 'LOT-20260159',
        clienteNome: 'Ericsson',
        siteCodigo: 'SP-01',
        siteLatitude: -23.62,
        siteLongitude: -46.55,
        motoristaNome: 'Carlos Pereira',
        placa: 'XYZ9A88',
        status: 'em_rota',
        codigoChegada: null,
        tripId: 31,
        iniciadaEm: minutos(40),
        posicao: { latitude: -23.6, longitude: -46.58, velocidade: 15, em: minutos(1) },
        totalPontos: 18,
      }),
      trajeto: trajeto(40, 18).map((p) => ({
        ...p,
        latitude: p.latitude - 0.05,
        longitude: p.longitude + 0.1,
      })),
      chat: [],
    },
    {
      ...base({
        id: 'vg00001',
        status: 'finalizada',
        codigoChegada: '102938',
        tripId: 7,
        iniciadaEm: feita[0]!.em,
        chegouEm: feita.at(-1)!.em,
        terminadaEm: feita.at(-1)!.em,
        finalizadaPor: 'recebimento',
        posicao: feita.at(-1)!,
        totalPontos: feita.length,
        distanciaMetros: 18_400,
      }),
      trajeto: feita,
      chat: [],
    },
  ]
  return banco
}

const ABERTAS = ['aguardando_motorista', 'em_rota', 'chegou']

const resumo = (r: Registro): Viagem => {
  const v: Partial<Registro> = { ...r }
  delete v.trajeto
  delete v.chat
  return v as Viagem
}
const detalhe = (r: Registro): ViagemDetalhe => ({
  ...resumo(r),
  trajeto: r.trajeto,
  paradas: r.trajeto.length
    ? [
        {
          id: 1,
          motivo: 'Abastecimento',
          latitude: r.trajeto[Math.floor(r.trajeto.length / 2)]!.latitude,
          longitude: r.trajeto[Math.floor(r.trajeto.length / 2)]!.longitude,
          fotoUrl: null,
          em: r.trajeto[Math.floor(r.trajeto.length / 2)]!.em,
        },
      ]
    : [],
  rastreadorIndisponivel: false,
})

export const viagensHandlers = [
  http.get('*/api/viagens', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const situacao = new URL(request.url).searchParams.get('situacao') ?? 'abertas'
    const viagens = db()
      .filter((v) => (situacao === 'abertas') === ABERTAS.includes(v.status))
      .map(resumo)
    const r: ViagensResposta = {
      configurado: true,
      temTransito: false,
      viagens,
      erro: null,
      atualizadoEm: agora(),
    }
    return HttpResponse.json(r)
  }),
  http.get('*/api/viagens/mapa/pois', () =>
    HttpResponse.json([
      { latitude: -23.53, longitude: -46.66, tipo: 'posto', nome: 'Posto Marginal' },
      { latitude: -23.51, longitude: -46.62, tipo: 'balanca', nome: null },
    ]),
  ),
  http.get('*/api/viagens/lote/:ordemId', ({ params }) => {
    const r = db().find((v) => v.ordemId === params.ordemId)
    return HttpResponse.json(r ? resumo(r) : null)
  }),
  http.get('*/api/viagens/:id', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const r = db().find((v) => v.id === params.id)
    return r ? HttpResponse.json(detalhe(r)) : apiError(404, 'not_found', 'Viagem não encontrada.')
  }),
  http.get('*/api/viagens/:id/chat', ({ params }) => {
    const r = db().find((v) => v.id === params.id)
    return r ? HttpResponse.json(r.chat) : apiError(404, 'not_found', 'Viagem não encontrada.')
  }),
  http.post('*/api/viagens/:id/chat', async ({ request, params }) => {
    const r = db().find((v) => v.id === params.id)
    if (!r) return apiError(404, 'not_found', 'Viagem não encontrada.')
    if (r.somenteLeitura) return apiError(409, 'trip_read_only', 'Viagem de outro sistema.')
    const { texto } = (await request.json()) as { texto: string }
    if (!texto?.trim()) return apiError(422, 'validation', 'Escreva a mensagem.')
    r.chat.push({
      id: r.chat.length + 1,
      remetente: 'operador',
      texto: texto.trim(),
      midiaUrl: null,
      em: agora(),
    })
    return HttpResponse.json(r.chat, { status: 201 })
  }),
  http.post('*/api/viagens/:id/finalizar', ({ params }) => {
    const r = db().find((v) => v.id === params.id)
    if (!r) return apiError(404, 'not_found', 'Viagem não encontrada.')
    if (r.somenteLeitura) return apiError(409, 'trip_read_only', 'Viagem de outro sistema.')
    if (r.status !== 'em_rota' && r.status !== 'chegou')
      return apiError(409, 'trip_not_active', 'A viagem não está em andamento.')
    Object.assign(r, {
      status: 'finalizada',
      finalizadaPor: 'operador',
      terminadaEm: agora(),
      linkMotorista: null,
      distanciaMetros: 9_800,
    })
    return HttpResponse.json(detalhe(r))
  }),
  http.post('*/api/viagens/:id/emergencia/ciente', ({ params }) => {
    const r = db().find((v) => v.id === params.id)
    if (!r?.emergencia || r.emergencia.cienteEm)
      return apiError(409, 'no_emergency', 'Não há emergência esperando ciência.')
    r.emergencia = {
      ...r.emergencia,
      cienteEm: agora(),
      cientePor: useSessionStore.getState().user.name,
    }
    return HttpResponse.json(detalhe(r))
  }),
]
