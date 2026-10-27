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
import { estadoDoRastreador, lerRespostaDaLeitura, urlDaLeitura } from './gps-caminhao.js'

/*
 * Viagem pelo APARELHO de GPS do caminhão (22/10/2026 — "utilize o mesmo método no 1.0"): o
 * servidor de GPS (Walker) é FALSO, com o mesmo contrato (GET ?after=<cursor>, Bearer).
 */

const WALKER = 'https://gps-cloud.teste/ierp/v1/points'
const CHAVE = 'chave-de-leitura-do-1.0'

const walker = {
  /** Páginas na fila (cada leitura devolve a próxima). */
  paginas: [] as unknown[],
  chamadas: [] as string[],
  recusar: false,
}

const fetchFalso = (async (url: string | URL | Request, init?: RequestInit) => {
  const endereco = String(url)
  if (!endereco.startsWith(WALKER)) return new Response('?', { status: 404 })
  walker.chamadas.push(endereco)
  if (new Headers(init?.headers).get('Authorization') !== `Bearer ${CHAVE}` || walker.recusar)
    return Response.json({ ok: 0 }, { status: 401 })
  return Response.json(walker.paginas.shift() ?? { ok: 1, cursor: null, more: false, batches: [] })
}) as typeof fetch

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
  return { status: res.status, body: texto ? JSON.parse(texto) : undefined }
}

const ponto = (min: number, seq: number, extra: Record<string, unknown> = {}) => ({
  latitude: -23.5 - min * 0.001,
  longitude: -46.6 - min * 0.001,
  speedMps: 10,
  accuracyM: 5,
  recordedAt: `2026-10-22T12:${String(min).padStart(2, '0')}:00Z`,
  seq,
  ...extra,
})

/** Cada lote dos testes numa data própria (a mesma coleta — cliente, endereço, data — se junta). */
let seqDia = 0
const outroDia = () =>
  new Date(Date.UTC(2027, 0, 1) + seqDia++ * 86_400_000).toISOString().slice(0, 10)

async function criarLote() {
  const form = new FormData()
  form.append(
    'dados',
    JSON.stringify({
      clienteId,
      siteId,
      docaId,
      transportadoraId: null,
      referenciaCliente: null,
      coletaPrevista: outroDia(),
      dataColeta: null,
      dataChegada: null,
      rastrear: true,
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
      escopo: 'Coleta pelo aparelho.',
      observacoes: null,
    }),
  )
  const res = await fetch(`${base}/ordens`, { method: 'POST', body: form })
  const body = JSON.parse(await res.text())
  assert.equal(res.status, 201, JSON.stringify(body))
  return body as { id: string; codigo: string }
}

