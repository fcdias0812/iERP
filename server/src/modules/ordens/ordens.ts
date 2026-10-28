import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Router } from 'express'
import { sql, type Transaction } from 'kysely'
import multer from 'multer'
import { z } from 'zod'
import type { Db } from '../../db/database.js'
import type { Database } from '../../db/schema.js'
import { EXTENSOES, extensaoDe, MAX_BYTES, nomeSeguro } from '../../shared/arquivos.js'
import { configuracoesDoCliente } from '../clientes/clientes-configuracoes.js'
import { coletaDe, juntadosA, reagruparColetas, unirMesmaPlaca } from './coleta.js'
import { zipSync } from 'fflate'
import { tiposDoCliente, type TipoDoCliente } from '../clientes/tipos-documento.js'
import { gerarPdfDaOs, gerarPlanilhaDoRelatorio } from './relatorio-final.js'
import { autorDa } from '../../shared/autor.js'
import { codigoCom, proximoNumero } from '../../shared/cadastro.js'
import {
  lerConsulta,
  ordemDaConsulta,
  whereDaConsulta,
  type ColunaConsulta,
} from '../../shared/consulta-tabela.js'
import { diaNoFuso, ehDia, inicioDoDia } from '../../shared/datas.js'
import { ErroApi, naoEncontrado } from '../../shared/erros.js'
import type { EventoHistorico, Mudanca } from '../../shared/historico.js'
import { listarHistorico, registrarHistorico } from '../../shared/historico.repositorio.js'
import { normalizar } from '../../shared/texto.js'
import { balancoDoLote, type BalancoDeMassa } from '../integracao/balanco.js'
import { enfileirarAviso } from '../integracao/sincronizacao.js'
import { dadosExternos, type DadosExternos } from '../integracao/gerenciamento.js'
import { garantirLoteDaqui } from './externo.js'
import { caminhaoSchema, type ServicoViagens } from '../viagens/viagens.js'
import {
  calcularOs,
  SemVeiculoError,
  type ResultadoCalculo,
  type ServicosOs,
} from './ordens.calculo.js'
import {
  criarServicoLote,
  rotasLote,
  type EtapaLote,
  type OcorrenciaLote,
  type PalletLote,
} from './ordens.lote.js'
import {
  criarServicoRecebimento,
  rotasRecebimento,
  type RecebimentoLote,
} from './ordens.recebimento.js'

/*
 * Ordens › Agendamento: cada ordem é um LOTE agendado (LOT-00001).
 *   GET  /api/ordens               lista (formato do DataTable)
 *   GET  /api/ordens/:id           detalhe (com anexos, cálculo e histórico)
 *   POST /api/ordens/pre-calculo   pré-calcula (não grava nada)
 *   POST /api/ordens               cria — multipart: `dados` (JSON) + arquivos `escopo` e
 *                                  `observacoes` (até 20 cada, 25 MB por arquivo)
 *   GET  /api/ordens/:id/anexos/:anexoId/arquivo   baixa (sempre como anexo)
 *   PUT  /api/ordens/:id           edita o lote (só enquanto agendado; o cliente não muda) e refaz
 *                                  o pré-cálculo
 *   POST /api/ordens/:id/anexos    adiciona documentos ao lote (multipart `tipo` + `arquivos`)
 *   DELETE /api/ordens/:id/anexos/:anexoId   remove um documento (fica no histórico)
 *   …/ocorrencias, …/pallets   detalhe do lote (ordens.lote.ts)
 *
 * Regras: cliente, site (do cliente), doca (do site) e data de coleta obrigatórios; o resto opcional.
 * Placas de policarbonato obrigatórias só com Value Recovery (Racks); quantidade de pallets
 * vazios obrigatória só quando "requer pallets vazios". Motorista e placa só valem com rastreio.
 * Escopo de trabalho obrigatório: texto OU pelo menos um arquivo.
 */

/* ------------------------------------------------------------ contrato (espelho de src/services/types.ts) */

/**
 * Etapas do lote: agendado → inspecao (recebido) → processo → aguardando_cod → concluido
 * (COD emitido). Hoje só o Agendamento cria (agendado); as outras virão da integração.
 */
export const ETAPAS = ['agendado', 'inspecao', 'processo', 'aguardando_cod', 'concluido'] as const
/**
 * Status do lote: as etapas e, fora do fluxo, CANCELADO (lote de um sistema de fora cancelado lá —
 * Gerenciamento de Projetos, 20/10/2026; aqui nenhum lote é cancelado pela tela).
 */
export const STATUS_LOTE = [...ETAPAS, 'cancelado'] as const
export type StatusOrdem = (typeof STATUS_LOTE)[number]
/** Ordem do fluxo (= flowOrder do statusMap do frontend). */
export const ORDEM_ETAPAS: Record<StatusOrdem, number> = {
  agendado: 65,
  inspecao: 66,
  processo: 67,
  aguardando_cod: 68,
  concluido: 110,
  cancelado: 400,
}
/** escopo/observacoes = enviados no agendamento; lote = adicionados depois, na aba Documentos. */
export type SecaoAnexo = 'escopo' | 'observacoes' | 'lote'

/**
 * Tipo de documento do lote: um código do catálogo `tipos_documento` (os do sistema — escopo,
 * nota_fiscal, mtr, cdf, foto, outro — e os criados na aba Configurações do cliente, 22/10/2026).
 */
export type TipoDocumentoLote = string

export interface AnexoOrdem {
  id: string
  /** O lote onde o arquivo está (só nos de um lote JUNTADO a este). */
  ordemId?: string
  loteCodigo?: string
  secao: SecaoAnexo
  tipo: TipoDocumentoLote
  nome: string
  extensao: string
  tamanho: number
  enviadoEm: string
  enviadoPor: string
}

export interface OrdemResumo {
  id: string
  codigo: string
  status: StatusOrdem
  clienteId: string
  clienteNome: string
  siteCodigo: string
  docaNumero: string
  transportadoraNome: string | null
  referenciaCliente: string | null
  /** Data de coleta confirmada (null = só a prevista). */
  dataColeta: string | null
  coletaPrevista: string
  dataChegada: string | null
  rastrear: boolean
  motoristaNome: string | null
  placa: string | null
  servicos: ServicosOs
  totalVolumes: number
  /** Chegada na Re-Teck (início do SLA). */
  recebidoEm: string | null
  /** Entrou na etapa atual. */
  etapaDesde: string | null
  codEmitidoEm: string | null
  criadoEm: string
  /** Andamento num sistema de fora (MoonShot): "Processamento 2/4 · Leitura das peças". */
  processamento: ProcessamentoExterno | null
  /** O sistema de fora pediu a correção do recebimento (null = nada pendente). */
  devolucao: DevolucaoAoRecebimento | null
  /** Lote que nasceu num sistema de fora e só é alterado lá (null = agendado aqui). */
  externo: LoteExterno | null
}

export interface LoteExterno {
  /** Código do sistema (GERENCIAMENTO). */
  sistema: string
  /** Tela da ordem no sistema de fora. */
  url: string | null
}

export interface ProcessamentoExterno {
  sistema: string
  etapa: string | null
  indice: number | null
  total: number | null
  desde: string | null
  /** Tela do lote no sistema de fora. */
  url: string | null
  atualizadoEm: string | null
}

export interface DevolucaoAoRecebimento {
  motivo: string | null
  pedidoPor: string | null
  em: string
}

/** As quantidades do agendamento. */
export interface QuantidadesOs {
  boxes: number | null
  pallets: number | null
  gaylords: number | null
  racks: number | null
  placasPolicarbonato: number | null
  requerPalletsVazios: boolean
  palletsVazios: number | null
  itensMais25kg: boolean
  fatorLimitante: string | null
}

/** Um lote juntado ao principal (mesma coleta — 22/10/2026). */
export interface LoteJuntado {
  id: string
  codigo: string
  /** IERP ou o sistema de onde veio (GERENCIAMENTO, MSDC). */
  origem: string
  /** O lote no sistema de lá (Gerenciamento/MSDC). */
  url: string | null
  status: StatusOrdem
  referenciaCliente: string | null
  totalVolumes: number
  escopo: string | null
  observacoes: string | null
}

/** A coleta inteira (o principal + os juntados), para mostrar. */
export interface ColetaSomada {
  quantidades: QuantidadesOs
  servicos: ServicosOs
  totalVolumes: number
}

export interface CaminhaoLote {
  viagemId: string
  numero: number
  motoristaId: string | null
  placa: string | null
  /** A situação da viagem (aguardando_motorista, em_rota, chegou, finalizada). */
  status: string
}

