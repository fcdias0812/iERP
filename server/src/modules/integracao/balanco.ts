import type { Db } from '../../db/database.js'

/*
 * BALANÇO DE MASSA do lote, vindo do sistema de fora (Dell → MoonShot) — aba Progresso do lote
 * (pedido do usuário, 20/10/2026).
 *
 * O sistema de fora manda SÓ as medições (bruto, embalagem, lido, scrap) e a tolerância; quem
 * fecha a conta é o iERP (decisão dos dois lados, ver `BalanceReportService` no MoonShot):
 *
 *   entrada líquida = bruto − embalagem
 *   contabilizado   = lido + scrap triado
 *   diferença       = entrada líquida − contabilizado   (em kg e em % da entrada líquida)
 *
 * Fecha quando |diferença %| ≤ tolerância. Sem bruto e embalagem medidos não há conta (o
 * MoonShot manda `null` para "não medi" — e 0 seria medição). Enquanto o lote não foi
 * concluído, a conta é parcial: a embalagem só é pesada no fim.
 */

export type SituacaoBalanco = 'aguardando' | 'parcial' | 'fechado' | 'fora'

export interface CommodityBalanco {
  codigo: string
  rotulo: string
  pesoKg: number
}

export interface ContainerBalanco {
  codigo: string
  categoria: string | null
  categoriaRotulo: string | null
  /** `aberto` | `fechado` | `embarcado` (como o sistema de fora manda). */
  situacao: string
  brutoKg: number | null
  taraKg: number | null
  /** Peso DESTE lote no container (o bigbag junta vários lotes). */
  desteLoteKg: number
  destino: string | null
  fechadoEm: string | null
  embarcadoEm: string | null
}

export interface BalancoDeMassa {
  sistema: string
  /** Quando o iERP recebeu este retrato do balanço. */
  recebidoEm: string
  brutoKg: number | null
  embalagemKg: number | null
  lidoKg: number | null
  scrapRecebidoKg: number | null
  scrapTriadoKg: number | null
  toleranciaPercent: number | null
  pecasLidas: number
  pecasSemPeso: number
  foraDaLista: number
  liquidoKg: number | null
  contabilizadoKg: number | null
  diferencaKg: number | null
  diferencaPercent: number | null
  situacao: SituacaoBalanco
  commodities: CommodityBalanco[]
  containers: ContainerBalanco[]
}

const kg = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v !== 0 ? v : null
const inteiro = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)
const arred = (v: number) => Math.round(v * 1000) / 1000

/** A conta do balanço a partir das medições (exportada para os testes). */
export function fecharConta(
  m: Pick<
    BalancoDeMassa,
    'brutoKg' | 'embalagemKg' | 'lidoKg' | 'scrapTriadoKg' | 'toleranciaPercent'
  >,
  concluido: boolean,
) {
  if (m.brutoKg === null || m.embalagemKg === null)
    return {
      liquidoKg: null,
      contabilizadoKg: null,
      diferencaKg: null,
      diferencaPercent: null,
      situacao: 'aguardando' as SituacaoBalanco,
    }
  const liquidoKg = arred(m.brutoKg - m.embalagemKg)
  const contabilizadoKg = arred((m.lidoKg ?? 0) + (m.scrapTriadoKg ?? 0))
  const diferencaKg = arred(liquidoKg - contabilizadoKg)
  const diferencaPercent = liquidoKg === 0 ? null : (diferencaKg / liquidoKg) * 100
  const dentro =
    diferencaPercent !== null && Math.abs(diferencaPercent) <= (m.toleranciaPercent ?? 0)
  return {
    liquidoKg,
    contabilizadoKg,
    diferencaKg,
    diferencaPercent,
    situacao: (!concluido ? 'parcial' : dentro ? 'fechado' : 'fora') as SituacaoBalanco,
  }
}

/** O balanço de massa do lote (null = o sistema de fora ainda não mandou nenhum). */
export async function balancoDoLote(
  db: Db,
  ordemId: string,
  concluido: boolean,
): Promise<BalancoDeMassa | null> {
  const linha = await db
    .selectFrom('ordensBalancos')
    .select(['sistema', 'payload', 'recebidoEm'])
    .where('ordemId', '=', ordemId)
    .executeTakeFirst()
  if (!linha) return null
  let corpo: Record<string, unknown>
  try {
    corpo = JSON.parse(linha.payload) as Record<string, unknown>
  } catch {
    return null
  }
  const b = (corpo.balanco ?? {}) as Record<string, unknown>
  const medicoes = {
    brutoKg: kg(b.brutoRecebidoKg),
    embalagemKg: kg(b.embalagemKg),
    lidoKg: kg(b.lidoKg),
    scrapRecebidoKg: kg(b.scrapRecebidoKg),
    scrapTriadoKg: kg(b.scrapTriadoKg),
    toleranciaPercent: typeof b.toleranciaPercent === 'number' ? b.toleranciaPercent : null,
  }
  const lista = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : [])
  return {
    sistema: linha.sistema,
    recebidoEm: linha.recebidoEm,
    ...medicoes,
    pecasLidas: inteiro(b.pecasLidas),
    pecasSemPeso: inteiro(b.pecasSemPeso),
    foraDaLista: inteiro(b.foraDaLista),
    ...fecharConta(medicoes, concluido),
    commodities: lista(corpo.commodities)
      .filter((c) => texto(c.codigo) && typeof c.pesoKg === 'number')
      .map((c) => ({
        codigo: texto(c.codigo)!,
        rotulo: texto(c.rotulo) ?? texto(c.codigo)!,
        pesoKg: c.pesoKg as number,
      })),
    containers: lista(corpo.containers)
      .filter((c) => texto(c.codigo))
      .map((c) => ({
        codigo: texto(c.codigo)!,
        categoria: texto(c.categoria),
        categoriaRotulo: texto(c.categoriaRotulo),
        situacao: texto(c.situacao) ?? 'aberto',
        brutoKg: kg(c.brutoKg),
        taraKg: kg(c.taraKg),
        desteLoteKg: inteiro(c.desteLoteKg),
        destino: texto(c.destino),
        fechadoEm: texto(c.fechadoEm),
        embarcadoEm: texto(c.embarcadoEm),
      })),
  }
}
