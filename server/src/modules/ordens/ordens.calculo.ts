/*
 * PRÉ-CÁLCULO DA OS (Agendamento) — portado do sistema anterior
 * (C:\Systems\TI-Re-Teck-iERP\backend\src\lib\calculoOs.js), com os MESMOS números e passos.
 * Função PURA: recebe serviços, quantidades, doca e veículos e devolve o plano. Não grava nada.
 *
 * Diferenças assumidas em relação ao anterior:
 * - entram no cálculo todos os veículos ATIVOS (não há a marcação "usar no cálculo");
 * - a capacidade do veículo é a "capacidade em pallets" do cadastro (1 pallet = 1 volume);
 * - os avisos saem como CÓDIGOS (a tela traduz nos 3 idiomas).
 *
 * Heranças fiéis (não "corrigir" sem decisão de negócio):
 * - BOXES NÃO CONTAM como volume (só ficam na memória de cálculo);
 * - peso não entra (toneladas e "itens >25 kg" são informativos);
 * - volume é CONTÁVEL (1 pallet = 1 gaylord = 1 rack = 1 volume).
 */

export const PARAMS_OS = {
  /** Motorista + ajudante, compartilhados por todo serviço. */
  pessoasBase: 2,
  /** Onsite Shredding leva +2 operadores. */
  pessoasExtrasOnsite: 2,
  /** Recycle Only leva +1. */
  pessoasExtrasRecycle: 1,
  /** Value Recovery: +2 por bloco de racks… */
  pessoasPorBlocoRacks: 2,
  /** …a cada 10 racks (arredonda para cima). */
  tamanhoBlocoRacks: 10,
  /** Pallets vazios levados NÃO ocupam capacidade (herança do sistema anterior). */
  palletsVaziosContamNaCapacidade: false,
} as const

export interface ServicosOs {
  psm: boolean
  onsiteShredding: boolean
  recycleOnly: boolean
  valueRecoveryRacks: boolean
  valueRecoveryItad: boolean
}

export interface QuantidadesCalculo {
  boxes: number | null
  pallets: number | null
  gaylords: number | null
  racks: number | null
  requerPalletsVazios: boolean
  palletsVazios: number | null
}

export interface DocaCalculo {
  comprimentoMaxCaminhao: number | null
  /** m² de manobra (comprimento × largura do caminhão precisa caber). */
  espaco: number | null
  dockLeveler: boolean
  tailLift: boolean
}

export interface VeiculoCalculo {
  tipo: string
  volumeMinimo: number | null
  volumeMaximo: number | null
  comprimento: number | null
  largura: number | null
  capacidadePallets: number | null
}

export type AvisoCalculo =
  | { codigo: 'sem_servico' }
  | { codigo: 'nenhum_cabe'; tipo: string; comprimentoMax: number | null }
  | { codigo: 'rebaixado'; desejado: string; final: string }

export interface ResultadoCalculo {
  totalVolumes: number
  volumesEfetivos: number
  veiculo: { tipo: string; comprimento: number | null; capacidade: number }
  caminhaoPlataforma: boolean
  viagens: number
  levarShredder: boolean
  levarGaylordReteck: boolean
  levarPalletsVazios: boolean
  qtdPalletsVazios: number
  totalPessoas: number
  avisos: AvisoCalculo[]
  memoria: {
    veiculoDesejado: string
    pallets: number
    gaylords: number
    racks: number
    boxes: number
    parametros: typeof PARAMS_OS
    doca: DocaCalculo
  }
}

