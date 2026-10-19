import { http, HttpResponse } from 'msw/http'
import type { DashboardOperacao, StatusOrdem } from '@/services/types'
import { simulateNetwork } from '../config'
import { getDb } from '../db'
import { ordensMock } from './ordens'

/*
 * API SIMULADA do dashboard da operação (mesmo contrato de server/src/modules/dashboard):
 * as mesmas regras do servidor, resumidas. Além dos lotes agendados na sessão, há alguns
 * lotes FICTÍCIOS em processo (no primeiro e no segundo cliente ativos) para as tabelas de
 * SLA e anomalias terem o que mostrar na demonstração e nos testes de tela.
 */

const DIA = 86_400_000
const EM_PROCESSO: StatusOrdem[] = ['inspecao', 'processo', 'aguardando_cod']
const umaCasa = (n: number) => Math.round(n * 10) / 10
const diaSP = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
const somar = (dia: string, n: number) =>
  new Date(Date.parse(`${dia}T12:00:00Z`) + n * DIA).toISOString().slice(0, 10)

interface LoteFicticio {
  id: string
  codigo: string
  clienteIdx: number
  status: StatusOrdem
  diasDesdeChegada: number
  codEmDias?: number
}

const FICTICIOS: LoteFicticio[] = [
  { id: 'dsh1', codigo: 'LOT-90001', clienteIdx: 0, status: 'processo', diasDesdeChegada: 20 },
  { id: 'dsh2', codigo: 'LOT-90002', clienteIdx: 0, status: 'inspecao', diasDesdeChegada: 13 },
  { id: 'dsh3', codigo: 'LOT-90003', clienteIdx: 0, status: 'aguardando_cod', diasDesdeChegada: 3 },
  { id: 'dsh4', codigo: 'LOT-90004', clienteIdx: 1, status: 'processo', diasDesdeChegada: 10 },
  {
    id: 'dsh5',
    codigo: 'LOT-90005',
    clienteIdx: 0,
    status: 'concluido',
    diasDesdeChegada: 12,
    codEmDias: 10,
  },
  {
    id: 'dsh6',
    codigo: 'LOT-90006',
    clienteIdx: 0,
    status: 'concluido',
    diasDesdeChegada: 25,
    codEmDias: 20,
  },
]

