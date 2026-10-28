import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import { criarApp } from '../../app.js'
import { criarDb, type Db } from '../../db/database.js'
import { migrarParaUltima } from '../../db/migrate.js'
import { semear } from '../../db/seed.js'
import { criarServicoViagens } from './viagens.js'

/*
 * Vários rastreadores no MESMO caminhão (pedido do usuário, 28/10/2026): o card é o caminhão; cada
 * rastreador (celular ou aparelho de GPS) é uma viagem no rastreador, com o mesmo número de
 * caminhão, motorista, placa e código de chegada. "Nova viagem" em Viagens = adicionar caminhão
 * (com o rastreador). O mesmo aparelho em dois lotes só do mesmo cliente e dia.
 */

let db: Db
let base: string
let pasta: string
let fechar: () => void
let clienteId: string
let motoristaId: string
let site: { id: string; doca: string }
let outroSite: { id: string; doca: string }

async function api(caminho: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${base}${caminho}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const texto = await res.text()
  return { status: res.status, body: texto ? JSON.parse(texto) : undefined }
}

const corpo = (dia: string, extra: Record<string, unknown> = {}) => ({
  clienteId,
  siteId: site.id,
  docaId: site.doca,
  transportadoraId: null,
  referenciaCliente: null,
  coletaPrevista: dia,
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
    boxes: null,
    pallets: 2,
    gaylords: null,
    racks: null,
    placasPolicarbonato: null,
    requerPalletsVazios: false,
    palletsVazios: null,
    itensMais25kg: false,
    fatorLimitante: null,
  },
  escopo: 'Coleta.',
  observacoes: null,
  ...extra,
})

async function agendar(dados: Record<string, unknown>, arquivo?: string) {
  const form = new FormData()
  form.append('dados', JSON.stringify(dados))
  if (arquivo) form.append('escopo', new Blob(['x']), arquivo)
  const res = await fetch(`${base}/ordens`, { method: 'POST', body: form })
  const body = JSON.parse(await res.text())
  assert.equal(res.status, 201, JSON.stringify(body))
  return body as { id: string; codigo: string; juntadoA: { id: string; codigo: string } | null }
}

