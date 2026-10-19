import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  calcularOs,
  PARAMS_OS,
  SemVeiculoError,
  type DocaCalculo,
  type QuantidadesCalculo,
  type ServicosOs,
  type VeiculoCalculo,
} from './ordens.calculo.js'

/*
 * Trava o pré-cálculo da OS com os MESMOS casos do sistema anterior (calculoOs.test.js).
 * Mudar um número deste teste é decisão de negócio.
 */

const VEICULOS: VeiculoCalculo[] = [
  {
    tipo: 'VUC',
    volumeMinimo: 1,
    volumeMaximo: 6,
    comprimento: 6.3,
    largura: 2.2,
    capacidadePallets: 6,
  },
  {
    tipo: 'TRUCK_15T',
    volumeMinimo: 7,
    volumeMaximo: 16,
    comprimento: 11,
    largura: 2.5,
    capacidadePallets: 16,
  },
  {
    tipo: 'TRAILER_25T',
    volumeMinimo: 17,
    volumeMaximo: 99999,
    comprimento: 18.6,
    largura: 2.6,
    capacidadePallets: 30,
  },
]
const DOCA_GRANDE: DocaCalculo = {
  comprimentoMaxCaminhao: 18.6,
  espaco: 100,
  dockLeveler: true,
  tailLift: false,
}
const DOCA_PEQUENA: DocaCalculo = {
  comprimentoMaxCaminhao: 10,
  espaco: 30,
  dockLeveler: true,
  tailLift: false,
}

const SEM_SERVICO: ServicosOs = {
  psm: false,
  onsiteShredding: false,
  recycleOnly: false,
  valueRecoveryRacks: false,
  valueRecoveryItad: false,
}
const SEM_QTD: QuantidadesCalculo = {
  boxes: null,
  pallets: null,
  gaylords: null,
  racks: null,
  requerPalletsVazios: false,
  palletsVazios: null,
}

function calcular(
  extra: {
    servicos?: Partial<ServicosOs>
    quantidades?: Partial<QuantidadesCalculo>
    doca?: DocaCalculo
  } = {},
) {
  return calcularOs({
    doca: extra.doca ?? DOCA_GRANDE,
    veiculos: VEICULOS,
    servicos: { ...SEM_SERVICO, ...extra.servicos },
    quantidades: { ...SEM_QTD, ...extra.quantidades },
  })
}

test('pessoas: base 2; onsite +2; recycle +1; racks +2 por bloco de 10', () => {
  assert.equal(calcular({ servicos: { psm: true } }).totalPessoas, 2)
  assert.equal(calcular({ servicos: { onsiteShredding: true } }).totalPessoas, 4)
  assert.equal(calcular({ servicos: { recycleOnly: true } }).totalPessoas, 3)
  assert.equal(
    calcular({ servicos: { valueRecoveryRacks: true }, quantidades: { racks: 10 } }).totalPessoas,
    4,
  )
  // 11 racks = 2 blocos → +4.
  assert.equal(
    calcular({ servicos: { valueRecoveryItad: true }, quantidades: { racks: 11 } }).totalPessoas,
    6,
  )
  // Todos juntos SOMAM: 2 + 2 + 1 + 2×2 = 9.
  assert.equal(
    calcular({
      servicos: { psm: true, onsiteShredding: true, recycleOnly: true, valueRecoveryRacks: true },
      quantidades: { racks: 11 },
    }).totalPessoas,
    9,
  )
})

test('volumes: pallets + gaylords + racks; BOXES NÃO CONTAM', () => {
  const r = calcular({ quantidades: { pallets: 2, gaylords: 3, racks: 1, boxes: 50 } })
  assert.equal(r.totalVolumes, 6)
  assert.equal(r.memoria.boxes, 50)
})

test('faixas: 6 → VUC, 7 → TRUCK_15T, 20 → TRAILER_25T', () => {
  assert.equal(calcular({ quantidades: { pallets: 6 } }).veiculo.tipo, 'VUC')
  assert.equal(calcular({ quantidades: { pallets: 7 } }).veiculo.tipo, 'TRUCK_15T')
  assert.equal(calcular({ quantidades: { pallets: 20 } }).veiculo.tipo, 'TRAILER_25T')
})

test('doca pequena rebaixa o caminhão e o nº de viagens compensa', () => {
  // 20 volumes pedem TRAILER (18,6 m), a doca aceita 10 m: nem o TRUCK (11 m) cabe → VUC, 4 viagens.
  const r = calcular({ doca: DOCA_PEQUENA, quantidades: { pallets: 20 } })
  assert.equal(r.veiculo.tipo, 'VUC')
  assert.equal(r.viagens, 4)
  assert.ok(r.avisos.some((a) => a.codigo === 'rebaixado'))
})

test('viagens: 1 quando cabe; ceil(70/30) = 3 no trailer; nunca 0', () => {
  assert.equal(calcular({ quantidades: { pallets: 5 } }).viagens, 1)
  assert.equal(calcular({ quantidades: { pallets: 70 } }).viagens, 3)
  assert.equal(calcular().viagens, 1)
})

test('caminhão plataforma: sem dock leveler OU com tail lift', () => {
  assert.equal(calcular().caminhaoPlataforma, false)
  assert.equal(calcular({ doca: { ...DOCA_GRANDE, dockLeveler: false } }).caminhaoPlataforma, true)
  assert.equal(calcular({ doca: { ...DOCA_GRANDE, tailLift: true } }).caminhaoPlataforma, true)
})

test('o que levar: shredder no onsite, gaylord no recycle, pallets vazios se pedidos', () => {
  const r = calcular({
    servicos: { onsiteShredding: true, recycleOnly: true },
    quantidades: { requerPalletsVazios: true, palletsVazios: 4 },
  })
  assert.equal(r.levarShredder, true)
  assert.equal(r.levarGaylordReteck, true)
  assert.equal(r.levarPalletsVazios, true)
  assert.equal(r.qtdPalletsVazios, 4)
  assert.equal(
    calcular({ quantidades: { requerPalletsVazios: true, palletsVazios: 0 } }).levarPalletsVazios,
    false,
  )
})

test('pallets vazios NÃO ocupam capacidade por padrão', () => {
  assert.equal(PARAMS_OS.palletsVaziosContamNaCapacidade, false)
  const r = calcular({ quantidades: { pallets: 6, requerPalletsVazios: true, palletsVazios: 2 } })
  assert.equal(r.volumesEfetivos, 6)
})

test('sem serviço marcado é aviso, não erro; sem veículo é erro', () => {
  assert.ok(calcular().avisos.some((a) => a.codigo === 'sem_servico'))
  assert.throws(
    () =>
      calcularOs({ doca: DOCA_GRANDE, veiculos: [], servicos: SEM_SERVICO, quantidades: SEM_QTD }),
    SemVeiculoError,
  )
})

test('doca sem comprimento máximo nem espaço não restringe', () => {
  const r = calcular({
    doca: { comprimentoMaxCaminhao: null, espaco: null, dockLeveler: true, tailLift: false },
    servicos: { psm: true },
    quantidades: { pallets: 20 },
  })
  assert.equal(r.veiculo.tipo, 'TRAILER_25T')
  assert.equal(r.avisos.length, 0)
})

test('entrada suja: negativo vira 0', () => {
  const r = calcular({ quantidades: { pallets: -3, gaylords: Number.NaN, racks: null } })
  assert.equal(r.totalVolumes, 0)
})