/** Negativo, NaN e vazio viram 0; decimal trunca. */
const inteiro = (valor: unknown) => {
  const n = Number(valor)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export class SemVeiculoError extends Error {}

export function calcularOs({
  servicos,
  quantidades,
  doca,
  veiculos,
}: {
  servicos: ServicosOs
  quantidades: QuantidadesCalculo
  doca: DocaCalculo
  veiculos: VeiculoCalculo[]
}): ResultadoCalculo {
  if (!veiculos.length) throw new SemVeiculoError()

  const avisos: AvisoCalculo[] = []
  if (!Object.values(servicos).some(Boolean)) avisos.push({ codigo: 'sem_servico' })

  const pallets = inteiro(quantidades.pallets)
  const gaylords = inteiro(quantidades.gaylords)
  const racks = inteiro(quantidades.racks)
  const palletsVazios = inteiro(quantidades.palletsVazios)

  // ── Pessoas: a base + o extra de cada serviço (SOMAM, não é o maior) ──
  let totalPessoas: number = PARAMS_OS.pessoasBase
  if (servicos.onsiteShredding) totalPessoas += PARAMS_OS.pessoasExtrasOnsite
  if (servicos.recycleOnly) totalPessoas += PARAMS_OS.pessoasExtrasRecycle
  if (servicos.valueRecoveryRacks || servicos.valueRecoveryItad) {
    const blocos = Math.ceil(racks / PARAMS_OS.tamanhoBlocoRacks) || 0
    totalPessoas += blocos * PARAMS_OS.pessoasPorBlocoRacks
  }

  // ── O que levar ──
  const levarShredder = servicos.onsiteShredding
  const levarGaylordReteck = servicos.recycleOnly
  const levarPalletsVazios = quantidades.requerPalletsVazios && palletsVazios > 0
  const qtdPalletsVazios = levarPalletsVazios ? palletsVazios : 0

  // ── Volumes (boxes NÃO contam) ──
  const totalVolumes = pallets + gaylords + racks
  const volumesEfetivos = PARAMS_OS.palletsVaziosContamNaCapacidade
    ? totalVolumes + qtdPalletsVazios
    : totalVolumes

  // ── PASSO A: o caminhão DESEJADO pela faixa de volumes ──
  // Do menor para o maior (comprimento); acima da última faixa, fica o maior.
  const doMenorProMaior = [...veiculos].sort((a, b) => (a.comprimento ?? 0) - (b.comprimento ?? 0))
  const maior = doMenorProMaior[doMenorProMaior.length - 1]!
  const desejado =
    doMenorProMaior.find(
      (v) => totalVolumes >= (v.volumeMinimo ?? 0) && totalVolumes <= (v.volumeMaximo ?? Infinity),
    ) ?? maior

  // ── PASSO B: a doca deixa? (comprimento e espaço de manobra) ──
  const area = (v: VeiculoCalculo) => (v.comprimento ?? 0) * (v.largura ?? 0)
  const cabeComprimento = (v: VeiculoCalculo) =>
    !doca.comprimentoMaxCaminhao || (v.comprimento ?? 0) <= doca.comprimentoMaxCaminhao
  const cabeEspaco = (v: VeiculoCalculo) => !doca.espaco || area(v) <= doca.espaco
  const permitido = (v: VeiculoCalculo) => cabeComprimento(v) && cabeEspaco(v)

  let final: VeiculoCalculo
  if (permitido(desejado)) {
    final = desejado
  } else {
    // O MAIOR que a doca aceita; se nem o menor couber, fica o menor + aviso.
    const cabe = [...doMenorProMaior].reverse().find(permitido)
    final = cabe ?? doMenorProMaior[0]!
    if (!cabe)
      avisos.push({
        codigo: 'nenhum_cabe',
        tipo: final.tipo,
        comprimentoMax: doca.comprimentoMaxCaminhao,
      })
    if (final.tipo !== desejado.tipo)
      avisos.push({ codigo: 'rebaixado', desejado: desejado.tipo, final: final.tipo })
  }

  // ── Viagens: capacidade em volumes, arredondando para cima (mínimo 1) ──
  const capacidade =
    final.capacidadePallets && final.capacidadePallets > 0 ? final.capacidadePallets : 1
  const viagens = Math.max(1, Math.ceil(volumesEfetivos / capacidade) || 1)

  // ── PASSO C: caminhão plataforma (doca sem dock leveler, ou com tail lift) ──
  const caminhaoPlataforma = !doca.dockLeveler || doca.tailLift

  return {
    totalVolumes,
    volumesEfetivos,
    veiculo: { tipo: final.tipo, comprimento: final.comprimento, capacidade },
    caminhaoPlataforma,
    viagens,
    levarShredder,
    levarGaylordReteck,
    levarPalletsVazios,
    qtdPalletsVazios,
    totalPessoas,
    avisos,
    memoria: {
      veiculoDesejado: desejado.tipo,
      pallets,
      gaylords,
      racks,
      boxes: inteiro(quantidades.boxes),
      parametros: PARAMS_OS,
      doca,
    },
  }
}
