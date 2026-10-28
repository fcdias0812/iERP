import { z } from 'zod'
import type { Db } from '../../db/database.js'
import { diaNoFuso, inicioDoDia, somarDias } from '../../shared/datas.js'
import { naoEncontrado } from '../../shared/erros.js'
import { balancoDoLote } from '../integracao/balanco.js'
import type { StatusOrdem } from '../ordens/ordens.js'

/*
 * Painel do cliente na aba Visão geral (pedido do usuário, 27/10/2026: "a visão geral com
 * gráficos e dashboard individual de cada cliente"). Decisões dele: o painel É a Visão geral;
 * números + lotes por etapa, coletas e kg por mês, kg por material, prazo (SLA) e ocorrências;
 * período escolhido (30 ou 90 dias, 12 meses, tudo — começa em 12 meses); lotes de QUALQUER
 * origem (Gerenciamento e MSDC também). A mesma coleta conta uma vez (só o principal).
 *
 *   GET /api/clientes/:id/painel?periodo=30|90|365|tudo
 *
 * Regras (as mesmas do Dashboard da Operação):
 *  - "agora" (não depende do período): a chegar = agendados; em operação = inspeção, processo e
 *    aguardando COD;
 *  - lote do período = dia da coleta (a confirmada ou, sem ela, a prevista) dentro do período;
 *  - kg e pallets recebidos = pesagens dos pallets dos lotes RECEBIDOS no período;
 *  - concluídos e prazo = lotes com COD no período; no prazo = da chegada (`recebidoEm`) ao COD
 *    em até `slaDias` do cliente; tempo médio = a mesma conta, em dias;
 *  - kg por material = o balanço de massa dos lotes do período (hoje só vem do MoonShot);
 *  - ocorrências = as não canceladas, registradas no período, dos lotes do cliente.
 */

export const PERIODOS = ['30', '90', '365', 'tudo'] as const
export type PeriodoPainel = (typeof PERIODOS)[number]

const DIA_MS = 86_400_000
const EM_OPERACAO: StatusOrdem[] = ['inspecao', 'processo', 'aguardando_cod']
const ETAPAS: StatusOrdem[] = ['agendado', 'inspecao', 'processo', 'aguardando_cod', 'concluido']
/** "Tudo" mostra no máximo os últimos 24 meses no gráfico mensal (os números somam tudo). */
const MAX_MESES = 24

export interface PainelCliente {
  periodo: PeriodoPainel
  /** Primeiro dia do período (null = tudo). */
  desde: string | null
  agora: {
    aChegar: number
    emOperacao: number
    /** A próxima coleta agendada (dia), se houver. */
    proximaColeta: string | null
  }
  numeros: {
    /** Lotes com coleta no período (sem os cancelados). */
    lotes: number
    concluidos: number
    kgRecebidos: number
    palletsRecebidos: number
  }
  /** Os lotes do período pela etapa em que estão. */
  etapas: { etapa: StatusOrdem; lotes: number }[]
  /** Mês a mês (AAAA-MM): lotes pela coleta e kg pelo recebimento. */
  porMes: { mes: string; lotes: number; kg: number }[]
  /** Material apurado no balanço de massa (kg), do maior para o menor. */
  materiais: { codigo: string; rotulo: string; kg: number }[]
  prazo: {
    slaDias: number | null
    noPrazo: number
    foraDoPrazo: number
    /** 0..1; null = sem SLA ou nenhum lote concluído com chegada no período. */
    cumprimento: number | null
    /** Média de dias da chegada ao COD (lotes concluídos no período). */
    tempoMedioDias: number | null
    /** Em operação agora e já fora do prazo. */
    atrasadosAgora: number
  }
  ocorrencias: { categoria: string; total: number }[]
  /** Os lotes mexidos por último (até 5). */
  ultimos: { id: string; codigo: string; status: StatusOrdem; alteradoEm: string }[]
}

const consultaSchema = z.object({
  periodo: z.enum(PERIODOS).catch('365').default('365'),
})