export interface Ordem extends OrdemResumo {
  /** Os caminhões da coleta (uma viagem cada; 22/10/2026). */
  caminhoes: CaminhaoLote[]
  /** Este lote foi juntado a outro (a tela abre o principal). */
  juntadoA: { id: string; codigo: string } | null
  /** Os lotes juntados a este (a mesma coleta). */
  juntados: LoteJuntado[]
  /** A coleta inteira somada (null = sem juntados; as quantidades acima são só deste lote). */
  coleta: ColetaSomada | null
  siteId: string
  docaId: string
  transportadoraId: string | null
  motoristaId: string | null
  quantidades: QuantidadesOs
  escopo: string | null
  observacoes: string | null
  anexos: AnexoOrdem[]
  calculo: ResultadoCalculo | null
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
  historico: EventoHistorico[]
  /** Linha do tempo: etapas por onde o lote passou (a primeira é "agendado"). */
  etapas: EtapaLote[]
  /** Pallets recebidos (integração / Operação › Recebimento). */
  pallets: PalletLote[]
  /** Ocorrências (mais recente primeiro). */
  ocorrencias: OcorrenciaLote[]
  /** Recebimento (Operação › Recebimento); null = ainda não recebido. */
  recebimento: RecebimentoLote | null
  /** Balanço de massa mandado pelo sistema de fora (MoonShot); null = ainda nenhum. */
  balanco: BalancoDeMassa | null
  /** O que o sistema de onde o lote veio disse da ordem (só para mostrar). */
  externoDados: DadosExternos | null
}

/* ------------------------------------------------------------ regras */

const PLACA = /^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/
const MAX_ARQUIVOS = 20

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null)

const qtd = z
  .number()
  .int('Quantidade deve ser um número inteiro.')
  .min(0)
  .max(100_000)
  .nullish()
  .transform((v) => v ?? null)

const dia = z
  .string()
  .nullish()
  .transform((v) => v || null)
  .refine((v) => v === null || ehDia(v), 'Data inválida (use AAAA-MM-DD).')

export const servicosSchema = z.object({
  psm: z.boolean().default(false),
  onsiteShredding: z.boolean().default(false),
  recycleOnly: z.boolean().default(false),
  valueRecoveryRacks: z.boolean().default(false),
  valueRecoveryItad: z.boolean().default(false),
})

export const quantidadesSchema = z.object({
  boxes: qtd,
  pallets: qtd,
  gaylords: qtd,
  racks: qtd,
  placasPolicarbonato: qtd,
  requerPalletsVazios: z.boolean().default(false),
  palletsVazios: qtd,
  itensMais25kg: z.boolean().default(false),
  fatorLimitante: textoOpcional(1000),
})

export const ordemInputSchema = z
  .object({
    clienteId: z.string().min(1, 'Escolha o cliente.'),
    siteId: z.string().min(1, 'Escolha o site.'),
    docaId: z.string().min(1, 'Escolha a doca.'),
    transportadoraId: textoOpcional(60),
    referenciaCliente: textoOpcional(60),
    // Prevista obrigatória; a data de coleta é a confirmada (opcional) — pedido de 19/10/2026.
    coletaPrevista: z
      .string({ error: 'Informe a coleta prevista.' })
      .refine(ehDia, 'Informe a coleta prevista (AAAA-MM-DD).'),
    dataColeta: dia,
    dataChegada: dia,
    rastrear: z.boolean().default(false),
    motoristaId: textoOpcional(60),
    placa: z
      .string()
      .nullish()
      .transform((v) => (v ? v.replace(/[^0-9a-z]/gi, '').toUpperCase() : null))
      .refine((v) => v === null || PLACA.test(v), 'Placa inválida.'),
    /**
     * Os caminhões da coleta rastreada (22/10/2026: "vários caminhões podem ir fazer essa viagem
     * ao mesmo tempo") — um por viagem. Sem a lista, vale o motorista/placa acima (um caminhão).
     */
    caminhoes: z.array(caminhaoSchema).max(20).optional(),
    servicos: servicosSchema,
    quantidades: quantidadesSchema,
    escopo: textoOpcional(5000),
    observacoes: textoOpcional(5000),
  })
  // A lista de caminhões manda: o primeiro é o motorista/placa do lote. Sem rastreio, nenhum.
  .transform((v) => {
    const caminhoes = !v.rastrear
      ? []
      : v.caminhoes?.length
        ? v.caminhoes
        : [{ motoristaId: v.motoristaId, placa: v.placa }]
    return {
      ...v,
      caminhoes,
      motoristaId: caminhoes[0]?.motoristaId ?? null,
      placa: caminhoes[0]?.placa ?? null,
    }
  })
  .superRefine((v, ctx) => {
    if (v.servicos.valueRecoveryRacks && v.quantidades.placasPolicarbonato === null)
      ctx.addIssue({
        code: 'custom',
        path: ['quantidades', 'placasPolicarbonato'],
        message: 'Informe as placas de policarbonato necessárias.',
      })
    if (v.quantidades.requerPalletsVazios && !v.quantidades.palletsVazios)
      ctx.addIssue({
        code: 'custom',
        path: ['quantidades', 'palletsVazios'],
        message: 'Informe a quantidade de pallets vazios.',
      })
  })

export type OrdemInput = z.output<typeof ordemInputSchema>

export const preCalculoSchema = z.object({
  docaId: z.string().min(1, 'Escolha a doca — o cálculo depende das restrições dela.'),
  servicos: servicosSchema,
  quantidades: quantidadesSchema,
})

export const COLUNAS_ORDEM: ColunaConsulta[] = [
  { id: 'codigo', tipo: 'unique-text' },
  { id: 'clienteNome', tipo: 'unique-text' },
  { id: 'siteCodigo', tipo: 'unique-text' },
  { id: 'docaNumero', tipo: 'unique-text' },
  { id: 'referenciaCliente', tipo: 'unique-text' },
  { id: 'transportadoraNome', tipo: 'unique-text' },
  { id: 'dataColeta', tipo: 'date' },
  { id: 'coletaPrevista', tipo: 'date' },
  { id: 'dataChegada', tipo: 'date' },
  { id: 'rastrear', tipo: 'boolean' },
  { id: 'totalVolumes', tipo: 'number' },
  { id: 'status', tipo: 'status', ordem: ORDEM_ETAPAS },
  { id: 'recebidoEm', tipo: 'date' },
  { id: 'criadoEm', tipo: 'date' },
  // IERP ou o sistema de onde o lote veio (Recebimento mostra só os agendados aqui).
  { id: 'origem', tipo: 'enum' },
]

/* ------------------------------------------------------------ serviço */

type Linha = NonNullable<Awaited<ReturnType<typeof linhaDe>>>
const linhaDe = (db: Db, id: string) =>
  db.selectFrom('ordensLista').selectAll().where('id', '=', id).executeTakeFirst()

const sim = (v: number) => v === 1

/** Serviços marcados em números romanos (I a V), como no formulário — para o histórico. */
const ROMANOS: [keyof ServicosOs, string][] = [
  ['psm', 'I'],
  ['onsiteShredding', 'II'],
  ['recycleOnly', 'III'],
  ['valueRecoveryRacks', 'IV'],
  ['valueRecoveryItad', 'V'],
]
const romanos = (s: ServicosOs) =>
  ROMANOS.filter(([k]) => s[k])
    .map(([, r]) => r)
    .join(' · ') || null

const paraResumo = (l: Linha): OrdemResumo => ({
  id: l.id,
  codigo: l.codigo,
  status: l.status as StatusOrdem,
  clienteId: l.clienteId,
  clienteNome: l.clienteNome,
  siteCodigo: l.siteCodigo,
  docaNumero: l.docaNumero,
  transportadoraNome: l.transportadoraNome,
  referenciaCliente: l.referenciaCliente,
  dataColeta: l.dataColeta,
  coletaPrevista: l.coletaPrevista,
  dataChegada: l.dataChegada,
  rastrear: sim(l.rastrear),
  motoristaNome: l.motoristaNome,
  placa: l.placa,
  servicos: {
    psm: sim(l.psm),
    onsiteShredding: sim(l.onsiteShredding),
    recycleOnly: sim(l.recycleOnly),
    valueRecoveryRacks: sim(l.valueRecoveryRacks),
    valueRecoveryItad: sim(l.valueRecoveryItad),
  },
  totalVolumes: Number(l.totalVolumes),
  recebidoEm: l.recebidoEm,
  etapaDesde: l.etapaDesde,
  codEmitidoEm: l.codEmitidoEm,
  criadoEm: l.criadoEm,
  processamento: l.processamentoSistema
    ? {
        sistema: l.processamentoSistema,
        etapa: l.processamentoEtapa,
        indice: l.processamentoIndice,
        total: l.processamentoTotal,
        desde: l.processamentoDesde,
        url: l.processamentoUrl,
        atualizadoEm: l.processamentoAtualizadoEm,
      }
    : null,
  devolucao: l.devolucaoEm
    ? { motivo: l.devolucaoMotivo, pedidoPor: l.devolucaoPedidoPor, em: l.devolucaoEm }
    : null,
  externo: l.externoSistema ? { sistema: l.externoSistema, url: l.processamentoUrl } : null,
})

