import { format } from 'date-fns'
import { dayKey } from '@/components/data-table/engine'
import { isValidPlate } from '@/lib/validators/br'
import { z } from '@/lib/zod-i18n'
import type { Ordem, OrdemInput, QuantidadesOs, ServicosOs } from '@/services/types'

/*
 * Formulário do Agendamento (cria o lote). Mesmas regras do servidor
 * (server/src/modules/ordens/ordens.ts): cliente, site, doca e data de coleta obrigatórios; placas de
 * policarbonato só com Value Recovery (Racks); quantidade de pallets vazios quando "requer";
 * escopo de trabalho obrigatório — texto OU pelo menos um arquivo.
 */

/** Opção "nenhum" dos selects opcionais (transportadora, motorista). */
export const NENHUM = '__nenhum'

export const SERVICOS = [
  'psm',
  'onsiteShredding',
  'recycleOnly',
  'valueRecoveryRacks',
  'valueRecoveryItad',
] as const satisfies readonly (keyof ServicosOs)[]

export const QUANTIDADES = ['boxes', 'pallets', 'gaylords', 'racks'] as const

const qtd = z.number().int().min(0).max(100_000).nullable()
const arquivos = z.array(z.custom<File>((v) => v instanceof File))

/**
 * Regras do formulário. Na edição do lote os arquivos ficam na aba Documentos: o escopo vale com
 * o texto OU com um documento do tipo "escopo" já guardado (`temEscopoArquivado`).
 */
export const criarAgendamentoSchema = ({ temEscopoArquivado = false } = {}) =>
  z
    .object({
      clienteId: z.string().min(1, 'validation.required'),
      clienteNome: z.string(),
      siteId: z.string().min(1, 'validation.required'),
      docaId: z.string().min(1, 'validation.required'),
      transportadoraId: z.string(),
      referenciaCliente: z.string().trim().max(60),
      dataColeta: z
        .date()
        .optional()
        .refine((d) => d !== undefined, 'validation.required'),
      coletaPrevista: z.date().optional(),
      dataChegada: z.date().optional(),
      rastrear: z.boolean(),
      motoristaId: z.string(),
      placa: z.string(),
      servicos: z.object({
        psm: z.boolean(),
        onsiteShredding: z.boolean(),
        recycleOnly: z.boolean(),
        valueRecoveryRacks: z.boolean(),
        valueRecoveryItad: z.boolean(),
      }),
      quantidades: z.object({
        boxes: qtd,
        pallets: qtd,
        gaylords: qtd,
        racks: qtd,
        placasPolicarbonato: qtd,
        requerPalletsVazios: z.boolean(),
        palletsVazios: qtd,
        itensMais25kg: z.boolean(),
        fatorLimitante: z.string().trim().max(1000),
      }),
      escopo: z.string().trim().max(5000),
      escopoArquivos: arquivos,
      observacoes: z.string().trim().max(5000),
      observacoesArquivos: arquivos,
    })
    .superRefine((v, ctx) => {
      if (v.servicos.valueRecoveryRacks && v.quantidades.placasPolicarbonato === null)
        ctx.addIssue({
          code: 'custom',
          path: ['quantidades', 'placasPolicarbonato'],
          message: 'validation.required',
        })
      if (v.quantidades.requerPalletsVazios && !v.quantidades.palletsVazios)
        ctx.addIssue({
          code: 'custom',
          path: ['quantidades', 'palletsVazios'],
          message: 'validation.required',
        })
      if (!v.escopo && !v.escopoArquivos.length && !temEscopoArquivado)
        ctx.addIssue({ code: 'custom', path: ['escopo'], message: 'validation.scopeRequired' })
      if (v.rastrear && v.placa && !isValidPlate(v.placa))
        ctx.addIssue({ code: 'custom', path: ['placa'], message: 'validation.plate' })
    })

export const agendamentoSchema = criarAgendamentoSchema()

export type AgendamentoForm = z.input<typeof agendamentoSchema>