const umaCasa = (n: number) => Math.round(n * 10) / 10
const mesDe = (iso: string) => diaNoFuso(new Date(iso)).slice(0, 7)

/** Os meses de `de` (AAAA-MM) até `ate`, inclusive. */
function meses(de: string, ate: string) {
  const lista: string[] = []
  let [a, m] = de.split('-').map(Number) as [number, number]
  const [aFim, mFim] = ate.split('-').map(Number) as [number, number]
  while (a < aFim || (a === aFim && m <= mFim)) {
    lista.push(`${a}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      a += 1
    }
  }
  return lista
}

export function criarServicoPainel(db: Db) {
  return {
    async painel(clienteId: string, query: unknown, agora = new Date()): Promise<PainelCliente> {
      const { periodo } = consultaSchema.parse(query ?? {})
      const cliente = await db
        .selectFrom('clientes')
        .select(['id', 'slaDias'])
        .where('id', '=', clienteId)
        .executeTakeFirst()
      if (!cliente) throw naoEncontrado('Cliente não encontrado.')

      const hoje = diaNoFuso(agora)
      const desde = periodo === 'tudo' ? null : somarDias(hoje, -Number(periodo) + 1)
      const inicio = desde ? inicioDoDia(desde) : null
      const noPeriodo = (iso: string | null) => Boolean(iso) && (!inicio || iso! >= inicio)

      // Só os lotes principais (a mesma coleta conta uma vez).
      const lotes = await db
        .selectFrom('ordensLista')
        .select([
          'id',
          'codigo',
          'status',
          'dataColeta',
          'coletaPrevista',
          'recebidoEm',
          'codEmitidoEm',
          'alteradoEm',
        ])
        .where('clienteId', '=', clienteId)
        .where('juntadoA', 'is', null)
        .execute()
      const validos = lotes.filter((l) => l.status !== 'cancelado')
      const diaDaColeta = (l: (typeof lotes)[number]) => l.dataColeta ?? l.coletaPrevista
      const doPeriodo = validos.filter((l) => noPeriodo(diaDaColeta(l)))
      const recebidos = validos.filter((l) => noPeriodo(l.recebidoEm))
      const concluidos = validos.filter(
        (l) => l.status === 'concluido' && noPeriodo(l.codEmitidoEm),
      )

      const ids = (l: { id: string }[]) => (l.length ? l.map((x) => x.id) : [''])
      const [pallets, ocorrencias, materiais] = await Promise.all([
        db
          .selectFrom('ordensPallets')
          .select(['ordemId', 'pesoKg'])
          .where('ordemId', 'in', ids(recebidos))
          .execute(),
        db
          .selectFrom('ordensOcorrencias')
          .select(['categoria', 'criadoEm'])
          .where('ordemId', 'in', ids(lotes))
          .where('status', '<>', 'cancelado')
          .execute(),
        Promise.all(doPeriodo.map((l) => balancoDoLote(db, l.id, l.status === 'concluido'))),
      ])

      /* ---------------- agora */
      const agendados = validos.filter((l) => l.status === 'agendado')
      const proximas = agendados
        .map((l) => diaNoFuso(new Date(diaDaColeta(l))))
        .filter((d) => d >= hoje)
        .sort()

      /* ---------------- kg por mês (pelo recebimento) e lotes por mês (pela coleta) */
      const recebidoDe = new Map(recebidos.map((l) => [l.id, l.recebidoEm!]))
      const kgPorMes = new Map<string, number>()
      let kgRecebidos = 0
      let palletsRecebidos = 0
      for (const p of pallets) {
        palletsRecebidos += 1
        if (p.pesoKg === null) continue
        kgRecebidos += p.pesoKg
        const mes = mesDe(recebidoDe.get(p.ordemId)!)
        kgPorMes.set(mes, (kgPorMes.get(mes) ?? 0) + p.pesoKg)
      }
      const lotesPorMes = new Map<string, number>()
      for (const l of doPeriodo) {
        const mes = mesDe(diaDaColeta(l))
        lotesPorMes.set(mes, (lotesPorMes.get(mes) ?? 0) + 1)
      }
      const mesAtual = hoje.slice(0, 7)
      const conhecidos = [...lotesPorMes.keys(), ...kgPorMes.keys()].filter((m) => m <= mesAtual)
      const primeiro = desde ? desde.slice(0, 7) : (conhecidos.sort()[0] ?? mesAtual)
      const porMes = meses(primeiro, mesAtual)
        .slice(-MAX_MESES)
        .map((mes) => ({
          mes,
          lotes: lotesPorMes.get(mes) ?? 0,
          kg: umaCasa(kgPorMes.get(mes) ?? 0),
        }))

      /* ---------------- material (balanço de massa) */
      const porMaterial = new Map<string, { codigo: string; rotulo: string; kg: number }>()
      for (const b of materiais)
        for (const c of b?.commodities ?? []) {
          const atual = porMaterial.get(c.codigo) ?? { codigo: c.codigo, rotulo: c.rotulo, kg: 0 }
          atual.kg += c.pesoKg
          porMaterial.set(c.codigo, atual)
        }

      /* ---------------- prazo */
      const sla = cliente.slaDias
      const dias = (de: string, ate: string) => (Date.parse(ate) - Date.parse(de)) / DIA_MS
      const fechados = concluidos.filter((l) => l.recebidoEm && l.codEmitidoEm)
      const duracoes = fechados.map((l) => dias(l.recebidoEm!, l.codEmitidoEm!))
      const noPrazo = sla ? duracoes.filter((d) => d <= sla).length : 0
      const emOperacao = validos.filter((l) => EM_OPERACAO.includes(l.status as StatusOrdem))
      const atrasadosAgora = sla
        ? emOperacao.filter((l) => l.recebidoEm && dias(l.recebidoEm, agora.toISOString()) > sla)
            .length
        : 0

      /* ---------------- ocorrências */
      const porCategoria = new Map<string, number>()
      for (const o of ocorrencias)
        if (noPeriodo(o.criadoEm))
          porCategoria.set(o.categoria, (porCategoria.get(o.categoria) ?? 0) + 1)

      return {
        periodo,
        desde,
        agora: {
          aChegar: agendados.length,
          emOperacao: emOperacao.length,
          proximaColeta: proximas[0] ?? null,
        },
        numeros: {
          lotes: doPeriodo.length,
          concluidos: concluidos.length,
          kgRecebidos: umaCasa(kgRecebidos),
          palletsRecebidos,
        },
        etapas: ETAPAS.map((etapa) => ({
          etapa,
          lotes: doPeriodo.filter((l) => l.status === etapa).length,
        })),
        porMes,
        materiais: [...porMaterial.values()]
          .map((m) => ({ ...m, kg: umaCasa(m.kg) }))
          .sort((a, b) => b.kg - a.kg),
        prazo: {
          slaDias: sla,
          noPrazo,
          foraDoPrazo: sla ? duracoes.length - noPrazo : 0,
          cumprimento: sla && duracoes.length ? noPrazo / duracoes.length : null,
          tempoMedioDias: duracoes.length
            ? umaCasa(duracoes.reduce((a, d) => a + d, 0) / duracoes.length)
            : null,
          atrasadosAgora,
        },
        ocorrencias: [...porCategoria.entries()]
          .map(([categoria, total]) => ({ categoria, total }))
          .sort((a, b) => b.total - a.total),
        ultimos: [...lotes]
          .sort((a, b) => b.alteradoEm.localeCompare(a.alteradoEm))
          .slice(0, 5)
          .map((l) => ({
            id: l.id,
            codigo: l.codigo,
            status: l.status as StatusOrdem,
            alteradoEm: l.alteradoEm,
          })),
      }
    },
  }
}

export type ServicoPainel = ReturnType<typeof criarServicoPainel>
