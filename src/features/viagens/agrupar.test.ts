import { describe, expect, it } from 'vitest'
import type { Viagem } from '@/services/types'
import { agruparViagens, diaRelativo, diaSp } from './agrupar'

const viagem = (extra: Partial<Viagem>): Viagem => ({
  id: 'v',
  ordemId: 'o',
  numero: 1,
  origemGps: 'celular',
  rastreadorId: null,
  rastreadorAparelho: null,
  loteCodigo: 'LOT-00001',
  origem: 'IERP',
  somenteLeitura: false,
  codigoRastreio: 'LOT-00001',
  clienteNome: 'Microsoft',
  siteCodigo: null,
  siteEndereco: null,
  siteLatitude: null,
  siteLongitude: null,
  dataColeta: '2026-10-21T03:00:00.000Z',
  coletaConfirmada: true,
  motoristaNome: null,
  placa: null,
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

describe('viagens › grupos', () => {
  it('o dia da coleta é o de São Paulo (meia-noite de SP não vira o dia anterior)', () => {
    expect(diaSp('2026-10-21T03:00:00.000Z')).toBe('2026-10-21')
    expect(diaSp(null)).toBeNull()
  })

  it('hoje, amanhã e ontem pelo relógio de São Paulo', () => {
    const agora = new Date('2026-10-20T15:00:00Z')
    expect(diaRelativo('2026-10-20', agora)).toBe('hoje')
    expect(diaRelativo('2026-10-21', agora)).toBe('amanha')
    expect(diaRelativo('2026-10-19', agora)).toBe('ontem')
    expect(diaRelativo('2026-10-25', agora)).toBeNull()
  })

  it('por dia e cliente: dia mais próximo primeiro, sem data no fim, clientes em ordem', () => {
    const grupos = agruparViagens(
      [
        viagem({ id: 'a', clienteNome: 'Microsoft', dataColeta: '2026-10-22T03:00:00.000Z' }),
        viagem({ id: 'b', clienteNome: 'Dell', dataColeta: '2026-10-21T03:00:00.000Z' }),
        viagem({ id: 'c', clienteNome: 'Amazon', dataColeta: '2026-10-21T03:00:00.000Z' }),
        viagem({ id: 'd', clienteNome: 'Dell', dataColeta: null }),
      ],
      'diaCliente',
    )
    expect(grupos.map((g) => [g.dia, g.cliente])).toEqual([
      ['2026-10-21', 'Amazon'],
      ['2026-10-21', 'Dell'],
      ['2026-10-22', 'Microsoft'],
      [null, 'Dell'],
    ])
  })

  it('dentro do grupo: emergência sem ciência, quem chegou, quem está na rua, quem espera', () => {
    const [g] = agruparViagens(
      [
        viagem({ id: 'espera', loteCodigo: 'LOT-00001' }),
        viagem({ id: 'rua', loteCodigo: 'LOT-00002', status: 'em_rota' }),
        viagem({ id: 'chegou', loteCodigo: 'LOT-00003', status: 'chegou' }),
        viagem({
          id: 'sos',
          loteCodigo: 'LOT-00004',
          status: 'em_rota',
          emergencia: {
            tipo: 'assalto',
            em: '2026-10-20T15:00:00Z',
            latitude: null,
            longitude: null,
            cienteEm: null,
            cientePor: null,
          },
        }),
      ],
      'nenhum',
    )
    expect(g?.itens.map((v) => v.id)).toEqual(['sos', 'chegou', 'rua', 'espera'])
  })
})