export const dashboardHandlers = [
  http.get('*/api/dashboard/operacao', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const url = new URL(request.url)
    const agora = new Date()
    const hoje = diaSP(agora)
    const domingo = somar(hoje, -new Date(`${hoje}T12:00:00Z`).getUTCDay())
    const de = url.searchParams.get('mapaDe') ?? domingo
    const ate = url.searchParams.get('mapaAte') ?? somar(de, 6)
    const db = getDb()
    const clientes = db.clientes.filter((c) => c.status === 'ativo')

    const ficticios = FICTICIOS.flatMap((f) => {
      const c = clientes[f.clienteIdx]
      if (!c) return []
      const recebido = agora.getTime() - f.diasDesdeChegada * DIA
      return [
        {
          ...f,
          cliente: c,
          recebidoEm: new Date(recebido).toISOString(),
          etapaDesde: new Date(agora.getTime() - DIA).toISOString(),
          codEmitidoEm: f.codEmDias ? new Date(recebido + f.codEmDias * DIA).toISOString() : null,
        },
      ]
    })

    const lotes: DashboardOperacao['lotes'] = ficticios
      .filter((l) => EM_PROCESSO.includes(l.status))
      .map((l) => {
        const dias = l.diasDesdeChegada
        const sla = l.cliente.slaDias
        const anomalias: DashboardOperacao['lotes'][number]['anomalias'] = []
        if (sla && dias > sla) anomalias.push({ tipo: 'atrasado', dias: umaCasa(dias - sla) })
        else if (sla && dias >= sla * 0.8)
          anomalias.push({ tipo: 'risco', uso: umaCasa(dias / sla) })
        return {
          id: l.id,
          codigo: l.codigo,
          clienteId: l.cliente.id,
          clienteNome: l.cliente.nome,
          etapa: l.status,
          recebidoEm: l.recebidoEm,
          etapaDesde: l.etapaDesde,
          diasNaEtapa: 1,
          diasDecorridos: dias,
          slaDias: sla,
          restante: sla ? umaCasa(sla - dias) : null,
          anomalias,
        }
      })
      .sort((a, b) => (a.restante ?? Infinity) - (b.restante ?? Infinity))

    const fechados = ficticios.filter((l) => l.status === 'concluido' && l.cliente.slaDias)
    const cumprimento = (l: typeof fechados) =>
      l.length ? l.filter((x) => x.codEmDias! <= x.cliente.slaDias!).length / l.length : null
    const etapas = (l: typeof lotes) => ({
      inspecao: l.filter((x) => x.etapa === 'inspecao').length,
      processo: l.filter((x) => x.etapa === 'processo').length,
      aguardandoCod: l.filter((x) => x.etapa === 'aguardando_cod').length,
    })

    const forecast = Array.from({ length: 7 }, (_, i) => somar(hoje, i)).map((dia) => ({
      dia,
      lotes: ordensMock()
        .filter(
          (o) => o.status === 'agendado' && (o.dataColeta ?? o.coletaPrevista).slice(0, 10) === dia,
        )
        .map((o) => ({
          id: o.id,
          codigo: o.codigo,
          clienteNome: o.clienteNome,
          siteCodigo: o.siteCodigo,
          confirmada: o.dataColeta !== null,
          pallets: o.quantidades.pallets ?? 0,
          gaylords: o.quantidades.gaylords ?? 0,
          racks: o.quantidades.racks ?? 0,
          boxes: o.quantidades.boxes ?? 0,
        })),
    }))

    const microsoft = clientes.filter((c) => c.nome.toLowerCase().includes('microsoft'))
    const sites = microsoft.flatMap((c) => db.sites[c.id] ?? [])
    const body: DashboardOperacao = {
      atualizadoEm: agora.toISOString(),
      hoje,
      cards: {
        chegadasPrevistas7d: forecast.reduce((s, d) => s + d.lotes.length, 0),
        emProcesso: { total: lotes.length, ...etapas(lotes) },
        slaVencido: lotes.filter((l) => l.anomalias.some((a) => a.tipo === 'atrasado')).length,
        slaEmRisco: lotes.filter((l) => l.anomalias.some((a) => a.tipo === 'risco')).length,
        cumprimentoSla30d: cumprimento(fechados),
        codPendente: lotes.filter((l) => l.etapa === 'aguardando_cod').length,
      },
      forecast,
      mapa: {
        de,
        ate,
        clienteEncontrado: microsoft.length > 0,
        pontos: sites
          .filter((s) => s.latitude !== null && s.longitude !== null)
          .map((s) => ({
            siteId: s.id,
            clienteId: microsoft[0]!.id,
            siteCodigo: s.codigo,
            cidade: s.endereco?.match(/,\s*([^,]+?)\s*[–-]\s*[A-Z]{2}$/)?.[1] ?? null,
            endereco: s.endereco,
            latitude: s.latitude!,
            longitude: s.longitude!,
            coletas: 0,
          })),
        semLocalizacao: sites
          .filter((s) => s.latitude === null || s.longitude === null)
          .map((s) => ({ siteId: s.id, clienteId: microsoft[0]!.id, siteCodigo: s.codigo })),
      },
      porCliente: clientes.map((c) => {
        const meus = lotes.filter((l) => l.clienteId === c.id)
        const atrasados = meus.filter((l) => l.anomalias.some((a) => a.tipo === 'atrasado')).length
        return {
          clienteId: c.id,
          clienteNome: c.nome,
          slaDias: c.slaDias,
          emProcesso: meus.length,
          etapas: etapas(meus),
          diasDecorridos: meus.length
            ? umaCasa(meus.reduce((s, l) => s + (l.diasDecorridos ?? 0), 0) / meus.length)
            : null,
          emRisco: meus.filter((l) => l.anomalias.some((a) => a.tipo === 'risco')).length,
          atrasados,
          slaCumprido30d: cumprimento(fechados.filter((l) => l.cliente.id === c.id)),
          situacao: atrasados ? 'atrasado' : c.slaDias ? 'no_prazo' : 'sem_sla',
        }
      }),
      lotes,
    }
    return HttpResponse.json(body)
  }),
]