export interface ArquivoEnviado {
  nomeOriginal: string
  conteudo: Buffer
}

/**
 * Próximo número de anexo (sequência única de todos os lotes). O contrato de integração
 * identifica o anexo por número — o id aqui é UUID.
 */
export async function proximoNumeroAnexo(cx: Db | Transaction<Database>): Promise<number> {
  const r = await cx
    .selectFrom('ordensAnexos')
    .select(sql<number | null>`max(numero)`.as('n'))
    .executeTakeFirst()
  return Number(r?.n ?? 0) + 1
}

/**
 * Os caminhões do lote (as viagens que não foram canceladas), na ordem. Um caminhão pode ter mais
 * de um rastreador (28/10/2026): as viagens do mesmo número são o mesmo caminhão — vale a que já
 * saiu (o caminhão fica travado na edição) ou, senão, a primeira.
 */
export async function caminhoesDoLote(db: Db | Transaction<Database>, ordemId: string) {
  const l = await db
    .selectFrom('ordensViagens')
    .select(['id', 'numero', 'motoristaId', 'placaInformada', 'status'])
    .where('ordemId', '=', ordemId)
    .where('status', '<>', 'cancelada')
    .orderBy('numero')
    .orderBy('criadoEm')
    .execute()
  const porNumero = new Map<number, (typeof l)[number]>()
  for (const v of l) {
    const atual = porNumero.get(v.numero)
    if (!atual || (atual.status === 'aguardando_motorista' && v.status !== 'aguardando_motorista'))
      porNumero.set(v.numero, v)
  }
  return [...porNumero.values()].map((v) => ({
    viagemId: v.id,
    numero: v.numero,
    motoristaId: v.motoristaId,
    placa: v.placaInformada,
    status: v.status,
  }))
}

/** Os tipos de documento do sistema, em português (PDF e ZIP). */
const NOME_DO_TIPO: Record<string, string> = {
  escopo: 'Escopo',
  nota_fiscal: 'Nota fiscal',
  mtr: 'MTR',
  cdf: 'CDF',
  foto: 'Foto',
  outro: 'Outro',
}