async function novoSite(codigo: string, endereco: string) {
  const r = await api(`/clientes/${clienteId}/sites`, {
    method: 'POST',
    body: {
      codigo: codigo,
      regiao: null,
      horario: null,
      totalGaylords: null,
      cep: null,
      endereco: endereco,
      latitude: null,
      longitude: null,
      shredderProprio: false,
      edgeSite: false,
      docas: [
        {
          numero: 'D1',
          alturaMaxCaminhao: 4.4,
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
  assert.equal(r.status, 201, JSON.stringify(r.body))
  return { id: r.body.id as string, doca: r.body.docas[0].id as string }
}

before(async () => {
  pasta = await mkdtemp(path.join(os.tmpdir(), 'ierp-rastreios-'))
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  await semear(db)
  const servidor = criarApp(db, { arquivosDir: pasta }).listen(0)
  await new Promise((ok) => servidor.once('listening', ok))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
  fechar = () => servidor.close()
  clienteId = (await api('/clientes?q=technova')).body.rows[0].id
  motoristaId = (await api('/motoristas')).body.rows[0].id
  site = await novoSite('RAS-A', 'Rua do Rastreio, 1 - São Paulo')
  outroSite = await novoSite('RAS-B', 'Av. da Outra Portaria, 900 - São Paulo')
})

after(async () => {
  fechar()
  await db.destroy()
  await rm(pasta, { recursive: true, force: true })
})

type ViagemApi = {
  id: string
  ordemId: string
  numero: number
  status: string
  origemGps: string
  codigoChegada: string | null
  placa: string | null
  code?: string
}

const caminhao = (ordemId: string, body: Record<string, unknown>) =>
  api(`/viagens/lote/${ordemId}`, { method: 'POST', body }) as Promise<{
    status: number
    body: ViagemApi
  }>
const rastreio = (viagemId: string, body: Record<string, unknown> = {}) =>
  api(`/viagens/${viagemId}/rastreios`, { method: 'POST', body }) as Promise<{
    status: number
    body: ViagemApi
  }>

async function aparelho(deviceId: string) {
  const agora = new Date().toISOString()
  const id = randomUUID()
  await db
    .insertInto('rastreadores')
    .values({
      id,
      deviceId,
      placa: null,
      descricao: null,
      status: 'ativo',
      firmware: null,
      ultimoContatoEm: null,
      ultimoStatus: null,
      ultimaLatitude: null,
      ultimaLongitude: null,
      ultimaVelocidade: null,
      ultimoPontoEm: null,
      ultimoSeq: null,
      criadoEm: agora,
      alteradoEm: agora,
    })
    .execute()
  return id
}

describe('viagens › rastreadores no mesmo caminhão', () => {
  it('um caminhão com 2 rastreadores: o mesmo caminhão (número, placa e código de chegada)', async () => {
    const lote = await agendar(corpo('2027-07-01'))
    const c1 = await caminhao(lote.id, { motoristaId, placa: 'ABC1D23' })
    assert.equal(c1.status, 201, JSON.stringify(c1.body))
    assert.equal(c1.body.status, 'aguardando_motorista')

    const celular2 = await rastreio(c1.body.id)
    assert.equal(celular2.status, 201, JSON.stringify(celular2.body))
    assert.equal(celular2.body.numero, c1.body.numero)
    assert.equal(celular2.body.codigoChegada, c1.body.codigoChegada)
    assert.equal(celular2.body.origemGps, 'celular')

    const gps = await rastreio(c1.body.id, { rastreadorId: await aparelho('gps-ras-1') })
    assert.equal(gps.status, 201, JSON.stringify(gps.body))
    assert.equal(gps.body.numero, c1.body.numero)
    assert.equal(gps.body.origemGps, 'aparelho')
    assert.equal(gps.body.status, 'em_rota')

    const doLote = (await api(`/viagens/lote/${lote.id}`)).body as ViagemApi[]
    assert.equal(doLote.length, 3)
    assert.ok(doLote.every((v) => v.numero === c1.body.numero))
    const h = (await api(`/ordens/${lote.id}`)).body.historico as { acao: string }[]
    assert.ok(h.some((e) => e.acao === 'rastreador_adicionado'))
  })

  it('o mesmo aparelho não entra duas vezes no mesmo caminhão', async () => {
    const lote = await agendar(corpo('2027-07-02'))
    const c1 = await caminhao(lote.id, { placa: 'QWE4R56' })
    const id = await aparelho('gps-ras-2')
    assert.equal((await rastreio(c1.body.id, { rastreadorId: id })).status, 201)
    const de_novo = await rastreio(c1.body.id, { rastreadorId: id })
    assert.equal(de_novo.status, 409)
    assert.equal(de_novo.body.code, 'tracker_already_on_truck')
  })

  it('"Nova viagem" com aparelho de GPS: o caminhão novo já sai na rua', async () => {
    const lote = await agendar(corpo('2027-07-03'))
    const r = await caminhao(lote.id, {
      motoristaId,
      placa: 'ZXC1V23',
      rastreadorId: await aparelho('gps-ras-3'),
    })
    assert.equal(r.status, 201, JSON.stringify(r.body))
    assert.equal(r.body.origemGps, 'aparelho')
    assert.equal(r.body.status, 'em_rota')
  })

  it('o mesmo aparelho em dois lotes: só do mesmo cliente e do mesmo dia', async () => {
    const id = await aparelho('gps-ras-4')
    const a = await agendar(corpo('2027-07-05'))
    const b = await agendar(corpo('2027-07-05', { siteId: outroSite.id, docaId: outroSite.doca }))
    const c = await agendar(corpo('2027-07-06', { siteId: outroSite.id, docaId: outroSite.doca }))
    assert.equal((await caminhao(a.id, { placa: 'AAA1A11', rastreadorId: id })).status, 201)
    const mesmoDia = await caminhao(b.id, { placa: 'AAA1A11', rastreadorId: id })
    assert.equal(mesmoDia.status, 201, JSON.stringify(mesmoDia.body))
    const outroDia = await caminhao(c.id, { placa: 'AAA1A11', rastreadorId: id })
    assert.equal(outroDia.status, 409)
    assert.equal(outroDia.body.code, 'tracker_in_use')
  })

  it('caminhão de lote já recebido não ganha rastreador', async () => {
    const lote = await agendar(corpo('2027-07-08'))
    const c1 = await caminhao(lote.id, { placa: 'BBB2B22' })
    await db.updateTable('ordens').set({ status: 'inspecao' }).where('id', '=', lote.id).execute()
    const r = await rastreio(c1.body.id)
    assert.equal(r.status, 409)
    assert.equal(r.body.code, 'trip_not_open')
  })
})

describe('viagens › lotes que se juntam levam os caminhões junto (28/10/2026)', () => {
  const rastreado = (dia: string, placa: string, extra: Record<string, unknown> = {}) =>
    corpo(dia, { rastrear: true, caminhoes: [{ motoristaId, placa }], ...extra })
  const abertas = async (ordemId: string) =>
    ((await api(`/viagens/lote/${ordemId}`)).body as ViagemApi[]).filter((v) =>
      ['aguardando_motorista', 'em_rota', 'chegou'].includes(v.status),
    )

  it('mesma placa: o mesmo caminhão (o celular repetido sai)', async () => {
    const a = await agendar(rastreado('2027-08-02', 'CCC3C33'))
    const b = await agendar(rastreado('2027-08-02', 'CCC3C33'))
    assert.equal(b.juntadoA?.id, a.id)
    const doA = await abertas(a.id)
    assert.equal(doA.length, 1)
    assert.equal(doA[0]!.placa ?? 'CCC3C33', 'CCC3C33')
    assert.equal((await abertas(b.id)).length, 0)
  })

  it('2 caminhões vazios + 1 com motorista e placa: 3 caminhões (sem placa = a definir)', async () => {
    const vazio = corpo('2027-08-10', {
      rastrear: true,
      caminhoes: [{ motoristaId: null, placa: null }],
    })
    const a = await agendar(vazio)
    const b = await agendar(vazio)
    const c = await agendar(rastreado('2027-08-10', 'HHH8H88'))
    assert.equal(b.juntadoA?.id, a.id)
    assert.equal(c.juntadoA?.id, a.id)
    const caminhoes = (await api(`/ordens/${a.id}`)).body.caminhoes as {
      numero: number
      motoristaId: string | null
      placa: string | null
    }[]
    assert.deepEqual(
      caminhoes.map((x) => [x.numero, x.motoristaId, x.placa]),
      [
        [1, null, null],
        [2, null, null],
        [3, motoristaId, 'HHH8H88'],
      ],
    )
    // A conferência de fundo não recria caminhão nos juntados (que o reagrupar levaria de novo).
    const servico = criarServicoViagens(db)
    await servico.sincronizar()
    await servico.sincronizar()
    assert.equal((await abertas(b.id)).length, 0)
    assert.equal((await abertas(c.id)).length, 0)
    assert.equal((await abertas(a.id)).length, 3)
  })

  it('editar: dar ao caminhão 1 a placa do caminhão 2 junta os dois (um card)', async () => {
    const lote = await agendar(
      corpo('2027-08-12', {
        rastrear: true,
        caminhoes: [
          { motoristaId: null, placa: null },
          { motoristaId, placa: 'JJJ9J99' },
        ],
      }),
    )
    assert.equal((await abertas(lote.id)).length, 2)
    const editado = await api(`/ordens/${lote.id}`, {
      method: 'PUT',
      body: corpo('2027-08-12', {
        rastrear: true,
        caminhoes: [
          { motoristaId, placa: 'JJJ9J99' },
          { motoristaId, placa: 'JJJ9J99' },
        ],
      }),
    })
    assert.equal(editado.status, 200, JSON.stringify(editado.body))
    const doLote = await abertas(lote.id)
    assert.equal(doLote.length, 1)
    assert.equal(doLote[0]!.numero, 1)
    assert.equal(doLote[0]!.placa, 'JJJ9J99')
  })

  it('"Adicionar caminhão" com a placa de um caminhão do lote: recusa e indica o rastreador', async () => {
    const lote = await agendar(rastreado('2027-08-13', 'KKK1K11'))
    const r = await caminhao(lote.id, { placa: 'KKK1K11' })
    assert.equal(r.status, 409)
    assert.equal(r.body.code, 'truck_already_in_lot')
  })

  it('placa diferente: mais um caminhão da coleta', async () => {
    const a = await agendar(rastreado('2027-08-03', 'DDD4D44'))
    const b = await agendar(rastreado('2027-08-03', 'EEE5E55'))
    assert.equal(b.juntadoA?.id, a.id)
    const doA = await abertas(a.id)
    assert.deepEqual([...new Set(doA.map((v) => v.numero))].sort(), [1, 2])
  })

  it('o aparelho de GPS do lote que se junta vira mais um rastreador do mesmo caminhão', async () => {
    const a = await agendar(rastreado('2027-08-04', 'FFF6F66'))
    // B em outro dia, com o celular e um aparelho no mesmo caminhão; depois muda para o dia de A.
    const b = await agendar(rastreado('2027-08-05', 'FFF6F66'))
    assert.equal(b.juntadoA, null)
    const [celularB] = await abertas(b.id)
    const gps = await rastreio(celularB!.id, { rastreadorId: await aparelho('gps-junta-1') })
    assert.equal(gps.status, 201, JSON.stringify(gps.body))
    const editado = await api(`/ordens/${b.id}`, {
      method: 'PUT',
      body: rastreado('2027-08-04', 'FFF6F66'),
    })
    assert.equal(editado.status, 200, JSON.stringify(editado.body))
    assert.equal(editado.body.juntadoA?.id, a.id)
    const doA = await abertas(a.id)
    // Um caminhão só: o celular de A + o aparelho que veio de B (o celular repetido de B saiu).
    assert.deepEqual([...new Set(doA.map((v) => v.numero))], [1])
    assert.deepEqual(doA.map((v) => v.origemGps).sort(), ['aparelho', 'celular'])
  })

  it('Agendamento: mostra a coleta e os caminhões; o cliente que exige rastreio aceita ir junto', async () => {
    const a = await agendar(rastreado('2027-08-06', 'GGG7G77'))
    const q = `clienteId=${clienteId}&siteId=${site.id}&dia=2027-08-06`
    const c = (await api(`/ordens/coleta?${q}`)).body
    assert.equal(c.codigo, a.codigo)
    assert.equal(c.caminhoes.length, 1)
    assert.equal(c.caminhoes[0].placa, 'GGG7G77')
    assert.equal((await api(`/ordens/coleta?${q.replace('2027-08-06', '2027-08-07')}`)).body, null)

    await db
      .updateTable('clientes')
      .set({ rastrearColeta: 1, rastreioExcecao: 0 })
      .where('id', '=', clienteId)
      .execute()
    try {
      const junto = await agendar(corpo('2027-08-06'))
      assert.equal(junto.juntadoA?.id, a.id)
      const sozinho = await fetch(`${base}/ordens`, {
        method: 'POST',
        body: (() => {
          const f = new FormData()
          f.append('dados', JSON.stringify(corpo('2027-08-09')))
          return f
        })(),
      })
      assert.equal(sozinho.status, 422)
    } finally {
      await db
        .updateTable('clientes')
        .set({ rastrearColeta: 0 })
        .where('id', '=', clienteId)
        .execute()
    }
  })
})
