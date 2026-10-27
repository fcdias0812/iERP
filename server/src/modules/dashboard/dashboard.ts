import { Router } from 'express'
import { z } from 'zod'
import type { Db } from '../../db/database.js'
import { diaNoFuso, ehDia, inicioDoDia, somarDias } from '../../shared/datas.js'
import { cidadeDoEndereco } from '../../shared/endereco.js'
import { normalizar } from '../../shared/texto.js'
import type { StatusOrdem } from '../ordens/ordens.js'

/*
 * Operação › Dashboard — GET /api/dashboard/operacao?mapaDe=AAAA-MM-DD&mapaAte=AAAA-MM-DD
 *
 * Tudo calculado das ordens (lotes) e dos clientes do iERP:
 *  - SLA do cliente = prazo máximo (dias) da CHEGADA na Re-Teck (`recebidoEm`) até o COD;
 *  - "em processo" = etapas inspecao, processo e aguardando_cod;
 *  - vencido: dias decorridos > SLA; em risco: ≥ 80% do SLA usado e ainda no prazo;
 *  - cumprimento (30 dias): lotes com COD nos últimos 30 dias que fecharam dentro do SLA;
 *  - previsão de chegada: lotes agendados pela data da coleta (próximos 7 dias) — a data de coleta
 *    confirmada ou, sem ela, a coleta prevista (`confirmada` diz qual);
 *  - mapa: sites dos clientes "Microsoft" (pelo nome) com as coletas do período escolhido (mesma
 *    data), rotulados pela cidade do endereço.
 * Hoje as etapas depois de "agendado" ainda não são preenchidas (virão da integração com os
 * sistemas de produção): a maioria dos números fica zerada até lá.
 */

const DIA_MS = 86_400_000
export const RISCO_SLA = 0.8
export const META_CUMPRIMENTO = 0.95
const EM_PROCESSO: StatusOrdem[] = ['inspecao', 'processo', 'aguardando_cod']

export interface EtapasContagem {
  inspecao: number
  processo: number
  aguardandoCod: number
}

export interface DashboardOperacao {
  atualizadoEm: string
  hoje: string
  cards: {
    chegadasPrevistas7d: number
    emProcesso: EtapasContagem & { total: number }
    slaVencido: number
    slaEmRisco: number
    /** 0..1; null = nenhum lote com COD e SLA nos últimos 30 dias. */
    cumprimentoSla30d: number | null
    codPendente: number
  }
  /** Próximos 7 dias (a partir de hoje), com os lotes agendados pela data da coleta. */
  forecast: {
    dia: string
    lotes: {
      id: string
      codigo: string
      clienteNome: string
      siteCodigo: string
      /** Data de coleta confirmada? (senão, é a prevista — borda tracejada na tela) */
      confirmada: boolean
      pallets: number
      gaylords: number
      racks: number
      boxes: number
    }[]
  }[]
  mapa: {
    de: string
    ate: string
    /** Achou cliente com "Microsoft" no nome? */
    clienteEncontrado: boolean
    pontos: {
      siteId: string
      clienteId: string
      siteCodigo: string
      /** Cidade do endereço (null = endereço sem "– UF" no fim; a tela mostra o código). */
      cidade: string | null
      endereco: string | null
      latitude: number
      longitude: number
      coletas: number
    }[]
    /** Sites sem latitude/longitude (precisam do pino em Clientes › Logística). */
    semLocalizacao: { siteId: string; clienteId: string; siteCodigo: string }[]
  }
  porCliente: {
    clienteId: string
    clienteNome: string
    slaDias: number | null
    emProcesso: number
    etapas: EtapasContagem
    /** Média de dias desde a chegada dos lotes em processo. */
    diasDecorridos: number | null
    emRisco: number
    atrasados: number
    slaCumprido30d: number | null
    situacao: 'atrasado' | 'no_prazo' | 'sem_sla'
  }[]
  /** Lotes em processo, com as anomalias de prazo (a tela filtra "só anomalias"). */
  lotes: {
    id: string
    codigo: string
    clienteId: string
    clienteNome: string
    etapa: StatusOrdem
    recebidoEm: string | null
    etapaDesde: string | null
    diasNaEtapa: number | null
    diasDecorridos: number | null
    slaDias: number | null
    /** SLA − dias decorridos (negativo = atrasado). */
    restante: number | null
    anomalias: (
      | { tipo: 'atrasado'; dias: number }
      | { tipo: 'risco'; uso: number }
      // Parado na mesma etapa além do limite do cliente (aba Configurações).
      | { tipo: 'parado'; dias: number }
    )[]
  }[]
}

const consultaSchema = z.object({
  mapaDe: z.string().refine(ehDia).optional().catch(undefined),
  mapaAte: z.string().refine(ehDia).optional().catch(undefined),
})

/** Uma casa decimal. */
const umaCasa = (n: number) => Math.round(n * 10) / 10