export function criarServicoOrdens(
  db: Db,
  opcoes: {
    pasta: string
    /** Ordens › Viagens: a viagem nasce com o rastreio e termina no recebimento. */
    viagens?: Pick<ServicoViagens, 'aoMudarRastreio' | 'antesDeDesligar' | 'doLote'>
  },
) {
  const caminho = (ordemId: string, anexoId: string) =>
    path.join(opcoes.pasta, 'ordens', ordemId, anexoId)
  const lote = criarServicoLote(db, opcoes)
  // Receber não mexe nas viagens (22/10/2026: "cada uma por si").
  const recebimento = criarServicoRecebimento(db, { pasta: opcoes.pasta })

  /**
   * Documento entrou ou saiu de um lote JÁ RECEBIDO: o sistema de fora do cliente (Dell →
   * MoonShot) relê o lote. É o caminho da planilha da Dell anexada depois do recebimento —
   * sem o aviso, o MoonShot nunca saberia que ela chegou.
   */
  async function avisarSistemaDeFora(ordemId: string, autor: string, agora: string) {
    const o = await db
      .selectFrom('ordens')
      .select('status')
      .where('id', '=', ordemId)
      .executeTakeFirst()
    if (!o || o.status === 'agendado' || o.status === 'cancelado') return
    await db
      .updateTable('ordens')
      .set({ alteradoEm: agora, alteradoPor: autor })
      .where('id', '=', ordemId)
      .execute()
    await enfileirarAviso(db, ordemId, 'ordem.editada')
  }

  /**
   * O lote com a coleta inteira (22/10/2026): juntado → aponta o principal; principal → a lista
   * dos juntados, a coleta somada (quantidades, serviços), os documentos de todos e o pré-cálculo
   * da coleta. As quantidades/serviços/escopo do próprio lote ficam como estão (a edição usa).
   */
  async function obter(id: string): Promise<Ordem> {
    const o = await obterSo(id)
    const linha = await db
      .selectFrom('ordens')
      .select('juntadoA')
      .where('id', '=', id)
      .executeTakeFirst()
    if (linha?.juntadoA) {
      const p = await db
        .selectFrom('ordens')
        .select(['id', 'codigo'])
        .where('id', '=', linha.juntadoA)
        .executeTakeFirst()
      return { ...o, juntadoA: p ?? null }
    }
    const filhos = await juntadosA(db, id)
    if (!filhos.length) return o
    const outros = await Promise.all(filhos.map((f) => obterSo(f.id)))
    const todos = [o, ...outros]
    const soma = (
      k: 'boxes' | 'pallets' | 'gaylords' | 'racks' | 'placasPolicarbonato' | 'palletsVazios',
    ) =>
      todos.some((x) => x.quantidades[k] !== null)
        ? todos.reduce((a, x) => a + (x.quantidades[k] ?? 0), 0)
        : null
    const algum = (k: 'requerPalletsVazios' | 'itensMais25kg') =>
      todos.some((x) => x.quantidades[k])
    const quantidades: QuantidadesOs = {
      boxes: soma('boxes'),
      pallets: soma('pallets'),
      gaylords: soma('gaylords'),
      racks: soma('racks'),
      placasPolicarbonato: soma('placasPolicarbonato'),
      requerPalletsVazios: algum('requerPalletsVazios'),
      palletsVazios: soma('palletsVazios'),
      itensMais25kg: algum('itensMais25kg'),
      fatorLimitante:
        [...new Set(todos.map((x) => x.quantidades.fatorLimitante).filter(Boolean))].join('\n\n') ||
        null,
    }
    const servicos = Object.fromEntries(
      (Object.keys(o.servicos) as (keyof ServicosOs)[]).map((k) => [
        k,
        todos.some((x) => x.servicos[k]),
      ]),
    ) as unknown as ServicosOs
    // O pré-cálculo da coleta inteira (lote daqui; sem veículo, fica o do lote).
    let calculo = o.calculo
    if (!o.externo)
      calculo = await preCalcular({ docaId: o.docaId, servicos, quantidades }).catch(
        () => o.calculo,
      )
    return {
      ...o,
      calculo,
      juntados: filhos.map((f, i) => ({
        id: f.id,
        codigo: f.codigo,
        origem: f.origem,
        url: outros[i]!.externo?.url ?? null,
        status: f.status as StatusOrdem,
        referenciaCliente: f.referenciaCliente,
        totalVolumes: Number(f.totalVolumes),
        escopo: f.escopo,
        observacoes: f.observacoes,
      })),
      coleta: {
        quantidades,
        servicos,
        totalVolumes: todos.reduce((a, x) => a + x.totalVolumes, 0),
      },
      anexos: [
        ...o.anexos,
        ...outros.flatMap((x) =>
          x.anexos.map((a) => ({ ...a, ordemId: x.id, loteCodigo: x.codigo })),
        ),
      ],
    }
  }

  async function obterSo(id: string): Promise<Ordem> {
    const l = await linhaDe(db, id)
    if (!l) throw naoEncontrado('Ordem não encontrada.')
    const [anexos, historico, doLote, recebido, balanco, caminhoes] = await Promise.all([
      db
        .selectFrom('ordensAnexos')
        .selectAll()
        .where('ordemId', '=', id)
        .orderBy('enviadoEm', 'asc')
        .execute(),
      listarHistorico(db, 'ordem', id),
      lote.dados(id),
      recebimento.dados(id),
      balancoDoLote(db, id, l.status === 'concluido'),
      caminhoesDoLote(db, id),
    ])
    return {
      ...paraResumo(l),
      siteId: l.siteId,
      docaId: l.docaId,
      transportadoraId: l.transportadoraId,
      motoristaId: l.motoristaId,
      caminhoes,
      juntadoA: null,
      juntados: [],
      coleta: null,
      quantidades: {
        boxes: l.qtdBoxes,
        pallets: l.qtdPallets,
        gaylords: l.qtdGaylords,
        racks: l.qtdRacks,
        placasPolicarbonato: l.placasPolicarbonato,
        requerPalletsVazios: sim(l.requerPalletsVazios),
        palletsVazios: l.qtdPalletsVazios,
        itensMais25kg: sim(l.itensMais25kg),
        fatorLimitante: l.fatorLimitante,
      },
      escopo: l.escopo,
      observacoes: l.observacoes,
      anexos: anexos.map((a) => ({
        id: a.id,
        secao: a.secao as SecaoAnexo,
        tipo: a.tipo as TipoDocumentoLote,
        nome: a.nome,
        extensao: a.extensao,
        tamanho: a.tamanho,
        enviadoEm: a.enviadoEm,
        enviadoPor: a.enviadoPor,
      })),
      calculo: l.calculo ? (JSON.parse(l.calculo) as ResultadoCalculo) : null,
      criadoPor: l.criadoPor,
      alteradoEm: l.alteradoEm,
      alteradoPor: l.alteradoPor,
      historico,
      ...doLote,
      recebimento: recebido,
      balanco,
      externoDados: l.externoDados ? dadosExternos(JSON.parse(l.externoDados)) : null,
    }
  }

  /** Doca com as restrições usadas no cálculo. */
  async function docaParaCalculo(docaId: string) {
    const d = await db
      .selectFrom('clientesDocas')
      .selectAll()
      .where('id', '=', docaId)
      .executeTakeFirst()
    if (!d) throw new ErroApi(422, 'validation', 'Doca não encontrada.')
    return {
      comprimentoMaxCaminhao: d.comprimentoMaxCaminhao,
      espaco: d.espaco,
      dockLeveler: d.dockLeveler === 1,
      tailLift: d.tailLift === 1,
    }
  }

  async function preCalcular(entrada: unknown): Promise<ResultadoCalculo> {
    const v = preCalculoSchema.parse(entrada)
    const [doca, veiculos] = await Promise.all([
      docaParaCalculo(v.docaId),
      db.selectFrom('veiculos').selectAll().where('status', '=', 'ativo').execute(),
    ])
    try {
      return calcularOs({
        doca,
        veiculos,
        servicos: v.servicos,
        quantidades: {
          boxes: v.quantidades.boxes,
          pallets: v.quantidades.pallets,
          gaylords: v.quantidades.gaylords,
          racks: v.quantidades.racks,
          requerPalletsVazios: v.quantidades.requerPalletsVazios,
          palletsVazios: v.quantidades.palletsVazios,
        },
      })
    } catch (e) {
      if (e instanceof SemVeiculoError)
        throw new ErroApi(
          422,
          'no_vehicles',
          'Nenhum veículo ativo para o cálculo — cadastre ou reative um em Veículos.',
        )
      throw e
    }
  }

  /** Confere os vínculos: site do cliente, doca do site, transportadora e motorista existentes. */
  async function conferirVinculos(v: OrdemInput) {
    const cliente = await db
      .selectFrom('clientes')
      .select(['id', 'nome', 'status'])
      .where('id', '=', v.clienteId)
      .executeTakeFirst()
    if (!cliente) throw new ErroApi(422, 'validation', 'Cliente não encontrado.')
    if (cliente.status !== 'ativo')
      throw new ErroApi(422, 'validation', 'Cliente inativo não pode receber ordem.')
    const site = await db
      .selectFrom('clientesSites')
      .select(['id', 'codigo'])
      .where('id', '=', v.siteId)
      .where('clienteId', '=', v.clienteId)
      .executeTakeFirst()
    if (!site) throw new ErroApi(422, 'validation', 'O site não é deste cliente.')
    const doca = await db
      .selectFrom('clientesDocas')
      .select('id')
      .where('id', '=', v.docaId)
      .where('siteId', '=', v.siteId)
      .executeTakeFirst()
    if (!doca) throw new ErroApi(422, 'validation', 'A doca não é deste site.')
    let transportadora: string | null = null
    if (v.transportadoraId) {
      const t = await db
        .selectFrom('transportadoras')
        .select('nome')
        .where('id', '=', v.transportadoraId)
        .executeTakeFirst()
      if (!t) throw new ErroApi(422, 'validation', 'Transportadora não encontrada.')
      transportadora = t.nome
    }
    const motoristas = [
      ...new Set(v.caminhoes.map((c) => c.motoristaId).filter((m): m is string => Boolean(m))),
    ]
    if (motoristas.length) {
      const achados = await db
        .selectFrom('motoristas')
        .select('id')
        .where('id', 'in', motoristas)
        .execute()
      if (achados.length !== motoristas.length)
        throw new ErroApi(422, 'validation', 'Motorista não encontrado.')
    }
    return { cliente: cliente.nome, site: site.codigo, transportadora }
  }

  /**
   * As regras da aba Configurações do cliente (22/10/2026): agendamento bloqueado, rastreio
   * definido pelo cliente (sem exceção), motorista e placa na coleta rastreada e a planilha de
   * escopo (.xlsx). Na edição do lote só vale o que muda (lote antigo não fica preso a uma regra
   * nova); bloqueio e planilha valem só para lote novo.
   */
  async function conferirRegrasDoCliente(
    v: OrdemInput,
    o:
      | { novo: true; escopoArquivos: string[]; vaiJunto: boolean }
      | { novo: false; rastrearAntes: boolean },
  ) {
    const c = await configuracoesDoCliente(db, v.clienteId)
    if (!c) return // conferirVinculos responde "Cliente não encontrado."
    if (o.novo && c.agendamentoBloqueado)
      throw new ErroApi(
        409,
        'client_blocked',
        `Os agendamentos deste cliente estão bloqueados: ${c.bloqueioMotivo ?? ''}`,
      )
    if (
      !c.rastreioExcecao &&
      v.rastrear !== c.rastrearColeta &&
      (o.novo || v.rastrear !== o.rastrearAntes) &&
      // Vai junto de uma coleta que já tem caminhão (28/10/2026): o rastreio é o dela.
      !(o.novo && o.vaiJunto && !v.rastrear)
    )
      throw new ErroApi(
        422,
        'tracking_by_client',
        c.rastrearColeta
          ? 'Toda coleta deste cliente é rastreada.'
          : 'As coletas deste cliente não são rastreadas.',
      )
    if (c.exigirMotoristaPlaca && v.caminhoes.some((k) => !k.motoristaId || !k.placa))
      throw new ErroApi(
        422,
        'driver_plate_required',
        'A coleta rastreada deste cliente precisa de motorista e placa.',
      )
    if (
      o.novo &&
      c.exigirEscopoPlanilha &&
      !o.escopoArquivos.some((n) => extensaoDe(nomeSeguro(n)) === 'xlsx')
    )
      throw new ErroApi(
        422,
        'scope_spreadsheet_required',
        'Este cliente exige a planilha de escopo (.xlsx) no agendamento.',
      )
  }

  /* ------------------------------------------- PDF da OS e relatório final (22/10/2026) */

  /** Rótulo em português de cada tipo (os do sistema têm nome fixo; os criados, o pt-BR). */
  const nomeDoTipo = (t: TipoDoCliente) =>
    t.nome
      ? (t.nome.textos['pt-BR'] ?? t.nome.textos[t.nome.origem] ?? t.codigo)
      : (NOME_DO_TIPO[t.codigo] ?? t.codigo)

  /**
   * O ZIP sai quando o lote foi RECEBIDO e tem um documento de cada tipo marcado "vai no
   * relatório final" nas configurações do cliente (decisão do usuário). Faltando, diz o quê.
   */
  async function situacaoDoRelatorio(id: string) {
    const o = await obter(id)
    if (o.juntadoA) throw new ErroApi(409, 'lot_merged', 'Lote juntado a outro: use o principal.')
    const tipos = await tiposDoCliente(db, o.clienteId)
    const presentes = new Set(o.anexos.map((a) => a.tipo))
    const faltam = tipos.filter((t) => t.relatorio && !presentes.has(t.codigo)).map((t) => t.codigo)
    const recebido = o.status !== 'agendado' && o.status !== 'cancelado'
    return { o, tipos, recebido, faltam, pronto: recebido && faltam.length === 0 }
  }

  /** O PDF da OS com os dados de cadastro (cliente, site, doca, transportadora, caminhões). */
  async function pdfDe(o: Ordem, tipos: TipoDoCliente[]) {
    const idsMotoristas = o.caminhoes.map((c) => c.motoristaId).filter((x): x is string => !!x)
    const [cliente, contato, site, doca, transportadora, viagensDoLote, motoristas] =
      await Promise.all([
        db
          .selectFrom('clientes')
          .select(['nome', 'cnpj'])
          .where('id', '=', o.clienteId)
          .executeTakeFirstOrThrow(),
        db
          .selectFrom('clientesContatos')
          .select(['nome', 'email', 'telefone'])
          .where('clienteId', '=', o.clienteId)
          .orderBy('principal', 'desc')
          .orderBy('ordem')
          .executeTakeFirst(),
        o.siteId
          ? db
              .selectFrom('clientesSites as s')
              .leftJoin('clientesContatos as c', 'c.id', 's.contatoResponsavelId')
              .select([
                's.codigo',
                's.endereco',
                's.regiao',
                's.horario',
                'c.nome as responsavel',
                'c.email as responsavelEmail',
              ])
              .where('s.id', '=', o.siteId)
              .executeTakeFirst()
          : undefined,
        o.docaId
          ? db.selectFrom('clientesDocas').selectAll().where('id', '=', o.docaId).executeTakeFirst()
          : undefined,
        o.transportadoraId
          ? db
              .selectFrom('transportadoras')
              .select(['nome', 'cnpj'])
              .where('id', '=', o.transportadoraId)
              .executeTakeFirst()
          : undefined,
        opcoes.viagens ? opcoes.viagens.doLote(o.id) : Promise.resolve([]),
        idsMotoristas.length
          ? db
              .selectFrom('motoristas')
              .select(['id', 'nome'])
              .where('id', 'in', idsMotoristas)
              .execute()
          : Promise.resolve([]),
      ])
    const nomeMotorista = new Map(motoristas.map((m) => [m.id, m.nome]))
    const caminhoes = o.caminhoes.length
      ? o.caminhoes.map((c) => {
          const v = viagensDoLote.find((x) => x.numero === c.numero)
          return {
            numero: c.numero,
            motorista:
              (c.motoristaId && nomeMotorista.get(c.motoristaId)) || v?.motoristaNome || null,
            placa: c.placa,
            link: v?.linkMotorista ?? null,
          }
        })
      : o.motoristaNome || o.placa
        ? [{ numero: 1, motorista: o.motoristaNome, placa: o.placa, link: null }]
        : []
    return gerarPdfDaOs({
      ordem: o,
      cliente: { nome: cliente.nome, cnpj: cliente.cnpj, contato: contato ?? null },
      site: site
        ? {
            codigo: site.codigo,
            endereco: site.endereco,
            regiao: site.regiao,
            horario: site.horario,
            responsavel: site.responsavel ?? site.responsavelEmail ?? null,
          }
        : null,
      doca: doca
        ? {
            numero: doca.numero,
            alturaMaxCaminhao: doca.alturaMaxCaminhao,
            comprimentoMaxCaminhao: doca.comprimentoMaxCaminhao,
            dockLeveler: doca.dockLeveler === 1,
            tailLift: doca.tailLift === 1,
            pisoProtecaoObrigatorio: doca.pisoProtecaoObrigatorio === 1,
          }
        : null,
      transportadora: transportadora ?? null,
      caminhoes,
      tipos: Object.fromEntries(tipos.map((t) => [t.codigo, nomeDoTipo(t)])),
      geradoEm: new Date().toISOString(),
    })
  }

  return {
    obter,
    preCalcular,
    lote,
    recebimento,

    /** A coleta em que um lote novo entraria (Agendamento — 28/10/2026). */
    coleta(d: { clienteId: string; siteId: string; dia: string }) {
      return coletaDe(db, d)
    },

    async pdf(id: string) {
      const o = await obter(id)
      if (o.juntadoA) throw new ErroApi(409, 'lot_merged', 'Lote juntado a outro: use o principal.')
      const conteudo = await pdfDe(o, await tiposDoCliente(db, o.clienteId))
      return { nome: `OS-${o.codigo}.pdf`, conteudo }
    },

    async situacaoDoRelatorio(id: string) {
      const s = await situacaoDoRelatorio(id)
      return { pronto: s.pronto, recebido: s.recebido, faltam: s.faltam }
    },

    /** O ZIP: PDF da OS + planilha (recebimento e balanço) + os documentos marcados. */
    async relatorioFinal(id: string) {
      const s = await situacaoDoRelatorio(id)
      if (!s.recebido)
        throw new ErroApi(
          409,
          'report_not_received',
          'O relatório final sai depois do recebimento.',
        )
      if (s.faltam.length)
        throw new ErroApi(
          409,
          'report_missing_documents',
          'Faltam documentos para o relatório final.',
        )
      const o = s.o
      const noRelatorio = new Set(s.tipos.filter((t) => t.relatorio).map((t) => t.codigo))
      const nomes = Object.fromEntries(s.tipos.map((t) => [t.codigo, nomeDoTipo(t)]))
      const [pdf, planilha] = await Promise.all([
        pdfDe(o, s.tipos),
        gerarPlanilhaDoRelatorio(o, o.clienteNome, o.balanco),
      ])
      const arquivos: Record<string, Uint8Array> = {
        [`OS-${o.codigo}.pdf`]: pdf,
        [`Relatorio-${o.codigo}.xlsx`]: planilha,
      }
      // Os documentos dos tipos marcados, numa pasta por tipo (nome repetido ganha número).
      for (const a of o.anexos.filter((x) => noRelatorio.has(x.tipo))) {
        const conteudo = await readFile(caminho(a.ordemId ?? o.id, a.id)).catch(() => null)
        if (!conteudo) continue
        const pasta = `documentos/${nomeSeguro(nomes[a.tipo] ?? a.tipo)}`
        let nome = `${pasta}/${a.nome}`
        for (let n = 2; arquivos[nome]; n++) nome = `${pasta}/${n}-${a.nome}`
        arquivos[nome] = conteudo
      }
      return { nome: `Relatorio-final-${o.codigo}.zip`, conteudo: Buffer.from(zipSync(arquivos)) }
    },

    async listar(query: unknown) {
      const consulta = lerConsulta(query, COLUNAS_ORDEM)
      const where = whereDaConsulta(COLUNAS_ORDEM, consulta, { colunaBusca: 'busca' })
      // Os lotes juntados a outro não aparecem (o principal mostra a coleta inteira).
      let pagina = db
        .selectFrom('ordensLista')
        .selectAll()
        .where(where)
        .where('juntadoA', 'is', null)
      for (const o of ordemDaConsulta(COLUNAS_ORDEM, consulta, [{ id: 'codigo', desc: true }]))
        pagina = pagina.orderBy(o)
      const [linhas, total, grupos] = await Promise.all([
        pagina
          .limit(consulta.pageSize)
          .offset((consulta.page - 1) * consulta.pageSize)
          .execute(),
        db
          .selectFrom('ordensLista')
          .select(sql<number>`count(*)`.as('n'))
          .where(where)
          .where('juntadoA', 'is', null)
          .executeTakeFirstOrThrow(),
        db
          .selectFrom('ordensLista')
          .select(['status', sql<number>`count(*)`.as('n')])
          .where(
            whereDaConsulta(COLUNAS_ORDEM, consulta, { colunaBusca: 'busca', semFiltro: 'status' }),
          )
          .where('juntadoA', 'is', null)
          .groupBy('status')
          .execute(),
      ])
      return {
        rows: linhas.map(paraResumo),
        total: Number(total.n),
        totals: {},
        facets: { status: Object.fromEntries(grupos.map((g) => [g.status, Number(g.n)])) },
      }
    },

    async criar(
      dadosBrutos: unknown,
      arquivos: { escopo: ArquivoEnviado[]; observacoes: ArquivoEnviado[] },
      autor: string,
    ): Promise<Ordem> {
      const v = ordemInputSchema.parse(dadosBrutos)
      if (!v.escopo && !arquivos.escopo.length)
        throw new ErroApi(
          422,
          'scope_required',
          'Descreva o escopo de trabalho ou anexe pelo menos um documento.',
        )
      const todos = [
        ...arquivos.escopo.map((a) => ({ ...a, secao: 'escopo' as const })),
        ...arquivos.observacoes.map((a) => ({ ...a, secao: 'observacoes' as const })),
      ].map((a) => {
        const nome = nomeSeguro(a.nomeOriginal)
        const extensao = extensaoDe(nome)
        if (!EXTENSOES[extensao])
          throw new ErroApi(415, 'file_type_not_allowed', 'Tipo de arquivo não permitido.', {
            permitidas: Object.keys(EXTENSOES),
          })
        if (!a.conteudo.length) throw new ErroApi(422, 'validation', 'O arquivo está vazio.')
        return { id: randomUUID(), secao: a.secao, nome, extensao, conteudo: a.conteudo }
      })
      const nomes = await conferirVinculos(v)
      const junto = await coletaDe(db, {
        clienteId: v.clienteId,
        siteId: v.siteId,
        dia: v.dataColeta ?? v.coletaPrevista,
      })
      await conferirRegrasDoCliente(v, {
        novo: true,
        escopoArquivos: arquivos.escopo.map((a) => a.nomeOriginal),
        vaiJunto: Boolean(junto?.caminhoes.length),
      })

      // Pré-cálculo guardado junto (sem veículo ativo, a ordem é criada sem ele).
      let calculo: ResultadoCalculo | null = null
      try {
        calculo = await preCalcular({
          docaId: v.docaId,
          servicos: v.servicos,
          quantidades: v.quantidades,
        })
      } catch (e) {
        if (!(e instanceof ErroApi && e.code === 'no_vehicles')) throw e
      }

      const id = randomUUID()
      const agora = new Date().toISOString()
      const gravados: string[] = []
      try {
        for (const a of todos) {
          const destino = caminho(id, a.id)
          await mkdir(path.dirname(destino), { recursive: true })
          await writeFile(destino, a.conteudo)
          gravados.push(destino)
        }
        await db.transaction().execute(async (trx) => {
          const numero = await proximoNumero(trx, 'ordens')
          const codigo = codigoCom('LOT', numero)
          const q = v.quantidades
          await trx
            .insertInto('ordens')
            .values({
              id,
              numero,
              codigo,
              status: 'agendado',
              clienteId: v.clienteId,
              siteId: v.siteId,
              docaId: v.docaId,
              transportadoraId: v.transportadoraId,
              referenciaCliente: v.referenciaCliente,
              dataColeta: v.dataColeta && inicioDoDia(v.dataColeta),
              coletaPrevista: inicioDoDia(v.coletaPrevista),
              dataChegada: v.dataChegada && inicioDoDia(v.dataChegada),
              rastrear: v.rastrear ? 1 : 0,
              motoristaId: v.rastrear ? v.motoristaId : null,
              placa: v.rastrear ? v.placa : null,
              psm: v.servicos.psm ? 1 : 0,
              onsiteShredding: v.servicos.onsiteShredding ? 1 : 0,
              recycleOnly: v.servicos.recycleOnly ? 1 : 0,
              valueRecoveryRacks: v.servicos.valueRecoveryRacks ? 1 : 0,
              valueRecoveryItad: v.servicos.valueRecoveryItad ? 1 : 0,
              qtdBoxes: q.boxes,
              qtdPallets: q.pallets,
              qtdGaylords: q.gaylords,
              qtdRacks: q.racks,
              placasPolicarbonato: v.servicos.valueRecoveryRacks ? q.placasPolicarbonato : null,
              requerPalletsVazios: q.requerPalletsVazios ? 1 : 0,
              qtdPalletsVazios: q.requerPalletsVazios ? q.palletsVazios : null,
              itensMais25kg: q.itensMais25kg ? 1 : 0,
              fatorLimitante: q.fatorLimitante,
              escopo: v.escopo,
              observacoes: v.observacoes,
              calculo: calculo ? JSON.stringify(calculo) : null,
              busca: normalizar(
                [
                  codigo,
                  nomes.cliente,
                  nomes.site,
                  v.referenciaCliente ?? '',
                  nomes.transportadora ?? '',
                  v.placa ?? '',
                ].join(' '),
              ),
              etapaDesde: agora,
              externoSistema: null,
              externoId: null,
              externoDados: null,
              criadoEm: agora,
              criadoPor: autor,
              alteradoEm: agora,
              alteradoPor: autor,
            })
            .execute()
          const primeiro = await proximoNumeroAnexo(trx)
          if (todos.length)
            await trx
              .insertInto('ordensAnexos')
              .values(
                todos.map((a, i) => ({
                  id: a.id,
                  numero: primeiro + i,
                  ordemId: id,
                  secao: a.secao,
                  tipo: a.secao === 'escopo' ? 'escopo' : 'outro',
                  nome: a.nome,
                  extensao: a.extensao,
                  tamanho: a.conteudo.length,
                  enviadoEm: agora,
                  enviadoPor: autor,
                })),
              )
              .execute()
          await trx
            .insertInto('ordensEtapas')
            .values({ id: randomUUID(), ordemId: id, etapa: 'agendado', em: agora, autor })
            .execute()
          await registrarHistorico(trx, 'ordem', id, { autor, em: agora, acao: 'criado' })
          // "Rastrear coleta = Sim": nasce o card em Ordens › Viagens (aguardando motorista).
          if (v.rastrear) await opcoes.viagens?.aoMudarRastreio(trx, id, v.caminhoes, autor, agora)
        })
      } catch (e) {
        // Falhou: não deixa arquivo órfão no disco.
        await Promise.all(gravados.map((g) => rm(g, { force: true })))
        throw e
      }
      // Dois caminhões com a mesma placa no agendamento = um só (28/10/2026).
      await unirMesmaPlaca(db, id, new Date().toISOString())
      // A mesma coleta (cliente, endereço, data) de outro lote: este é juntado ao primeiro.
      await reagruparColetas(db, [v.clienteId], autor)
      return obter(id)
    },

    /** Documentos adicionados depois do agendamento (aba Documentos do lote). */
    async adicionarAnexos(
      ordemId: string,
      tipoBruto: unknown,
      arquivos: ArquivoEnviado[],
      autor: string,
    ) {
      const tipo = z
        .string({ error: 'Escolha o tipo do documento.' })
        .min(1, 'Escolha o tipo do documento.')
        .max(60)
        .parse(tipoBruto)
      const existe = await db
        .selectFrom('ordens')
        .select(['id', 'clienteId'])
        .where('id', '=', ordemId)
        .executeTakeFirst()
      if (!existe) throw naoEncontrado('Lote não encontrado.')
      // Só os tipos que o cliente aceita (aba Configurações).
      const aceitos = (await tiposDoCliente(db, existe.clienteId)).filter((t) => t.aceita)
      if (!aceitos.some((t) => t.codigo === tipo))
        throw new ErroApi(
          422,
          'document_type_not_accepted',
          'Este cliente não aceita este tipo de documento no lote.',
        )
      await garantirLoteDaqui(db, ordemId)
      if (!arquivos.length) throw new ErroApi(422, 'validation', 'Envie pelo menos um arquivo.')
      const novos = arquivos.map((a) => {
        const nome = nomeSeguro(a.nomeOriginal)
        const extensao = extensaoDe(nome)
        if (!EXTENSOES[extensao])
          throw new ErroApi(415, 'file_type_not_allowed', 'Tipo de arquivo não permitido.', {
            permitidas: Object.keys(EXTENSOES),
          })
        if (!a.conteudo.length) throw new ErroApi(422, 'validation', 'O arquivo está vazio.')
        return { id: randomUUID(), nome, extensao, conteudo: a.conteudo }
      })
      const agora = new Date().toISOString()
      const gravados: string[] = []
      try {
        for (const a of novos) {
          const destino = caminho(ordemId, a.id)
          await mkdir(path.dirname(destino), { recursive: true })
          await writeFile(destino, a.conteudo)
          gravados.push(destino)
        }
        await db.transaction().execute(async (trx) => {
          const primeiro = await proximoNumeroAnexo(trx)
          await trx
            .insertInto('ordensAnexos')
            .values(
              novos.map((a, i) => ({
                id: a.id,
                numero: primeiro + i,
                ordemId,
                secao: 'lote',
                tipo,
                nome: a.nome,
                extensao: a.extensao,
                tamanho: a.conteudo.length,
                enviadoEm: agora,
                enviadoPor: autor,
              })),
            )
            .execute()
          for (const a of novos)
            await registrarHistorico(trx, 'ordem', ordemId, {
              autor,
              em: agora,
              acao: 'documento_adicionado',
              nota: a.nome,
              mudancas: [{ campo: 'tipoDocumento', antes: null, depois: tipo }],
            })
        })
      } catch (e) {
        await Promise.all(gravados.map((g) => rm(g, { force: true })))
        throw e
      }
      await avisarSistemaDeFora(ordemId, autor, agora)
      return obter(ordemId)
    },

    /** Remove um documento do lote. O escopo continua obrigatório (texto ou documento). */
    async removerAnexo(ordemId: string, anexoId: string, autor: string) {
      const a = await db
        .selectFrom('ordensAnexos')
        .selectAll()
        .where('id', '=', anexoId)
        .where('ordemId', '=', ordemId)
        .executeTakeFirst()
      if (!a) throw naoEncontrado('Documento não encontrado.')
      await garantirLoteDaqui(db, ordemId)
      if (a.tipo === 'escopo') {
        const ordem = await db
          .selectFrom('ordens')
          .select('escopo')
          .where('id', '=', ordemId)
          .executeTakeFirstOrThrow()
        const outros = await db
          .selectFrom('ordensAnexos')
          .select('id')
          .where('ordemId', '=', ordemId)
          .where('tipo', '=', 'escopo')
          .where('id', '<>', anexoId)
          .execute()
        if (!ordem.escopo && !outros.length)
          throw new ErroApi(
            422,
            'scope_required',
            'É o único escopo de trabalho do lote: escreva o escopo (Editar) ou envie outro antes.',
          )
      }
      const agora = new Date().toISOString()
      await db.transaction().execute(async (trx) => {
        await trx.deleteFrom('ordensAnexos').where('id', '=', anexoId).execute()
        await registrarHistorico(trx, 'ordem', ordemId, {
          autor,
          em: agora,
          acao: 'documento_removido',
          nota: a.nome,
          mudancas: [{ campo: 'tipoDocumento', antes: a.tipo, depois: null }],
        })
      })
      await rm(caminho(ordemId, anexoId), { force: true })
      await avisarSistemaDeFora(ordemId, autor, agora)
      return obter(ordemId)
    },

    /**
     * Edita o lote (decisões do usuário, 19/10/2026): tudo menos o cliente, só enquanto
     * AGENDADO; o pré-cálculo é refeito ao salvar. Histórico antes → depois com os nomes.
     */
    async editar(id: string, dadosBrutos: unknown, autor: string): Promise<Ordem> {
      const atual = await linhaDe(db, id)
      if (!atual) throw naoEncontrado('Lote não encontrado.')
      await garantirLoteDaqui(db, id)
      if (atual.status !== 'agendado')
        throw new ErroApi(
          409,
          'invalid_transition',
          'Só o lote agendado pode ser editado. Depois da chegada, registre uma ocorrência.',
        )
      const v = ordemInputSchema.parse(dadosBrutos)
      if (v.clienteId !== atual.clienteId)
        throw new ErroApi(422, 'validation', 'O cliente do lote não muda. Agende um novo lote.')
      if (!v.escopo) {
        const doc = await db
          .selectFrom('ordensAnexos')
          .select('id')
          .where('ordemId', '=', id)
          .where('tipo', '=', 'escopo')
          .executeTakeFirst()
        if (!doc)
          throw new ErroApi(
            422,
            'scope_required',
            'Descreva o escopo de trabalho ou anexe pelo menos um documento.',
          )
      }
      const nomes = await conferirVinculos(v)
      await conferirRegrasDoCliente(v, { novo: false, rastrearAntes: atual.rastrear === 1 })
      const doca = await db
        .selectFrom('clientesDocas')
        .select('numero')
        .where('id', '=', v.docaId)
        .executeTakeFirstOrThrow()
      const motorista =
        v.rastrear && v.motoristaId
          ? ((
              await db
                .selectFrom('motoristas')
                .select('nome')
                .where('id', '=', v.motoristaId)
                .executeTakeFirst()
            )?.nome ?? null)
          : null

      let calculo: ResultadoCalculo | null = null
      try {
        calculo = await preCalcular({
          docaId: v.docaId,
          servicos: v.servicos,
          quantidades: v.quantidades,
        })
      } catch (e) {
        if (!(e instanceof ErroApi && e.code === 'no_vehicles')) throw e
      }
      const calculoAntes = atual.calculo ? (JSON.parse(atual.calculo) as ResultadoCalculo) : null
      const q = v.quantidades
      const dia = (iso: string | null) => (iso ? diaNoFuso(new Date(iso)) : null)
      const caminhoesAntes = await caminhoesDoLote(db, id)
      const servicosAntes = {
        psm: sim(atual.psm),
        onsiteShredding: sim(atual.onsiteShredding),
        recycleOnly: sim(atual.recycleOnly),
        valueRecoveryRacks: sim(atual.valueRecoveryRacks),
        valueRecoveryItad: sim(atual.valueRecoveryItad),
      }
      const antes: Record<string, Mudanca['antes']> = {
        site: atual.siteCodigo,
        doca: atual.docaNumero,
        transportadora: atual.transportadoraNome,
        referenciaCliente: atual.referenciaCliente,
        dataColeta: dia(atual.dataColeta),
        coletaPrevista: dia(atual.coletaPrevista),
        dataChegada: dia(atual.dataChegada),
        rastrear: sim(atual.rastrear),
        caminhoes: caminhoesAntes.length || null,
        motorista: atual.motoristaNome,
        placa: atual.placa,
        servicos: romanos(servicosAntes),
        boxes: atual.qtdBoxes,
        pallets: atual.qtdPallets,
        gaylords: atual.qtdGaylords,
        racks: atual.qtdRacks,
        placasPolicarbonato: atual.placasPolicarbonato,
        requerPalletsVazios: sim(atual.requerPalletsVazios),
        palletsVazios: atual.qtdPalletsVazios,
        itensMais25kg: sim(atual.itensMais25kg),
        fatorLimitante: atual.fatorLimitante,
        escopo: atual.escopo,
        observacoes: atual.observacoes,
        caminhao: calculoAntes?.veiculo.tipo ?? null,
        viagens: calculoAntes?.viagens ?? null,
        pessoas: calculoAntes?.totalPessoas ?? null,
      }
      const depois: Record<string, Mudanca['depois']> = {
        site: nomes.site,
        doca: doca.numero,
        transportadora: nomes.transportadora,
        referenciaCliente: v.referenciaCliente,
        dataColeta: v.dataColeta,
        coletaPrevista: v.coletaPrevista,
        dataChegada: v.dataChegada,
        rastrear: v.rastrear,
        caminhoes: v.caminhoes.length || null,
        motorista,
        placa: v.rastrear ? v.placa : null,
        servicos: romanos(v.servicos),
        boxes: q.boxes,
        pallets: q.pallets,
        gaylords: q.gaylords,
        racks: q.racks,
        placasPolicarbonato: v.servicos.valueRecoveryRacks ? q.placasPolicarbonato : null,
        requerPalletsVazios: q.requerPalletsVazios,
        palletsVazios: q.requerPalletsVazios ? q.palletsVazios : null,
        itensMais25kg: q.itensMais25kg,
        fatorLimitante: q.fatorLimitante,
        escopo: v.escopo,
        observacoes: v.observacoes,
        caminhao: calculo?.veiculo.tipo ?? null,
        viagens: calculo?.viagens ?? null,
        pessoas: calculo?.totalPessoas ?? null,
      }
      const mudancas: Mudanca[] = Object.keys(antes)
        .filter((k) => (antes[k] ?? null) !== (depois[k] ?? null))
        .map((k) => ({ campo: k, antes: antes[k] ?? null, depois: depois[k] ?? null }))
      if (!mudancas.length) return obter(id)

      // Desligando o rastreio: o motorista pode ter acabado de sair (o rastreador diz).
      if (!v.rastrear && atual.rastrear) await opcoes.viagens?.antesDeDesligar(id)
      const agora = new Date().toISOString()
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable('ordens')
          .set({
            siteId: v.siteId,
            docaId: v.docaId,
            transportadoraId: v.transportadoraId,
            referenciaCliente: v.referenciaCliente,
            dataColeta: v.dataColeta && inicioDoDia(v.dataColeta),
            coletaPrevista: inicioDoDia(v.coletaPrevista),
            dataChegada: v.dataChegada && inicioDoDia(v.dataChegada),
            rastrear: v.rastrear ? 1 : 0,
            motoristaId: v.rastrear ? v.motoristaId : null,
            placa: v.rastrear ? v.placa : null,
            psm: v.servicos.psm ? 1 : 0,
            onsiteShredding: v.servicos.onsiteShredding ? 1 : 0,
            recycleOnly: v.servicos.recycleOnly ? 1 : 0,
            valueRecoveryRacks: v.servicos.valueRecoveryRacks ? 1 : 0,
            valueRecoveryItad: v.servicos.valueRecoveryItad ? 1 : 0,
            qtdBoxes: q.boxes,
            qtdPallets: q.pallets,
            qtdGaylords: q.gaylords,
            qtdRacks: q.racks,
            placasPolicarbonato: v.servicos.valueRecoveryRacks ? q.placasPolicarbonato : null,
            requerPalletsVazios: q.requerPalletsVazios ? 1 : 0,
            qtdPalletsVazios: q.requerPalletsVazios ? q.palletsVazios : null,
            itensMais25kg: q.itensMais25kg ? 1 : 0,
            fatorLimitante: q.fatorLimitante,
            escopo: v.escopo,
            observacoes: v.observacoes,
            calculo: calculo ? JSON.stringify(calculo) : null,
            busca: normalizar(
              [
                atual.codigo,
                nomes.cliente,
                nomes.site,
                v.referenciaCliente ?? '',
                nomes.transportadora ?? '',
                v.rastrear ? (v.placa ?? '') : '',
              ].join(' '),
            ),
            alteradoEm: agora,
            alteradoPor: autor,
          })
          .where('id', '=', id)
          .execute()
        await registrarHistorico(trx, 'ordem', id, { autor, em: agora, acao: 'editado', mudancas })
        await opcoes.viagens?.aoMudarRastreio(
          trx,
          id,
          v.rastrear ? v.caminhoes : null,
          autor,
          agora,
        )
      })
      // Deu a um caminhão a placa de outro: é o mesmo caminhão (28/10/2026).
      await unirMesmaPlaca(db, id, new Date().toISOString())
      // Mudou a data ou o site: a coleta pode juntar ou separar.
      await reagruparColetas(db, [v.clienteId], autor)
      return obter(id)
    },

    /**
     * Exclui o lote DE VEZ (pedido do usuário, 27/10/2026 — o mesmo do iERP 1.0): só AGENDADO,
     * daqui (não de outro sistema) e sem caminhão na rua — depois do recebimento o lote já existe
     * dentro da empresa. O principal leva junto os lotes daqui juntados a ele (a coleta inteira);
     * os de outro sistema ficam e se reagrupam. Fica o registro em `ordens_excluidas` (Auditoria,
     * históricos de módulo e o número que não volta) e os arquivos do lote saem do disco.
     */
    async excluir(id: string, autor: string) {
      const colunas = [
        'id',
        'numero',
        'codigo',
        'status',
        'clienteId',
        'juntadoA',
      ] as const satisfies readonly (keyof Database['ordens'])[]
      const alvo = await db
        .selectFrom('ordens')
        .select(colunas)
        .where('id', '=', id)
        .executeTakeFirst()
      if (!alvo) throw naoEncontrado('Lote não encontrado.')
      await garantirLoteDaqui(db, id)
      const juntados = alvo.juntadoA
        ? []
        : await db
            .selectFrom('ordens')
            .select(colunas)
            .where('juntadoA', '=', id)
            .where('externoSistema', 'is', null)
            .orderBy('numero')
            .execute()
      const lotes = [alvo, ...juntados]
      const ids = lotes.map((l) => l.id)
      // Tudo conferido ANTES de apagar: parar no meio deixaria metade da coleta apagada.
      const recebido = lotes.find((l) => l.status !== 'agendado')
      if (recebido)
        throw new ErroApi(
          409,
          'lot_not_scheduled',
          `O ${recebido.codigo} já foi recebido e não pode mais ser excluído: ele já existe dentro da empresa. Só lotes agendados podem ser excluídos.`,
        )
      const naRua = await db
        .selectFrom('ordensViagens as v')
        .innerJoin('ordens as o', 'o.id', 'v.ordemId')
        .select('o.codigo')
        .where('v.ordemId', 'in', ids)
        .where('v.status', 'in', ['em_rota', 'chegou'])
        .executeTakeFirst()
      if (naRua)
        throw new ErroApi(
          409,
          'lot_trip_on_road',
          `Um caminhão do ${naRua.codigo} já saiu: finalize a viagem dele em Ordens › Viagens antes de excluir o lote.`,
        )

      const agora = new Date().toISOString()
      await db.transaction().execute(async (trx) => {
        for (const l of lotes) {
          await trx
            .insertInto('ordensExcluidas')
            .values({
              id: l.id,
              numero: l.numero,
              codigo: l.codigo,
              clienteId: l.clienteId,
              excluidoEm: agora,
              excluidoPor: autor,
            })
            .execute()
          await registrarHistorico(trx, 'ordem', l.id, {
            autor,
            em: agora,
            acao: 'lote_excluido',
            // Juntado que saiu com o principal: o histórico diz com qual.
            ...(l.id === alvo.id
              ? {}
              : { mudancas: [{ campo: 'lote', antes: alvo.codigo, depois: null }] }),
          })
        }
        // Juntado excluído sozinho: o principal registra que a coleta perdeu um lote.
        if (alvo.juntadoA)
          await registrarHistorico(trx, 'ordem', alvo.juntadoA, {
            autor,
            em: agora,
            acao: 'juntado_excluido',
            mudancas: [{ campo: 'lote', antes: alvo.codigo, depois: null }],
          })
        // Os de outro sistema juntados a ele ficam soltos; o reagrupar escolhe o novo principal.
        await trx
          .updateTable('ordens')
          .set({ juntadoA: null })
          .where('juntadoA', 'in', ids)
          .execute()
        await trx.deleteFrom('ordens').where('id', 'in', ids).execute()
      })
      await Promise.all(
        ids.map((i) => rm(path.join(opcoes.pasta, 'ordens', i), { recursive: true, force: true })),
      )
      await reagruparColetas(db, [alvo.clienteId], autor)
      return { ids, codigos: lotes.map((l) => l.codigo) }
    },

    /** Conteúdo do anexo para download. */
    async arquivo(ordemId: string, anexoId: string) {
      const a = await db
        .selectFrom('ordensAnexos')
        .selectAll()
        .where('id', '=', anexoId)
        .where('ordemId', '=', ordemId)
        .executeTakeFirst()
      if (!a) throw naoEncontrado('Anexo não encontrado.')
      const conteudo = await readFile(caminho(ordemId, anexoId)).catch(() => {
        throw naoEncontrado('Arquivo não encontrado no servidor.')
      })
      return {
        nome: a.nome,
        tipoConteudo: EXTENSOES[a.extensao] ?? 'application/octet-stream',
        conteudo,
      }
    },
  }
}

