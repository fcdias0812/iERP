import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import { criarApp } from '../../app.js'
import { criarDb, type Db } from '../../db/database.js'
import { migrarParaUltima } from '../../db/migrate.js'
import { semear } from '../../db/seed.js'

/* Ordens › Agendamento — HTTP real + SQLite em memória + pasta temporária para anexos. */

let db: Db
let base: string
let pasta: string
let fechar: () => void
let clienteId: string
let siteId: string
let docaId: string
let docaPequenaId: string

async function api(caminho: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${base}${caminho}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const texto = await res.text()
  return { status: res.status, body: texto ? JSON.parse(texto) : undefined }
}

/** Cria a ordem como a tela faz: multipart com `dados` (JSON) e arquivos. */
async function criarOrdem(
  dados: Record<string, unknown>,
  arquivos: { campo: 'escopo' | 'observacoes'; nome: string; conteudo: string }[] = [],
) {
  const form = new FormData()
  form.append('dados', JSON.stringify(dados))
  for (const a of arquivos) form.append(a.campo, new Blob([a.conteudo]), a.nome)
  const res = await fetch(`${base}/ordens`, { method: 'POST', body: form })
  return { status: res.status, body: JSON.parse(await res.text()) }
}

const doca = (numero: string, extra: Record<string, unknown> = {}) => ({
  numero,
  alturaMaxCaminhao: 4.2,
  comprimentoMaxCaminhao: null,
  dockLeveler: true,
  tailLift: false,
  areaLift: null,
  espaco: null,
  altura: null,
  voltagemShredder: null,
  pisoProtecaoObrigatorio: false,
  ...extra,
})

const SERVICOS = {
  psm: false,
  onsiteShredding: false,
  recycleOnly: true,
  valueRecoveryRacks: true,
  valueRecoveryItad: false,
}

const ordem = (extra: Record<string, unknown> = {}) => ({
  clienteId,
  siteId,
  docaId,
  transportadoraId: null,
  referenciaCliente: 'PO-123',
  dataColeta: '2026-10-25',
  coletaPrevista: null,
  dataChegada: null,
  rastrear: false,
  motoristaId: null,
  placa: null,
  servicos: SERVICOS,
  quantidades: {
    boxes: 10,
    pallets: 6,
    gaylords: 2,
    racks: 3,
    placasPolicarbonato: 8,
    requerPalletsVazios: false,
    palletsVazios: null,
    itensMais25kg: true,
    fatorLimitante: null,
  },
  escopo: 'Coleta de racks no data center.',
  observacoes: null,
  ...extra,
})

before(async () => {
  pasta = await mkdtemp(path.join(os.tmpdir(), 'ierp-ordens-'))
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  await semear(db)
  const servidor = criarApp(db, { arquivosDir: pasta }).listen(0)
  await new Promise((ok) => servidor.once('listening', ok))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
  fechar = () => servidor.close()
  const lista = await api('/clientes?q=technova')
  clienteId = lista.body.rows[0].id
  const site = await api(`/clientes/${clienteId}/sites`, {
    method: 'POST',
    body: {
      codigo: 'DC-01',
      regiao: null,
      horario: null,
      totalGaylords: null,
      cep: null,
      endereco: null,
      latitude: null,
      longitude: null,
      shredderProprio: false,
      edgeSite: false,
      docas: [doca('D1'), doca('D2', { comprimentoMaxCaminhao: 4, dockLeveler: false })],
    },
  })
  assert.equal(site.status, 201)
  siteId = site.body.id
  docaId = site.body.docas.find((d: { numero: string }) => d.numero === 'D1').id
  docaPequenaId = site.body.docas.find((d: { numero: string }) => d.numero === 'D2').id
})

after(async () => {
  fechar()
  await db.destroy()
  await rm(pasta, { recursive: true, force: true })
})

describe('ordens › pré-cálculo', () => {
  it('calcula com os veículos ativos e não grava nada', async () => {
    const r = await api('/ordens/pre-calculo', {
      method: 'POST',
      body: { docaId, servicos: SERVICOS, quantidades: ordem().quantidades },
    })
    assert.equal(r.status, 200)
    // 6 + 2 + 3 = 11 volumes (boxes não contam) → truck (5 a 12), 1 viagem.
    assert.equal(r.body.totalVolumes, 11)
    assert.equal(r.body.veiculo.tipo, 'truck')
    assert.equal(r.body.viagens, 1)
    // 2 base + 1 recycle + 2 (1 bloco de racks) = 5
    assert.equal(r.body.totalPessoas, 5)
    assert.equal(r.body.levarGaylordReteck, true)
    assert.equal((await api('/ordens')).body.total, 0)
  })

  it('doca pequena rebaixa o caminhão e pede plataforma (sem dock leveler)', async () => {
    const r = await api('/ordens/pre-calculo', {
      method: 'POST',
      body: { docaId: docaPequenaId, servicos: SERVICOS, quantidades: ordem().quantidades },
    })
    assert.equal(r.body.veiculo.tipo, 'van')
    assert.equal(r.body.viagens, 3) // ceil(11 / 4)
    assert.equal(r.body.caminhaoPlataforma, true)
    assert.ok(r.body.avisos.some((a: { codigo: string }) => a.codigo === 'rebaixado'))
  })

  it('sem doca é erro de validação', async () => {
    const r = await api('/ordens/pre-calculo', {
      method: 'POST',
      body: { docaId: '', servicos: SERVICOS, quantidades: {} },
    })
    assert.equal(r.status, 422)
  })
})

