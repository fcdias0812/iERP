import { format } from 'date-fns'
import { dayKey } from '@/components/data-table/engine'
import { z } from '@/lib/zod-i18n'
import { textoOriginal } from '@/lib/localized-text'
import type {
  FotoRecebimento,
  FotosRecebimento,
  InspecaoVisual,
  Ordem,
  RecebimentoInput,
} from '@/services/types'

/*
 * Formulário do recebimento — mesmas regras do servidor
 * (server/src/modules/ordens/ordens.recebimento.ts): lote, data (não futura) e inspeção visual
 * obrigatórios; avaria/outro pedem descrição; lacres e notas opcionais, mas cada um com número e
 * foto; pelo menos um pallet, cada um com peso bruto e foto (tara opcional, ≤ bruto).
 */

export const INSPECOES: InspecaoVisual[] = ['bom', 'avaria', 'outro']
export const MAX_FOTOS_ITEM = 5
export const MAX_FOTOS_GERAIS = 20
export const MAX_DESCRICAO = 2000

/** Fotos de um item: as já guardadas que ficam + as novas. */
export interface ValorFotos {
  manter: FotoRecebimento[]
  novas: File[]
}

export const fotosVazias = (): ValorFotos => ({ manter: [], novas: [] })

const fotos = z.object({
  manter: z.array(z.custom<FotoRecebimento>()),
  novas: z.array(z.custom<File>((v) => v instanceof File)),
})
const comFoto = fotos.refine(
  (f) => f.manter.length + f.novas.length > 0,
  'validation.photoRequired',
)

const item = z.object({
  id: z.string().optional(),
  numero: z.string().trim().min(1, 'validation.required').max(40),
  fotos: comFoto,
})

const pallet = z
  .object({
    id: z.string().optional(),
    pesoBruto: z
      .number()
      .max(100_000)
      .nullable()
      .refine((v) => v !== null && v > 0, 'validation.required'),
    tara: z.number().min(0).max(100_000).nullable(),
    conteudo: z.string().trim().max(200),
    fotos: comFoto,
  })
  .refine((p) => p.tara === null || p.pesoBruto === null || p.tara <= p.pesoBruto, {
    message: 'validation.tareGreater',
    path: ['tara'],
  })

/** Fim de hoje no horário do aparelho (a data escolhida não pode passar de hoje). */
const fimDeHoje = () => {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

export const recebimentoSchema = z
  .object({
    loteId: z.string().min(1, 'validation.required'),
    clienteNome: z.string(),
    dataRecebimento: z
      .date()
      .optional()
      .refine((d) => d !== undefined, 'validation.required')
      .refine((d) => !d || d <= fimDeHoje(), 'validation.futureDate'),
    inspecao: z.enum(['bom', 'avaria', 'outro'], { error: 'validation.required' }),
    descricao: z.string().trim().max(MAX_DESCRICAO),
    lacres: z.array(item),
    notas: z.array(item),
    pallets: z.array(pallet).min(1, 'validation.palletRequired'),
    fotosGerais: fotos,
  })
  .superRefine((v, ctx) => {
    if (v.inspecao !== 'bom' && !v.descricao)
      ctx.addIssue({ code: 'custom', path: ['descricao'], message: 'validation.required' })
  })

export type RecebimentoForm = z.input<typeof recebimentoSchema>

export const novoLacre = () => ({ numero: '', fotos: fotosVazias() })
export const novoPallet = () => ({
  pesoBruto: null,
  tara: null,
  conteudo: '',
  fotos: fotosVazias(),
})

/** Formulário vazio (receber) — a data de recebimento já vem com hoje. */
export const novoRecebimento = (lote?: Ordem): RecebimentoForm => ({
  loteId: lote?.id ?? '',
  clienteNome: lote?.clienteNome ?? '',
  dataRecebimento: new Date(),
  inspecao: undefined as unknown as InspecaoVisual,
  descricao: '',
  lacres: [],
  notas: [],
  pallets: [novoPallet()],
  fotosGerais: fotosVazias(),
})

/** Data guardada (início do dia em São Paulo, ISO) → Date local do seletor. */
function paraData(iso: string): Date | undefined {
  const k = dayKey(iso)
  if (!k) return undefined
  const [a, m, d] = k.split('-').map(Number)
  return new Date(a!, m! - 1, d!)
}

/** Lote já recebido → formulário (correção). */
export function recebimentoParaForm(o: Ordem): RecebimentoForm {
  const r = o.recebimento!
  return {
    loteId: o.id,
    clienteNome: o.clienteNome,
    dataRecebimento: paraData(r.dataRecebimento),
    inspecao: r.inspecao,
    descricao: r.inspecaoDescricao ? textoOriginal(r.inspecaoDescricao) : '',
    lacres: r.lacres.map((l) => ({
      id: l.id,
      numero: l.numero,
      fotos: { manter: l.fotos, novas: [] },
    })),
    notas: r.notas.map((n) => ({
      id: n.id,
      numero: n.numero,
      fotos: { manter: n.fotos, novas: [] },
    })),
    pallets: o.pallets
      .filter((p) => p.origem === 'iERP')
      .map((p) => ({
        id: p.id,
        pesoBruto: p.pesoKg,
        tara: p.taraKg,
        conteudo: p.conteudo ?? '',
        fotos: { manter: p.fotos, novas: [] },
      })),
    fotosGerais: { manter: r.fotosGerais, novas: [] },
  }
}

/** Formulário → dados da API + fotos novas por campo (`lacres.<i>`, `pallets.<i>`…). */
export function formParaEnvio(
  v: RecebimentoForm,
  inspecaoDescricao: RecebimentoInput['inspecaoDescricao'],
): { dados: RecebimentoInput; fotos: FotosRecebimento } {
  const fotos: FotosRecebimento = {}
  const ids = (f: ValorFotos) => f.manter.map((x) => x.id)
  const novas = (campo: string, f: ValorFotos) => {
    if (f.novas.length) fotos[campo] = f.novas
  }
  v.lacres.forEach((l, i) => novas(`lacres.${i}`, l.fotos))
  v.notas.forEach((n, i) => novas(`notas.${i}`, n.fotos))
  v.pallets.forEach((p, i) => novas(`pallets.${i}`, p.fotos))
  novas('gerais', v.fotosGerais)
  return {
    dados: {
      dataRecebimento: format(v.dataRecebimento!, 'yyyy-MM-dd'),
      inspecao: v.inspecao,
      inspecaoDescricao: v.inspecao === 'bom' ? null : inspecaoDescricao,
      lacres: v.lacres.map((l) => ({
        id: l.id,
        numero: l.numero.trim(),
        fotosManter: ids(l.fotos),
      })),
      notas: v.notas.map((n) => ({ id: n.id, numero: n.numero.trim(), fotosManter: ids(n.fotos) })),
      pallets: v.pallets.map((p) => ({
        id: p.id,
        pesoBruto: p.pesoBruto!,
        tara: p.tara,
        conteudo: p.conteudo.trim() || null,
        fotosManter: ids(p.fotos),
      })),
      fotosGeraisManter: ids(v.fotosGerais),
    },
    fotos,
  }
}
