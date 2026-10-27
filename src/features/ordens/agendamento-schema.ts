import { format } from 'date-fns'
import { dayKey } from '@/components/data-table/engine'
import { isValidPlate } from '@/lib/validators/br'
import { z } from '@/lib/zod-i18n'
import type {
  ConfiguracoesCliente,
  Ordem,
  OrdemInput,
  QuantidadesOs,
  ServicosOs,
} from '@/services/types'

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

/**
 * Um caminhão da coleta rastreada (22/10/2026: vários por lote). `viagemId`/`status` = caminhão
 * que já existe (edição): o que já saiu ou terminou não se muda por aqui.
 */
const caminhao = z.object({
  viagemId: z.string().optional(),
  status: z.string().optional(),
  motoristaId: z.string(),
  placa: z.string(),
})
export type CaminhaoForm = z.input<typeof caminhao>
export const novoCaminhao = (): CaminhaoForm => ({ motoristaId: NENHUM, placa: '' })
/** Caminhão que já saiu (ou terminou): só mostra. */
export const caminhaoTravado = (c: CaminhaoForm) =>
  Boolean(c.status && c.status !== 'aguardando_motorista')
const arquivos = z.array(z.custom<File>((v) => v instanceof File))

/**
 * Regras do formulário. Na edição do lote os arquivos ficam na aba Documentos: o escopo vale com
 * o texto OU com um documento do tipo "escopo" já guardado (`temEscopoArquivado`).
 * As regras da aba Configurações do cliente ficam em `errosDoCliente` (conferidas ao enviar).
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
      // Prevista obrigatória; data de coleta = a confirmada (opcional) — pedido de 19/10/2026.
      coletaPrevista: z
        .date()
        .optional()
        .refine((d) => d !== undefined, 'validation.required'),
      dataColeta: z.date().optional(),
      dataChegada: z.date().optional(),
      rastrear: z.boolean(),
      caminhoes: z.array(caminhao).max(20),
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
      if (v.rastrear)
        v.caminhoes.forEach((c, i) => {
          if (c.placa && !caminhaoTravado(c) && !isValidPlate(c.placa))
            ctx.addIssue({
              code: 'custom',
              path: ['caminhoes', i, 'placa'],
              message: 'validation.plate',
            })
        })
    })

export const agendamentoSchema = criarAgendamentoSchema()

export type AgendamentoForm = z.input<typeof agendamentoSchema>

/**
 * As regras da aba Configurações do cliente (22/10/2026), conferidas ao enviar — as mesmas do
 * servidor: bloqueio e planilha de escopo só no lote novo; motorista e placa na coleta rastreada.
 */
export function errosDoCliente(
  v: AgendamentoForm,
  r: ConfiguracoesCliente | undefined,
  { novo }: { novo: boolean },
): {
  campo: 'clienteId' | 'escopo' | `caminhoes.${number}.motoristaId` | `caminhoes.${number}.placa`
  mensagem: string
}[] {
  if (!r) return []
  const erros: ReturnType<typeof errosDoCliente> = []
  if (novo && r.agendamentoBloqueado)
    erros.push({ campo: 'clienteId', mensagem: 'validation.clientBlocked' })
  if (r.exigirMotoristaPlaca && v.rastrear)
    v.caminhoes.forEach((c, i) => {
      if (caminhaoTravado(c)) return
      if (c.motoristaId === NENHUM || !c.motoristaId)
        erros.push({ campo: `caminhoes.${i}.motoristaId`, mensagem: 'validation.required' })
      if (!c.placa) erros.push({ campo: `caminhoes.${i}.placa`, mensagem: 'validation.required' })
    })
  if (novo && r.exigirEscopoPlanilha && !v.escopoArquivos.some((f) => /\.xlsx$/i.test(f.name)))
    erros.push({ campo: 'escopo', mensagem: 'validation.scopeSpreadsheet' })
  return erros
}

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
  caminhoes: [novoCaminhao()],
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
    dataColeta: dia(v.dataColeta),
    coletaPrevista: dia(v.coletaPrevista)!,
    dataChegada: dia(v.dataChegada),
    rastrear: v.rastrear,
    ...caminhoesParaApi(v),
    servicos: v.servicos,
    quantidades: quantidadesParaApi(v),
    escopo: v.escopo.trim() || null,
    observacoes: v.observacoes.trim() || null,
  }
}

/** Os caminhões como a API espera; o primeiro também é o motorista/placa do lote. */
function caminhoesParaApi(v: AgendamentoForm) {
  const caminhoes = v.rastrear
    ? v.caminhoes.map((c) => ({
        motoristaId: opcional(c.motoristaId),
        placa: c.placa ? c.placa.toUpperCase() : null,
      }))
    : []
  return {
    motoristaId: caminhoes[0]?.motoristaId ?? null,
    placa: caminhoes[0]?.placa ?? null,
    caminhoes,
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
    caminhoes: o.caminhoes.length
      ? o.caminhoes.map((c) => ({
          viagemId: c.viagemId,
          status: c.status,
          motoristaId: c.motoristaId ?? NENHUM,
          placa: c.placa ?? '',
        }))
      : [{ motoristaId: o.motoristaId ?? NENHUM, placa: o.placa ?? '' }],
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