describe('ordens › agendamento', () => {
  it('cria o lote agendado com anexos e o cálculo guardado', async () => {
    const r = await criarOrdem(ordem(), [
      { campo: 'escopo', nome: 'Escopo técnico.pdf', conteudo: '%PDF-1.4 escopo' },
      { campo: 'observacoes', nome: 'fotos.zip', conteudo: 'zip' },
    ])
    assert.equal(r.status, 201, JSON.stringify(r.body))
    assert.equal(r.body.codigo, 'LOT-00001')
    assert.equal(r.body.status, 'agendado')
    assert.equal(r.body.siteCodigo, 'DC-01')
    assert.equal(r.body.totalVolumes, 11)
    // Data por dia no fuso de SP (início do dia em UTC).
    assert.equal(r.body.dataColeta, '2026-10-25T03:00:00.000Z')
    assert.equal(r.body.anexos.length, 2)
    assert.equal(r.body.anexos[0].nome, 'Escopo técnico.pdf')
    assert.equal(r.body.calculo.veiculo.tipo, 'truck')
    assert.equal(r.body.historico[0].acao, 'criado')

    const arquivo = await fetch(`${base}/ordens/${r.body.id}/anexos/${r.body.anexos[0].id}/arquivo`)
    assert.equal(arquivo.status, 200)
    assert.match(arquivo.headers.get('content-disposition') ?? '', /attachment/)
    assert.equal(await arquivo.text(), '%PDF-1.4 escopo')

    const lista = await api('/ordens?q=po-123')
    assert.equal(lista.body.total, 1)
    assert.equal(lista.body.rows[0].clienteNome.includes('TechNova'), true)
  })

  it('escopo obrigatório: texto OU arquivo', async () => {
    const sem = await criarOrdem(ordem({ escopo: null }))
    assert.equal(sem.status, 422)
    assert.equal(sem.body.code, 'scope_required')
    const soArquivo = await criarOrdem(ordem({ escopo: null }), [
      { campo: 'escopo', nome: 'escopo.txt', conteudo: 'escopo em arquivo' },
    ])
    assert.equal(soArquivo.status, 201)
  })

  it('placas de policarbonato só com Value Recovery (Racks); pallets vazios pedem quantidade', async () => {
    const semPlacas = await criarOrdem(
      ordem({ quantidades: { ...ordem().quantidades, placasPolicarbonato: null } }),
    )
    assert.equal(semPlacas.status, 422)

    const semRacks = await criarOrdem(
      ordem({
        servicos: { ...SERVICOS, valueRecoveryRacks: false },
        quantidades: { ...ordem().quantidades, placasPolicarbonato: 5 },
      }),
    )
    assert.equal(semRacks.status, 201)
    assert.equal(semRacks.body.quantidades.placasPolicarbonato, null)

    const semQtdVazios = await criarOrdem(
      ordem({
        quantidades: { ...ordem().quantidades, requerPalletsVazios: true, palletsVazios: null },
      }),
    )
    assert.equal(semQtdVazios.status, 422)
  })

  it('data de coleta é obrigatória', async () => {
    const sem = await criarOrdem(ordem({ dataColeta: null }))
    assert.equal(sem.status, 422)
    const invalida = await criarOrdem(ordem({ dataColeta: '25/10/2026' }))
    assert.equal(invalida.status, 422)
  })

  it('site de outro cliente e doca de outro site são recusados', async () => {
    const outro = await api('/clientes?q=verde')
    const r = await criarOrdem(ordem({ clienteId: outro.body.rows[0].id }))
    assert.equal(r.status, 422)
    const doca = await criarOrdem(ordem({ docaId: 'nao-existe' }))
    assert.equal(doca.status, 422)
  })

  it('motorista e placa só valem com rastreio; placa inválida é recusada', async () => {
    const motoristas = await api('/motoristas')
    const motoristaId = motoristas.body.rows[0].id
    const semRastreio = await criarOrdem(ordem({ motoristaId, placa: 'ABC1D23' }))
    assert.equal(semRastreio.body.motoristaNome, null)
    assert.equal(semRastreio.body.placa, null)

    const comRastreio = await criarOrdem(ordem({ rastrear: true, motoristaId, placa: 'abc-1d23' }))
    assert.equal(comRastreio.body.placa, 'ABC1D23')
    assert.ok(comRastreio.body.motoristaNome)

    const invalida = await criarOrdem(ordem({ rastrear: true, placa: '123' }))
    assert.equal(invalida.status, 422)
  })

  it('recusa arquivo de tipo não permitido', async () => {
    const r = await criarOrdem(ordem(), [{ campo: 'escopo', nome: 'virus.exe', conteudo: 'MZ' }])
    assert.equal(r.status, 415)
  })
})