export function criarServicoDashboard(db: Db) {
  return {
    async operacao(query: unknown, agora = new Date()): Promise<DashboardOperacao> {
      const q = consultaSchema.parse(query ?? {})
      const hoje = diaNoFuso(agora)
      // Semana de domingo a sábado (padrão do mapa) quando não vier período.
      const domingo = somarDias(hoje, -new Date(`${hoje}T12:00:00Z`).getUTCDay())
      const mapaDe = q.mapaDe ?? domingo
      const mapaAte = q.mapaAte && q.mapaAte >= mapaDe ? q.mapaAte : somarDias(mapaDe, 6)
      const limite30d = new Date(agora.getTime() - 30 * DIA_MS).toISOString()

      const [todosOsLotes, clientes] = await Promise.all([
        db
          .selectFrom('ordensLista')
          .select([
            'juntadoA',
            'id',
            'codigo',
            'status',
            'clienteId',
            'clienteNome',
            'clienteSlaDias',
            'clienteDiasParado',
            'siteCodigo',
            'dataColeta',
            'coletaPrevista',
            'recebidoEm',
            'etapaDesde',
            'codEmitidoEm',
            'qtdPallets',
            'qtdGaylords',
            'qtdRacks',
            'qtdBoxes',
          ])
          .where((eb) =>
            eb.or([eb('status', '<>', 'concluido'), eb('codEmitidoEm', '>=', limite30d)]),
          )
          .execute(),
        db
          .selectFrom('clientes')
          .select(['id', 'nome', 'slaDias'])
          .where('status', '=', 'ativo')
          .orderBy('nome')
          .execute(),
      ])
      // A mesma coleta é UM lote (22/10/2026): os juntados somam os volumes no principal.
      const principais = new Map(
        todosOsLotes.filter((l) => !l.juntadoA).map((l) => [l.id, { ...l }]),
      )
      for (const l of todosOsLotes) {
        const p = l.juntadoA ? principais.get(l.juntadoA) : undefined
        if (!p) continue
        for (const k of ['qtdPallets', 'qtdGaylords', 'qtdRacks', 'qtdBoxes'] as const)
          if (l[k] !== null) p[k] = (p[k] ?? 0) + l[k]
      }
      const lotes = [...principais.values()]

      const dias = (desde: string | null) =>
        desde ? umaCasa((agora.getTime() - Date.parse(desde)) / DIA_MS) : null

      /* ---------------- lotes em processo e anomalias */
      const emProcesso = lotes
        .filter((l) => EM_PROCESSO.includes(l.status as StatusOrdem))
        .map((l) => {
          const decorridos = dias(l.recebidoEm)
          const sla = l.clienteSlaDias
          const anomalias: DashboardOperacao['lotes'][number]['anomalias'] = []
          if (sla && decorridos !== null) {
            if (decorridos > sla)
              anomalias.push({ tipo: 'atrasado', dias: umaCasa(decorridos - sla) })
            else if (decorridos >= sla * RISCO_SLA)
              anomalias.push({ tipo: 'risco', uso: umaCasa(decorridos / sla) })
          }
          const naEtapa = dias(l.etapaDesde)
          if (l.clienteDiasParado && naEtapa !== null && naEtapa > l.clienteDiasParado)
            anomalias.push({ tipo: 'parado', dias: naEtapa })
          return {
            id: l.id,
            codigo: l.codigo,
            clienteId: l.clienteId,
            clienteNome: l.clienteNome,
            etapa: l.status as StatusOrdem,
            recebidoEm: l.recebidoEm,
            etapaDesde: l.etapaDesde,
            diasNaEtapa: naEtapa,
            diasDecorridos: decorridos,
            slaDias: sla,
            restante: sla && decorridos !== null ? umaCasa(sla - decorridos) : null,
            anomalias,
          }
        })
        // Mais grave primeiro: menor "restante".
        .sort((a, b) => (a.restante ?? Infinity) - (b.restante ?? Infinity))

      const contarEtapas = (l: { etapa: StatusOrdem }[]): EtapasContagem => ({
        inspecao: l.filter((x) => x.etapa === 'inspecao').length,
        processo: l.filter((x) => x.etapa === 'processo').length,
        aguardandoCod: l.filter((x) => x.etapa === 'aguardando_cod').length,
      })
      const atrasado = (l: (typeof emProcesso)[number]) =>
        l.anomalias.some((a) => a.tipo === 'atrasado')
      const emRisco = (l: (typeof emProcesso)[number]) =>
        l.anomalias.some((a) => a.tipo === 'risco')

      /* ---------------- cumprimento de SLA (30 dias) */
      const fechados = lotes.filter(
        (l) => l.status === 'concluido' && l.codEmitidoEm && l.recebidoEm && l.clienteSlaDias,
      )
      const noPrazo = (l: (typeof fechados)[number]) =>
        (Date.parse(l.codEmitidoEm!) - Date.parse(l.recebidoEm!)) / DIA_MS <= l.clienteSlaDias!
      const cumprimento = (l: typeof fechados) =>
        l.length ? l.filter(noPrazo).length / l.length : null

      /** Dia da coleta: a confirmada ou, sem ela, a prevista. */
      const diaDaColeta = (l: { dataColeta: string | null; coletaPrevista: string }) =>
        l.dataColeta ?? l.coletaPrevista

      /* ---------------- previsão de chegada (próximos 7 dias) */
      const forecast = Array.from({ length: 7 }, (_, i) => somarDias(hoje, i)).map((dia) => {
        const de = inicioDoDia(dia)
        const ate = inicioDoDia(somarDias(dia, 1))
        return {
          dia,
          lotes: lotes
            .filter((l) => l.status === 'agendado' && diaDaColeta(l) >= de && diaDaColeta(l) < ate)
            .map((l) => ({
              id: l.id,
              codigo: l.codigo,
              clienteNome: l.clienteNome,
              siteCodigo: l.siteCodigo,
              confirmada: l.dataColeta !== null,
              pallets: l.qtdPallets ?? 0,
              gaylords: l.qtdGaylords ?? 0,
              racks: l.qtdRacks ?? 0,
              boxes: l.qtdBoxes ?? 0,
            })),
        }
      })

      /* ---------------- mapa: sites dos clientes Microsoft */
      const microsoft = clientes.filter((c) => normalizar(c.nome).includes('microsoft'))
      const ids = microsoft.map((c) => c.id)
      const [sites, coletas] = ids.length
        ? await Promise.all([
            db
              .selectFrom('clientesSites')
              .select(['id', 'clienteId', 'codigo', 'endereco', 'latitude', 'longitude'])
              .where('clienteId', 'in', ids)
              .orderBy('codigo')
              .execute(),
            db
              .selectFrom('ordens')
              .select(['siteId', 'dataColeta', 'coletaPrevista'])
              .where('clienteId', 'in', ids)
              .execute(),
          ])
        : [[], []]
      const coletasPorSite = new Map<string, number>()
      const [mapaInicio, mapaFim] = [inicioDoDia(mapaDe), inicioDoDia(somarDias(mapaAte, 1))]
      for (const c of coletas)
        if (diaDaColeta(c) >= mapaInicio && diaDaColeta(c) < mapaFim)
          coletasPorSite.set(c.siteId, (coletasPorSite.get(c.siteId) ?? 0) + 1)

      /* ---------------- por cliente */
      const porCliente = clientes.map((c) => {
        const meus = emProcesso.filter((l) => l.clienteId === c.id)
        const comDias = meus.filter((l) => l.diasDecorridos !== null)
        const atrasados = meus.filter(atrasado).length
        return {
          clienteId: c.id,
          clienteNome: c.nome,
          slaDias: c.slaDias,
          emProcesso: meus.length,
          etapas: contarEtapas(meus),
          diasDecorridos: comDias.length
            ? umaCasa(comDias.reduce((s, l) => s + l.diasDecorridos!, 0) / comDias.length)
            : null,
          emRisco: meus.filter(emRisco).length,
          atrasados,
          slaCumprido30d: cumprimento(fechados.filter((l) => l.clienteId === c.id)),
          situacao: (atrasados
            ? 'atrasado'
            : c.slaDias
              ? 'no_prazo'
              : 'sem_sla') as DashboardOperacao['porCliente'][number]['situacao'],
        }
      })

      const etapas = contarEtapas(emProcesso)
      return {
        atualizadoEm: agora.toISOString(),
        hoje,
        cards: {
          chegadasPrevistas7d: forecast.reduce((s, d) => s + d.lotes.length, 0),
          emProcesso: { total: emProcesso.length, ...etapas },
          slaVencido: emProcesso.filter(atrasado).length,
          slaEmRisco: emProcesso.filter(emRisco).length,
          cumprimentoSla30d: cumprimento(fechados),
          codPendente: etapas.aguardandoCod,
        },
        forecast,
        mapa: {
          de: mapaDe,
          ate: mapaAte,
          clienteEncontrado: microsoft.length > 0,
          pontos: sites
            .filter((s) => s.latitude !== null && s.longitude !== null)
            .map((s) => ({
              siteId: s.id,
              clienteId: s.clienteId,
              siteCodigo: s.codigo,
              cidade: cidadeDoEndereco(s.endereco),
              endereco: s.endereco,
              latitude: s.latitude!,
              longitude: s.longitude!,
              coletas: coletasPorSite.get(s.id) ?? 0,
            })),
          semLocalizacao: sites
            .filter((s) => s.latitude === null || s.longitude === null)
            .map((s) => ({ siteId: s.id, clienteId: s.clienteId, siteCodigo: s.codigo })),
        },
        porCliente,
        lotes: emProcesso,
      }
    },
  }
}

export type ServicoDashboard = ReturnType<typeof criarServicoDashboard>

export function rotasDashboard(servico: ServicoDashboard) {
  const r = Router()
  r.get('/operacao', async (req, res) => {
    res.json(await servico.operacao(req.query))
  })
  return r
}