export const novoAgendamento = (): AgendamentoForm => ({
  clienteId: '',
  clienteNome: '',
  siteId: '',
  docaId: '',
  transportadoraId: NENHUM,
  referenciaCliente: '',
  dataColeta: undefined,
  coletaPrevista: undefined,
  dataChegada: undefined,
  rastrear: false,
  motoristaId: NENHUM,
  placa: '',
  // III e IV já vêm marcados: são os mais comuns.
  servicos: {
    psm: false,
    onsiteShredding: false,
    recycleOnly: true,
    valueRecoveryRacks: true,
    valueRecoveryItad: false,
  },
  quantidades: {
    boxes: null,
    pallets: null,
    gaylords: null,
    racks: null,
    placasPolicarbonato: null,
    requerPalletsVazios: false,
    palletsVazios: null,
    itensMais25kg: false,
    fatorLimitante: '',
  },
  escopo: '',
  escopoArquivos: [],
  observacoes: '',
  observacoesArquivos: [],
})

const dia = (d: Date | undefined) => (d ? format(d, 'yyyy-MM-dd') : null)
const opcional = (v: string) => (v === NENHUM || !v ? null : v)

/** Quantidades como a API espera (campos condicionais limpos). */
export function quantidadesParaApi(v: AgendamentoForm): QuantidadesOs {
  const q = v.quantidades
  return {
    boxes: q.boxes,
    pallets: q.pallets,
    gaylords: q.gaylords,
    racks: q.racks,
    placasPolicarbonato: v.servicos.valueRecoveryRacks ? q.placasPolicarbonato : null,
    requerPalletsVazios: q.requerPalletsVazios,
    palletsVazios: q.requerPalletsVazios ? q.palletsVazios : null,
    itensMais25kg: q.itensMais25kg,
    fatorLimitante: q.fatorLimitante.trim() || null,
  }
}

export function formParaInput(v: AgendamentoForm): OrdemInput {
  return {
    clienteId: v.clienteId,
    siteId: v.siteId,
    docaId: v.docaId,
    transportadoraId: opcional(v.transportadoraId),
    referenciaCliente: v.referenciaCliente.trim() || null,
    dataColeta: dia(v.dataColeta)!,
    coletaPrevista: dia(v.coletaPrevista),
    dataChegada: dia(v.dataChegada),
    rastrear: v.rastrear,
    motoristaId: v.rastrear ? opcional(v.motoristaId) : null,
    placa: v.rastrear && v.placa ? v.placa.toUpperCase() : null,
    servicos: v.servicos,
    quantidades: quantidadesParaApi(v),
    escopo: v.escopo.trim() || null,
    observacoes: v.observacoes.trim() || null,
  }
}

/** O que o cálculo usa (para saber se ele ficou desatualizado). */
export const chaveDoCalculo = (v: AgendamentoForm) =>
  JSON.stringify({ docaId: v.docaId, servicos: v.servicos, quantidades: quantidadesParaApi(v) })

/** Data guardada (início do dia em São Paulo, ISO) → Date local do seletor de data. */
function paraData(iso: string | null): Date | undefined {
  const k = iso ? dayKey(iso) : null
  if (!k) return undefined
  const [a, m, d] = k.split('-').map(Number)
  return new Date(a!, m! - 1, d!)
}

/** Lote existente → formulário (edição no detalhe do lote). */
export function ordemParaForm(o: Ordem): AgendamentoForm {
  const q = o.quantidades
  return {
    clienteId: o.clienteId,
    clienteNome: o.clienteNome,
    siteId: o.siteId,
    docaId: o.docaId,
    transportadoraId: o.transportadoraId ?? NENHUM,
    referenciaCliente: o.referenciaCliente ?? '',
    dataColeta: paraData(o.dataColeta),
    coletaPrevista: paraData(o.coletaPrevista),
    dataChegada: paraData(o.dataChegada),
    rastrear: o.rastrear,
    motoristaId: o.motoristaId ?? NENHUM,
    placa: o.placa ?? '',
    servicos: { ...o.servicos },
    quantidades: {
      boxes: q.boxes,
      pallets: q.pallets,
      gaylords: q.gaylords,
      racks: q.racks,
      placasPolicarbonato: q.placasPolicarbonato,
      requerPalletsVazios: q.requerPalletsVazios,
      palletsVazios: q.palletsVazios,
      itensMais25kg: q.itensMais25kg,
      fatorLimitante: q.fatorLimitante ?? '',
    },
    escopo: o.escopo ?? '',
    escopoArquivos: [],
    observacoes: o.observacoes ?? '',
    observacoesArquivos: [],
  }
}