before(async () => {
  pasta = await mkdtemp(path.join(os.tmpdir(), 'ierp-gps-'))
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  await semear(db)
  const servidor = criarApp(db, { arquivosDir: pasta, fetchExterno: fetchFalso }).listen(0)
  await new Promise((ok) => servidor.once('listening', ok))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
  fechar = () => servidor.close()
  clienteId = (await api('/clientes?q=technova')).body.rows[0].id
  const site = await api(`/clientes/${clienteId}/sites`, {
    method: 'POST',
    body: {
      codigo: 'GPS-01',
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
  siteId = site.body.id
  docaId = site.body.docas[0].id
})

after(async () => {
  fechar()
  await db.destroy()
  await rm(pasta, { recursive: true, force: true })
})

describe('gps do caminhão › regras do 1.0', () => {
  it('lê o formato do Walker: lotes, devices, cursor e "more"; ponto simulado fica de fora', () => {
    const r = lerRespostaDaLeitura({
      ok: 1,
      cursor: 25,
      more: true,
      batches: [
        {
          deviceId: 'GPS-2998',
          firmware: '1.9.2',
          points: [ponto(2, 2), ponto(1, 1), ponto(3, 3, { simulated: true })],
          status: { fix: '3D', satsUsed: 12, online: true, extra: 'x' },
        },
      ],
      devices: [{ deviceId: 'gps-3000', firmware: '1.9.3', status: { online: false } }],
    })
    assert.equal(r.cursor, '25')
    assert.equal(r.mais, true)
    assert.equal(r.lotes[0]?.deviceId, 'gps-2998')
    assert.deepEqual(
      r.lotes[0]?.pontos.map((p) => p.seq),
      [1, 2],
    )
    assert.deepEqual(r.lotes[0]?.status, { fix: '3D', satsUsed: 12, online: true })
    assert.equal(r.dispositivos[0]?.deviceId, 'gps-3000')
  })

  it('um ponto ruim recusa o lote inteiro; sem fuso é ruim', () => {
    const r = lerRespostaDaLeitura({
      batches: [
        {
          deviceId: 'gps-1',
          points: [ponto(1, 1), { ...ponto(2, 2), recordedAt: '2026-10-22T12:02:00' }],
        },
      ],
    })
    assert.equal(r.lotes.length, 0)
  })

  it('o cursor vai no "after" (ou na marca da URL)', () => {
    assert.equal(urlDaLeitura(WALKER, null), WALKER)
    assert.equal(urlDaLeitura(WALKER, '25'), `${WALKER}?after=25`)
    assert.equal(urlDaLeitura('https://x.teste/p?since={cursor}', '9'), 'https://x.teste/p?since=9')
  })

  it('situação do aparelho como no 1.0', () => {
    const agora = Date.parse('2026-10-22T12:00:00Z')
    const s = (status: object, min = 1) => ({
      ultimoContatoEm: new Date(agora - min * 60_000).toISOString(),
      ultimoStatus: JSON.stringify(status),
    })
    assert.equal(
      estadoDoRastreador({ ultimoContatoEm: null, ultimoStatus: null }, agora),
      'nunca_conectou',
    )
    assert.equal(estadoDoRastreador(s({ online: false }), agora), 'sem_conexao')
    assert.equal(estadoDoRastreador(s({ fix: '3D' }, 11), agora), 'sem_conexao')
    assert.equal(estadoDoRastreador(s({ gps: 'not_found' }), agora), 'gps_com_problema')
    assert.equal(estadoDoRastreador(s({ fix: 'none' }), agora), 'sem_satelite')
    assert.equal(estadoDoRastreador(s({ fix: '3D' }), agora), 'online')
  })
})

describe('gps do caminhão › leitura e viagem pelo aparelho', () => {
  let rastreadorId: string
  let viagemId: string

  it('cadastra o servidor de GPS (mesma chave do 1.0) e a placa aparece sozinha', async () => {
    const r = await api('/integracoes', {
      method: 'POST',
      body: {
        sistema: 'GPS_CAMINHAO',
        nome: 'Servidor de GPS',
        urlPainel: WALKER,
        tokenPainel: CHAVE,
      },
    })
    assert.equal(r.status, 201, JSON.stringify(r.body))
    walker.paginas.push({
      ok: 1,
      cursor: 10,
      more: false,
      batches: [
        {
          deviceId: 'gps-2998',
          firmware: '1.9.2',
          points: [ponto(0, 1)],
          status: { fix: '3D', satsUsed: 9, online: true },
        },
      ],
    })
    const lidos = await api('/rastreadores/ler-agora', { method: 'POST' })
    assert.equal(lidos.status, 200, JSON.stringify(lidos.body))
    const g = lidos.body.find((x: { deviceId: string }) => x.deviceId === 'gps-2998')
    assert.ok(g)
    assert.equal(g.satelites, 9)
    assert.equal(g.ultimaLatitude, -23.5)
    assert.equal(g.viagem, null)
    rastreadorId = g.id
    // O cursor guardado vai na próxima leitura.
    await api('/rastreadores/ler-agora', { method: 'POST' })
    assert.ok(walker.chamadas.at(-1)?.endsWith('?after=10'))
  })

  it('põe a placa do caminhão no aparelho', async () => {
    const r = await api(`/rastreadores/${rastreadorId}`, {
      method: 'PUT',
      body: { placa: 'GPS-1A23', descricao: 'Truck 1' },
    })
    assert.equal(r.status, 200, JSON.stringify(r.body))
    assert.equal(r.body.placa, 'GPS1A23')
    assert.equal(r.body.historico[0].acao, 'editado')
  })

  it('"Usar rastreador": a viagem começa pelo aparelho e recebe os pontos da leitura', async () => {
    const lote = await criarLote()
    const [v] = (await api(`/viagens/lote/${lote.id}`)).body
    viagemId = v.id
    const r = await api(`/viagens/${viagemId}/rastreador`, {
      method: 'POST',
      body: { rastreadorId },
    })
    assert.equal(r.status, 200, JSON.stringify(r.body))
    assert.equal(r.body.status, 'em_rota')
    assert.equal(r.body.origemGps, 'aparelho')
    assert.equal(r.body.rastreadorAparelho, 'gps-2998')
    assert.equal(r.body.placa, 'GPS1A23')
    // Sem link e sem código: o aparelho não tem app.
    assert.equal(r.body.linkMotorista, null)
    assert.equal(r.body.codigoChegada, null)

    // Aparelho ocupado não vai em outra viagem.
    const outro = await criarLote()
    const [w] = (await api(`/viagens/lote/${outro.id}`)).body
    const ocupado = await api(`/viagens/${w.id}/rastreador`, {
      method: 'POST',
      body: { rastreadorId },
    })
    assert.equal(ocupado.status, 409)
    assert.equal(ocupado.body.code, 'tracker_in_use')

    walker.paginas.push({
      ok: 1,
      cursor: 12,
      more: false,
      batches: [{ deviceId: 'gps-2998', points: [ponto(1, 2), ponto(2, 3), ponto(2, 3)] }],
    })
    await api('/rastreadores/ler-agora', { method: 'POST' })
    const d = (await api(`/viagens/${viagemId}`)).body
    assert.equal(d.trajeto.length, 2)
    assert.equal(d.totalPontos, 2)
    assert.ok(d.distanciaMetros > 0)
    assert.equal(d.posicao.latitude, -23.502)
    const lista = (await api('/rastreadores')).body
    assert.equal(lista[0].viagem.id, viagemId)
  })

  it('o operador finaliza: viagem terminada, trajeto guardado e aparelho livre', async () => {
    const r = await api(`/viagens/${viagemId}/finalizar`, { method: 'POST' })
    assert.equal(r.status, 200, JSON.stringify(r.body))
    assert.equal(r.body.status, 'finalizada')
    assert.equal(r.body.trajeto.length, 2)
    const lista = (await api('/rastreadores')).body
    assert.equal(lista[0].viagem, null)
    const gpx = await fetch(`${base}/viagens/${viagemId}/exportar/gpx`)
    assert.equal(gpx.status, 200)
  })

  it('chave recusada: o erro fica na Integração', async () => {
    walker.recusar = true
    await api('/rastreadores/ler-agora', { method: 'POST' })
    walker.recusar = false
    const i = (await api('/integracoes')).body.find(
      (x: { sistema: string }) => x.sistema === 'GPS_CAMINHAO',
    )
    assert.match(i.ultimoErro ?? '', /recusou/)
  })
})
