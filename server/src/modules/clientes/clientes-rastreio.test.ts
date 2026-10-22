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

/* Link público para o cliente acompanhar os lotes (22/10/2026) — de ponta a ponta. */

let db: Db
let base: string
let pasta: string
let fechar: () => void
let clienteId: string
let siteId: string
let docaId: string

async function api(caminho: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${base}${caminho}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const texto = await res.text()
  return { status: res.status, headers: res.headers, body: texto ? JSON.parse(texto) : undefined }
}

async function multipart(caminho: string, dados: unknown, arquivos: string[] = []) {
  const form = new FormData()
  form.append('dados', JSON.stringify(dados))
  for (const campo of arquivos) form.append(campo, new Blob(['x']), `${campo}.jpg`)
  const res = await fetch(`${base}${caminho}`, { method: 'POST', body: form })
  return { status: res.status, body: JSON.parse(await res.text()) }
}

const ordem = (coletaPrevista: string, referenciaCliente: string) => ({
  clienteId,
  siteId,
  docaId,
  transportadoraId: null,
  referenciaCliente,
  coletaPrevista,
  dataColeta: null,
  dataChegada: null,
  rastrear: false,
  motoristaId: null,
  placa: null,
  servicos: {
    psm: false,
    onsiteShredding: false,
    recycleOnly: true,
    valueRecoveryRacks: false,
    valueRecoveryItad: false,
  },
  quantidades: {
    boxes: 0,
    pallets: 2,
    gaylords: 0,
    racks: 0,
    placasPolicarbonato: null,
    requerPalletsVazios: false,
    palletsVazios: null,
    itensMais25kg: false,
    fatorLimitante: null,
  },
  escopo: 'Coleta de teste.',
  observacoes: null,
})

before(async () => {
  pasta = await mkdtemp(path.join(os.tmpdir(), 'ierp-rastreio-'))
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  await semear(db)
  const servidor = criarApp(db, { arquivosDir: pasta }).listen(0)
  await new Promise((ok) => servidor.once('listening', ok))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
  fechar = () => servidor.close()
  clienteId = (await api('/clientes?q=technova')).body.rows[0].id
  const site = await api(`/clientes/${clienteId}/sites`, {
    method: 'POST',
    body: {
      codigo: 'RST-01',
      regiao: null,
      horario: null,
      totalGaylords: null,
      cep: null,
      endereco: null,
      latitude: null,
      longitude: null,
      shredderProprio: false,
      edgeSite: false,
      docas: [
        {
          numero: 'D1',
          alturaMaxCaminhao: 4.2,
          comprimentoMaxCaminhao: null,
          dockLeveler: true,
          tailLift: false,
          areaLift: null,
          espaco: null,
          altura: null,
          voltagemShredder: null,
          pisoProtecaoObrigatorio: false,
        },
      ],
    },
  })
  siteId = site.body.id
  docaId = site.body.docas[0].id
})

after(async () => {
  fechar()
  await db.destroy()
  await rm(pasta, { recursive: true, force: true })
})

describe('clientes › link público de acompanhamento', () => {
  it('sem link: o cliente começa sem; código inventado ou mal formado dá 404', async () => {
    assert.equal((await api(`/clientes/${clienteId}`)).body.rastreioToken, null)
    assert.equal((await api(`/publico/rastreio/${'a'.repeat(48)}`)).status, 404)
    assert.equal((await api('/publico/rastreio/nao-e-um-codigo')).status, 404)
  })

  it('gera o link e a página mostra os lotes (sem cancelados), recebimento e etapas', async () => {
    const recebido = (await multipart('/ordens', ordem('2026-10-01', 'PO-1'))).body
    const r = await multipart(
      `/ordens/${recebido.id}/recebimento`,
      {
        dataRecebimento: new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Sao_Paulo',
        }).format(new Date()),
        inspecao: 'bom',
        inspecaoDescricao: null,
        lacres: [{ numero: 'LAC-9' }],
        notas: [],
        pallets: [
          { pesoBruto: 120.5, tara: 10 },
          { pesoBruto: 80, tara: null },
        ],
      },
      ['lacres.0', 'pallets.0', 'pallets.1'],
    )
    assert.equal(r.status, 201)
    const agendado = (await multipart('/ordens', ordem('2026-12-01', 'PO-2'))).body
    const cancelado = (await multipart('/ordens', ordem('2026-11-01', 'PO-3'))).body
    await db
      .updateTable('ordens')
      .set({ status: 'cancelado' })
      .where('id', '=', cancelado.id)
      .execute()

    const c = await api(`/clientes/${clienteId}/rastreio`, { method: 'POST' })
    assert.equal(c.status, 200)
    assert.match(c.body.rastreioToken, /^[0-9a-f]{48}$/)
    assert.equal(c.body.historico[0].acao, 'rastreio_gerado')

    const p = await api(`/publico/rastreio/${c.body.rastreioToken}`)
    assert.equal(p.status, 200)
    assert.equal(p.headers.get('cache-control'), 'no-store')
    assert.match(p.headers.get('x-robots-tag') ?? '', /noindex/)
    const codigos = p.body.lotes.map((l: { codigo: string }) => l.codigo)
    // Mais recente primeiro; cancelado fora.
    assert.deepEqual(codigos, [agendado.codigo, recebido.codigo])
    const l = p.body.lotes[1]
    assert.equal(l.status, 'inspecao')
    assert.equal(l.referenciaCliente, 'PO-1')
    assert.equal(l.pallets, 2)
    assert.equal(l.pesoBrutoKg, 200.5)
    assert.deepEqual(l.lacres, ['LAC-9'])
    assert.deepEqual(
      l.etapas.map((e: { etapa: string }) => e.etapa),
      ['agendado', 'inspecao'],
    )
    // Nada interno vai para a página pública.
    assert.equal('id' in l, false)
    assert.equal('escopo' in l, false)
  })

  it('trocar o link: o antigo para de funcionar', async () => {
    const antes = (await api(`/clientes/${clienteId}`)).body.rastreioToken
    const c = await api(`/clientes/${clienteId}/rastreio`, { method: 'POST' })
    assert.notEqual(c.body.rastreioToken, antes)
    assert.equal(c.body.historico[0].acao, 'rastreio_trocado')
    assert.equal((await api(`/publico/rastreio/${antes}`)).status, 404)
    assert.equal((await api(`/publico/rastreio/${c.body.rastreioToken}`)).status, 200)
  })

  it('desativar: o link para de funcionar e fica no histórico', async () => {
    const antes = (await api(`/clientes/${clienteId}`)).body.rastreioToken
    const c = await api(`/clientes/${clienteId}/rastreio`, { method: 'DELETE' })
    assert.equal(c.body.rastreioToken, null)
    assert.equal(c.body.historico[0].acao, 'rastreio_desativado')
    assert.equal((await api(`/publico/rastreio/${antes}`)).status, 404)
  })
})