export type ServicoOrdens = ReturnType<typeof criarServicoOrdens>

/* ------------------------------------------------------------ rotas */

export function rotasOrdens(servico: ServicoOrdens) {
  const r = Router()
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: MAX_ARQUIVOS * 2 },
    // Nome do arquivo com acento chega certo.
    defParamCharset: 'utf8',
  }).fields([
    { name: 'escopo', maxCount: MAX_ARQUIVOS },
    { name: 'observacoes', maxCount: MAX_ARQUIVOS },
  ])
  const arquivosDe = (lista: Express.Multer.File[] | undefined): ArquivoEnviado[] =>
    (lista ?? []).map((f) => ({ nomeOriginal: f.originalname, conteudo: f.buffer }))

  r.get('/', async (req, res) => {
    res.json(await servico.listar(req.query))
  })
  r.post('/pre-calculo', async (req, res) => {
    res.json(await servico.preCalcular(req.body))
  })
  // Agendamento (28/10/2026): a coleta em que o lote novo vai entrar e os caminhões dela.
  r.get('/coleta', async (req, res) => {
    const q = z
      .object({ clienteId: z.string().min(1), siteId: z.string().min(1), dia: z.string() })
      .refine((x) => ehDia(x.dia), 'Dia inválido.')
      .parse(req.query)
    res.json(await servico.coleta(q))
  })
  r.get('/:id', async (req, res) => {
    res.json(await servico.obter(req.params.id))
  })
  r.post('/', upload, async (req, res) => {
    let dados: unknown
    try {
      dados = JSON.parse(String((req.body as Record<string, unknown>).dados ?? ''))
    } catch {
      throw new ErroApi(422, 'validation', 'Dados da ordem inválidos.')
    }
    const files = req.files as Record<string, Express.Multer.File[]> | undefined
    const ordem = await servico.criar(
      dados,
      { escopo: arquivosDe(files?.escopo), observacoes: arquivosDe(files?.observacoes) },
      autorDa(req),
    )
    res.status(201).json(ordem)
  })
  const uploadDocumentos = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: MAX_ARQUIVOS },
    defParamCharset: 'utf8',
  }).array('arquivos', MAX_ARQUIVOS)
  r.put('/:id', async (req, res) => {
    res.json(await servico.editar(String(req.params.id), req.body, autorDa(req)))
  })
  r.delete('/:id', async (req, res) => {
    res.json(await servico.excluir(String(req.params.id), autorDa(req)))
  })
  r.post('/:id/anexos', uploadDocumentos, async (req, res) => {
    const ordem = await servico.adicionarAnexos(
      String(req.params.id),
      (req.body as Record<string, unknown>).tipo,
      arquivosDe(req.files as Express.Multer.File[] | undefined),
      autorDa(req),
    )
    res.status(201).json(ordem)
  })
  r.delete('/:id/anexos/:anexoId', async (req, res) => {
    res.json(
      await servico.removerAnexo(String(req.params.id), String(req.params.anexoId), autorDa(req)),
    )
  })
  r.get('/:id/pdf', async (req, res) => {
    const a = await servico.pdf(String(req.params.id))
    res.setHeader('Content-Type', 'application/pdf')
    res.attachment(a.nome)
    res.send(a.conteudo)
  })
  r.get('/:id/relatorio-final/situacao', async (req, res) => {
    res.json(await servico.situacaoDoRelatorio(String(req.params.id)))
  })
  r.get('/:id/relatorio-final', async (req, res) => {
    const a = await servico.relatorioFinal(String(req.params.id))
    res.setHeader('Content-Type', 'application/zip')
    res.attachment(a.nome)
    res.send(a.conteudo)
  })
  r.get('/:id/anexos/:anexoId/arquivo', async (req, res) => {
    const a = await servico.arquivo(req.params.id, req.params.anexoId)
    res.setHeader('Content-Type', a.tipoConteudo)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.attachment(a.nome)
    res.send(a.conteudo)
  })
  r.use(rotasLote(servico.lote, (id) => servico.obter(id)))
  r.use(rotasRecebimento(servico.recebimento, (id) => servico.obter(id)))
  return r
}
