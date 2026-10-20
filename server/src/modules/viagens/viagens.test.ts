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
import { statusDoRastreador, urlDaMidia } from './rastreador.js'
import {
  criarServicoViagens,
  escolherViagem,
  trajetoDe,
  type ServicoViagens,
  type Viagem,
} from './viagens.js'

/*
 * Ordens › Viagens (20/10/2026): a viagem nasce no agendamento, é amarrada à viagem do
 * rastreador de GPS (ReTeckTracker) pelo código do lote, recebe o código de chegada, acompanha
 * posição/chegada/emergência, termina pelo rastreador, pelo operador ou pelo recebimento e tem o
 * trajeto arquivado. Os lotes de fora (MSDC/Gerenciamento) aparecem só para ver.
 *
 * O rastreador é FALSO (em memória), com as mesmas rotas e a mesma chave interna do de verdade.
 */

const RASTREADOR = 'https://rastreador.teste'
const CHAVE = 'chave-interna-de-teste'

interface TripFalsa {
  tripId: number
  clientName: string
  serviceOrder: string
  driverName: string
  plate: string
  status: string
  startedAt: string
  endedAt: string | null
  points: { latitude: number; longitude: number; speedMps: number | null; recordedAt: string }[]
  codigoHash: string | null
  ack: boolean
}

const rastreador = {
  trips: [] as TripFalsa[],
  chat: [] as { tripId: number; sender: string; text: string }[],
  chamadas: [] as string[],
  foraDoAr: false,
  overpassPrincipalFora: false,
  /** Como o hub de verdade: ao encerrar, avisa "terminou" (antes de responder). */
  aoEncerrar: null as ((tripId: number) => unknown) | null,
}

let db: Db
let base: string
let pasta: string
let fechar: () => void
let servico: ServicoViagens
let clienteId: string
let siteId: string
let docaId: string
let motoristaId: string
let motoristaNome: string

const resumo = (t: TripFalsa) => ({
  tripId: t.tripId,
  clientName: t.clientName,
  serviceOrder: t.serviceOrder,
  driverName: t.driverName,
  plate: t.plate,
  status: t.status,
  startedAt: t.startedAt,
  endedAt: t.endedAt,
  pointCount: t.points.length,
  lastPoint: t.points.at(-1) ?? null,
})

const fetchFalso = (async (url: string | URL | Request, init?: RequestInit) => {
  const endereco = String(url)
  if (endereco.startsWith('https://api.tomtom.com/')) {
    rastreador.chamadas.push(endereco)
    return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
      headers: { 'content-type': 'image/png' },
    })
  }
  if (endereco.startsWith('https://overpass-api.de/') && rastreador.overpassPrincipalFora)
    return new Response('# 502 Gateway Timeout', { status: 502 })
  if (
    endereco.startsWith('https://overpass-api.de/') ||
    endereco.startsWith('https://overpass.private.coffee/')
  ) {
    rastreador.chamadas.push(endereco.startsWith('https://overpass-api') ? 'overpass' : 'reserva')
    return Response.json({
      elements: [
        { lat: -23.5, lon: -46.6, tags: { amenity: 'fuel', name: 'Posto Teste' } },
        { lat: -23.4, lon: -46.5, tags: { amenity: 'weighbridge' } },
      ],
    })
  }
  if (!endereco.startsWith(RASTREADOR)) return new Response('?', { status: 404 })
  if (rastreador.foraDoAr) throw new TypeError('fetch failed')
  const metodo = init?.method ?? 'GET'
  const caminho = endereco.slice(RASTREADOR.length)
  rastreador.chamadas.push(`${metodo} ${caminho}`)
  if (new Headers(init?.headers).get('X-Api-Key') !== CHAVE)
    return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 })
  const lista = caminho.match(/^\/api\/trips\?serviceOrder=(.+)$/)
  if (lista) {
    const so = decodeURIComponent(lista[1]!)
    return Response.json(rastreador.trips.filter((t) => t.serviceOrder === so).map(resumo))
  }
  const m = caminho.match(/^\/api\/trips\/(\d+)(\/.*)?$/)
  const t = m ? rastreador.trips.find((x) => x.tripId === Number(m[1])) : undefined
  if (!m || !t) return Response.json({ error: 'não encontrada' }, { status: 404 })
  const resto = m[2] ?? ''
  const corpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, string>) : {}
  if (resto === '' && metodo === 'GET') return Response.json({ ...resumo(t), points: t.points })
  if (resto === '/arrival-code') {
    t.codigoHash = corpo.code ?? null
    return Response.json({ ok: true })
  }
  if (resto === '/end') {
    if (t.status === 'Finalizada')
      return Response.json({ tripId: t.tripId, message: 'Viagem já finalizada.' })
    t.status = 'Finalizada'
    t.endedAt = new Date().toISOString()
    void rastreador.aoEncerrar?.(t.tripId)
    return Response.json({ tripId: t.tripId, message: 'Viagem finalizada.' })
  }
  if (resto === '/stops')
    return Response.json([
      {
        id: 1,
        reason: 'Almoço',
        latitude: -23.4,
        longitude: -46.7,
        mediaUrl: '/api/media/abc',
        createdAt: '2026-10-20T15:00:00Z',
      },
    ])
  if (resto === '/chat' && metodo === 'GET')
    return Response.json(
      rastreador.chat
        .filter((c) => c.tripId === t.tripId)
        .map((c, i) => ({
          id: i + 1,
          sender: c.sender,
          text: c.text,
          mediaUrl: null,
          createdAt: '2026-10-20T15:00:00Z',
        })),
    )
  if (resto === '/chat/internal') {
    rastreador.chat.push({ tripId: t.tripId, sender: 'operador', text: corpo.text ?? '' })
    return Response.json({ ok: true, id: rastreador.chat.length })
  }
  if (resto === '/emergency/ack') {
    t.ack = true
    return Response.json({ ok: true })
  }
  return Response.json({ error: '?' }, { status: 404 })
}) as typeof fetch

async function api(caminho: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${base}${caminho}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const texto = await res.text()
  const json = res.headers.get('content-type')?.includes('json')
  return { status: res.status, body: texto && json ? JSON.parse(texto) : undefined }
}

async function criarOrdem(extra: Record<string, unknown> = {}) {
  const form = new FormData()
  form.append(
    'dados',
    JSON.stringify({
      clienteId,
      siteId,
      docaId,
      transportadoraId: null,
      referenciaCliente: null,
      coletaPrevista: '2026-10-25',
      dataColeta: null,
      dataChegada: null,
      rastrear: true,
      motoristaId,
      placa: 'ABC1D23',
      servicos: {
        psm: false,
        onsiteShredding: false,
        recycleOnly: true,
        valueRecoveryRacks: false,
        valueRecoveryItad: false,
      },
      quantidades: {
        boxes: null,
        pallets: 4,
        gaylords: null,
        racks: null,
        placasPolicarbonato: null,
        requerPalletsVazios: false,
        palletsVazios: null,
        itensMais25kg: false,
        fatorLimitante: null,
      },
      escopo: 'Coleta de servidores.',
      observacoes: null,
      ...extra,
    }),
  )
  const res = await fetch(`${base}/ordens`, { method: 'POST', body: form })
  const body = JSON.parse(await res.text())
  assert.equal(res.status, 201, JSON.stringify(body))
  return body as { id: string; codigo: string }
}

async function receber(ordemId: string) {
  const form = new FormData()
  form.append(
    'dados',
    JSON.stringify({
      dataRecebimento: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
        new Date(),
      ),
      inspecao: 'bom',
      inspecaoDescricao: null,
      lacres: [{ numero: 'LAC-9' }],
      notas: [{ numero: '999' }],
      pallets: [{ pesoBruto: 100, tara: null }],
    }),
  )
  for (const [campo, nome] of [
    ['lacres.0', 'l.jpg'],
    ['notas.0', 'n.jpg'],
    ['pallets.0', 'p.jpg'],
    ['gerais', 'g.jpg'],
  ])
    form.append(campo!, new Blob([nome!]), nome)
  const res = await fetch(`${base}/ordens/${ordemId}/recebimento`, { method: 'POST', body: form })
  assert.equal(res.status, 201, await res.text())
}

/** Espera o trabalho em segundo plano (o recebimento avisa o rastreador por fora). */
async function ate(cond: () => boolean | Promise<boolean>, ms = 2000) {
  const fim = Date.now() + ms
  while (Date.now() < fim) {
    if (await cond()) return
    await new Promise((ok) => setTimeout(ok, 10))
  }
}

const abertas = async () => (await api('/viagens')).body.viagens as Viagem[]
const viagemDoLote = async (codigo: string) =>
  (await abertas()).find((v) => v.loteCodigo === codigo)
const historicoDoLote = async (id: string) =>
  ((await api(`/ordens/${id}`)).body.historico as { acao: string; nota?: string }[]).map(
    (h) => h.acao,
  )

let proximoTrip = 100
function trip(serviceOrder: string, extra: Partial<TripFalsa> = {}): TripFalsa {
  const t: TripFalsa = {
    tripId: proximoTrip++,
    clientName: 'TechNova',
    serviceOrder,
    driverName: 'João da Silva',
    plate: 'ABC1D23',
    status: 'Ativa',
    startedAt: new Date().toISOString(),
    endedAt: null,
    points: [
      { latitude: -23.55, longitude: -46.63, speedMps: 10, recordedAt: '2026-10-20T14:00:00Z' },
      { latitude: -23.56, longitude: -46.64, speedMps: 12, recordedAt: '2026-10-20T14:01:00Z' },
      // Repetido (fila offline do app): sai no arquivo.
      { latitude: -23.56, longitude: -46.64, speedMps: 12, recordedAt: '2026-10-20T14:01:00Z' },
    ],
    codigoHash: null,
    ack: false,
    ...extra,
  }
  rastreador.trips.push(t)
  return t
}

before(async () => {
  pasta = await mkdtemp(path.join(os.tmpdir(), 'ierp-viagens-'))
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  await semear(db)
  servico = criarServicoViagens(db, { fetch: fetchFalso })
  const servidor = criarApp(db, {
    arquivosDir: pasta,
    fetchExterno: fetchFalso,
    viagens: servico,
  }).listen(0)
  await new Promise((ok) => servidor.once('listening', ok))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
  fechar = () => servidor.close()
  clienteId = (await api('/clientes?q=technova')).body.rows[0].id
  const site = await api(`/clientes/${clienteId}/sites`, {
    method: 'POST',
    body: {
      codigo: 'DC-GPS',
      regiao: null,
      horario: null,
      totalGaylords: null,
      cep: null,
      endereco: 'Av. Teste, 100',
      latitude: -23.5,
      longitude: -46.6,
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
  assert.equal(site.status, 201, JSON.stringify(site.body))
  siteId = site.body.id
  docaId = site.body.docas[0].id
  const m = (await api('/motoristas')).body.rows[0]
  motoristaId = m.id
  motoristaNome = m.nome
})

after(async () => {
  fechar()
  await db.destroy()
  await rm(pasta, { recursive: true, force: true })
})

describe('viagens › regras', () => {
  it('lê a situação do rastreador (com e sem acento)', () => {
    assert.equal(statusDoRastreador('Ativa'), 'em_rota')
    assert.equal(statusDoRastreador('AguardandoConfirmação'), 'chegou')
    assert.equal(statusDoRastreador('AguardandoConfirmacao'), 'chegou')
    assert.equal(statusDoRastreador('Finalizada'), 'finalizada')
    assert.equal(statusDoRastreador('???'), null)
  })

  it('trajeto sem pontos repetidos, na ordem do relógio', () => {
    const t = trajetoDe([
      { latitude: 2, longitude: 2, recordedAt: '2026-10-20T10:01:00Z' },
      { latitude: 1, longitude: 1, recordedAt: '2026-10-20T10:00:00Z' },
      { latitude: 2, longitude: 2, recordedAt: '2026-10-20T10:01:00Z' },
    ])
    assert.deepEqual(
      t.map((p) => p.latitude),
      [1, 2],
    )
  })

  it('nunca amarra uma viagem velha com o mesmo código (de antes de a viagem nascer aqui)', () => {
    const criadoEm = '2026-10-20T12:00:00.000Z'
    const velha = {
      tripId: 1,
      clientName: '',
      serviceOrder: 'LOT-1',
      driverName: '',
      plate: '',
      status: 'Finalizada',
      startedAt: '2026-10-01T12:00:00Z',
      endedAt: '2026-10-01T15:00:00Z',
      pointCount: 0,
      lastPoint: null,
    }
    assert.equal(escolherViagem({ tripId: null, criadoEm }, [velha]), null)
    const nova = { ...velha, tripId: 2, status: 'Ativa', startedAt: '2026-10-20T13:00:00Z' }
    assert.equal(escolherViagem({ tripId: null, criadoEm }, [velha, nova])?.tripId, 2)
  })
})

describe('viagens › rastreador em Administração › Integração', () => {
  it('sem rastreador cadastrado, a tela diz que não está configurado', async () => {
    const r = await api('/viagens')
    assert.equal(r.status, 200)
    assert.equal(r.body.configurado, false)
  })

  it('é o sistema "rastreio"; a chave do trânsito nunca sai do servidor', async () => {
    const sistemas = (await api('/integracoes/sistemas')).body as {
      sistema: string
      tipo: string
    }[]
    assert.ok(sistemas.some((s) => s.sistema === 'RASTREADOR' && s.tipo === 'rastreio'))
    const criada = await api('/integracoes', {
      method: 'POST',
      body: {
        sistema: 'RASTREADOR',
        nome: 'Rastreador de GPS',
        urlPainel: `${RASTREADOR}/`,
        tokenPainel: CHAVE,
        chaveTransito: 'tomtom-123',
      },
    })
    assert.equal(criada.status, 201, JSON.stringify(criada.body))
    assert.equal(criada.body.temChaveTransito, true)
    assert.ok(!JSON.stringify(criada.body).includes('tomtom-123'))
    const r = await api('/viagens')
    assert.equal(r.body.configurado, true)
    assert.equal(r.body.temTransito, true)
  })
})

describe('viagens › do agendamento ao arquivo', () => {
  let lote: { id: string; codigo: string }

  it('agendar com "Rastrear = Sim" cria a viagem aguardando o motorista, com código e link', async () => {
    lote = await criarOrdem()
    const v = await viagemDoLote(lote.codigo)
    assert.ok(v)
    assert.equal(v.status, 'aguardando_motorista')
    const codigo = v.codigoChegada ?? ''
    const linkMotorista = v.linkMotorista ?? ''
    assert.match(codigo, /^[1-9]\d{5}$/)
    assert.equal(v.somenteLeitura, false)
    const link = new URL(linkMotorista)
    assert.equal(link.origin + link.pathname, `${RASTREADOR}/app/`)
    assert.equal(link.searchParams.get('os'), lote.codigo)
    assert.equal(link.searchParams.get('driver'), motoristaNome)
    assert.equal(link.searchParams.get('plate'), 'ABC1D23')
    // O código de chegada e o CPF nunca vão no link.
    assert.ok(!linkMotorista.includes(codigo))
    assert.equal(link.searchParams.get('cpf'), null)
  })

  it('agendar sem rastreio não cria viagem; ligar na edição cria, desligar cancela', async () => {
    const outro = await criarOrdem({ rastrear: false, motoristaId: null, placa: null })
    assert.equal(await viagemDoLote(outro.codigo), undefined)
    const completo = (await api(`/ordens/${outro.id}`)).body
    const editar = (rastrear: boolean) => ({
      clienteId,
      siteId,
      docaId,
      transportadoraId: null,
      referenciaCliente: null,
      coletaPrevista: '2026-10-25',
      dataColeta: null,
      dataChegada: null,
      rastrear,
      motoristaId: rastrear ? motoristaId : null,
      placa: rastrear ? 'XYZ9A88' : null,
      servicos: completo.servicos,
      quantidades: completo.quantidades,
      escopo: completo.escopo,
      observacoes: null,
    })
    const ligou = await api(`/ordens/${outro.id}`, { method: 'PUT', body: editar(true) })
    assert.equal(ligou.status, 200, JSON.stringify(ligou.body))
    assert.equal((await viagemDoLote(outro.codigo))?.status, 'aguardando_motorista')
    const desligou = await api(`/ordens/${outro.id}`, { method: 'PUT', body: editar(false) })
    assert.equal(desligou.status, 200)
    assert.equal(await viagemDoLote(outro.codigo), undefined)
    assert.ok((await historicoDoLote(outro.id)).includes('viagem_cancelada'))
  })

  it('a conferência amarra a viagem do rastreador e grava o código de chegada lá', async () => {
    // Uma viagem velha de teste com o mesmo código: ignorada.
    trip(lote.codigo, { status: 'Finalizada', startedAt: '2026-01-01T10:00:00Z' })
    const t = trip(lote.codigo)
    await servico.sincronizar()
    const v = await viagemDoLote(lote.codigo)
    assert.equal(v?.status, 'em_rota')
    assert.equal(v?.tripId, t.tripId)
    assert.equal(v?.motoristaNome, 'João da Silva')
    assert.equal(v?.posicao?.latitude, -23.56)
    assert.equal(t.codigoHash, v?.codigoChegada)
    assert.ok((await historicoDoLote(lote.id)).includes('viagem_iniciada'))
    // Idempotente: conferir de novo não regrava o código nem repete o histórico.
    const antes = rastreador.chamadas.filter((c) => c.endsWith('/arrival-code')).length
    await servico.sincronizar()
    assert.equal(rastreador.chamadas.filter((c) => c.endsWith('/arrival-code')).length, antes)
    assert.equal((await historicoDoLote(lote.id)).filter((a) => a === 'viagem_iniciada').length, 1)
  })

  it('viagem na rua não se desliga pela edição do lote', async () => {
    const completo = (await api(`/ordens/${lote.id}`)).body
    const r = await api(`/ordens/${lote.id}`, {
      method: 'PUT',
      body: {
        clienteId,
        siteId,
        docaId,
        transportadoraId: null,
        referenciaCliente: 'mudou',
        coletaPrevista: '2026-10-25',
        dataColeta: null,
        dataChegada: null,
        rastrear: false,
        motoristaId: null,
        placa: null,
        servicos: completo.servicos,
        quantidades: completo.quantidades,
        escopo: completo.escopo,
        observacoes: null,
      },
    })
    assert.equal(r.status, 409)
    assert.equal(r.body.code, 'trip_in_progress')
  })

  it('ao vivo: posição, "cheguei", emergência e ciência', async () => {
    const v = (await viagemDoLote(lote.codigo))!
    await servico.tempoReal.ponto({
      tripId: v.tripId,
      latitude: -23.6,
      longitude: -46.7,
      speedMps: 5,
      recordedAt: '2026-10-20T14:05:00Z',
    })
    assert.equal((await viagemDoLote(lote.codigo))?.posicao?.latitude, -23.6)
    await servico.tempoReal.emergencia({
      tripId: v.tripId,
      type: 'acidente',
      lat: -23.6,
      lon: -46.7,
    })
    const comAlerta = (await viagemDoLote(lote.codigo))!
    assert.equal(comAlerta.emergencia?.tipo, 'acidente')
    assert.equal(comAlerta.emergencia?.cienteEm, null)
    const ciente = await api(`/viagens/${v.id}/emergencia/ciente`, { method: 'POST' })
    assert.equal(ciente.status, 200, JSON.stringify(ciente.body))
    assert.ok(ciente.body.emergencia.cienteEm)
    assert.equal(rastreador.trips.find((t) => t.tripId === v.tripId)?.ack, true)
    assert.equal((await api(`/viagens/${v.id}/emergencia/ciente`, { method: 'POST' })).status, 409)
    await servico.tempoReal.aguardandoConfirmacao({ tripId: v.tripId })
    assert.equal((await viagemDoLote(lote.codigo))?.status, 'chegou')
    const acoes = await historicoDoLote(lote.id)
    for (const a of ['viagem_emergencia', 'viagem_emergencia_ciente', 'viagem_chegou'])
      assert.ok(acoes.includes(a), a)
  })

  it('chat com o motorista pelo rastreador', async () => {
    const v = (await viagemDoLote(lote.codigo))!
    const r = await api(`/viagens/${v.id}/chat`, { method: 'POST', body: { texto: 'Tudo bem?' } })
    assert.equal(r.status, 201, JSON.stringify(r.body))
    assert.deepEqual(
      (r.body as unknown as { remetente: string; texto: string }[]).map((m) => [
        m.remetente,
        m.texto,
      ]),
      [['operador', 'Tudo bem?']],
    )
    assert.equal(
      (await api(`/viagens/${v.id}/chat`, { method: 'POST', body: { texto: ' ' } })).status,
      422,
    )
  })

  it('o detalhe traz o trajeto e as paradas (foto com o endereço do rastreador)', async () => {
    const v = (await viagemDoLote(lote.codigo))!
    const d = (await api(`/viagens/${v.id}`)).body
    assert.equal(d.trajeto.length, 2)
    assert.equal(d.paradas[0].motivo, 'Almoço')
    assert.equal(d.paradas[0].fotoUrl, `${RASTREADOR}/api/media/abc`)
  })

  it('o operador finaliza: o rastreador encerra e o trajeto fica arquivado aqui', async () => {
    const v = (await viagemDoLote(lote.codigo))!
    const r = await api(`/viagens/${v.id}/finalizar`, { method: 'POST' })
    assert.equal(r.status, 200, JSON.stringify(r.body))
    assert.equal(r.body.status, 'finalizada')
    assert.equal(r.body.finalizadaPor, 'operador')
    assert.equal(rastreador.trips.find((t) => t.tripId === v.tripId)?.status, 'Finalizada')
    assert.equal(await viagemDoLote(lote.codigo), undefined)
    const finalizadas = (await api('/viagens?situacao=finalizadas')).body.viagens
    const f = finalizadas.find((x: { id: string }) => x.id === v.id)
    assert.equal(f.totalPontos, 2)
    assert.ok(f.distanciaMetros > 1000)
    assert.equal(f.linkMotorista, null)
    // O replay não depende mais do rastreador.
    rastreador.foraDoAr = true
    const d = (await api(`/viagens/${v.id}`)).body
    rastreador.foraDoAr = false
    assert.equal(d.trajeto.length, 2)
    assert.equal(d.paradas.length, 1)
    assert.equal((await api(`/viagens/${v.id}/chat`)).body.length, 1)
    assert.equal((await api(`/viagens/${v.id}/finalizar`, { method: 'POST' })).status, 409)
  })

  it('o motorista encerra com o código depois do "Cheguei": arquiva e diz que foi ele', async () => {
    const outro = await criarOrdem()
    const t = trip(outro.codigo)
    await servico.sincronizar()
    await servico.tempoReal.aguardandoConfirmacao({ tripId: t.tripId })
    t.status = 'Finalizada'
    t.endedAt = new Date().toISOString()
    await servico.tempoReal.viagemTerminada({ tripId: t.tripId })
    const f = (await api('/viagens?situacao=finalizadas')).body.viagens.find(
      (x: { loteCodigo: string }) => x.loteCodigo === outro.codigo,
    )
    assert.equal(f.status, 'finalizada')
    assert.equal(f.finalizadaPor, 'motorista')
  })
})

describe('viagens › recebimento', () => {
  it('receber o lote encerra a viagem na rua (e cancela a que esperava o motorista)', async () => {
    const naRua = await criarOrdem()
    const t = trip(naRua.codigo)
    const esperando = await criarOrdem()
    await servico.sincronizar()
    await receber(naRua.id)
    await ate(() => t.status === 'Finalizada')
    assert.equal(t.status, 'Finalizada')
    await receber(esperando.id)
    await new Promise((ok) => setTimeout(ok, 50))
    const finalizadas = (await api('/viagens?situacao=finalizadas')).body.viagens as Viagem[]
    const a = finalizadas.find((x) => x.loteCodigo === naRua.codigo)!
    assert.equal(a.status, 'finalizada')
    assert.equal(a.finalizadaPor, 'recebimento')
    assert.equal(a.totalPontos, 2)
    const b = finalizadas.find((x) => x.loteCodigo === esperando.codigo)!
    assert.equal(b.status, 'cancelada')
  })

  it('rastreador fora do ar não segura o recebimento: avisa na próxima conferência', async () => {
    const lote = await criarOrdem()
    const t = trip(lote.codigo)
    await servico.sincronizar()
    rastreador.foraDoAr = true
    await receber(lote.id)
    await new Promise((ok) => setTimeout(ok, 50))
    assert.equal(t.status, 'Ativa')
    rastreador.foraDoAr = false
    await servico.sincronizar()
    assert.equal(t.status, 'Finalizada')
    const f = (await api('/viagens?situacao=finalizadas')).body.viagens.find(
      (x: { loteCodigo: string }) => x.loteCodigo === lote.codigo,
    )
    assert.equal(f.finalizadaPor, 'recebimento')
    assert.equal(f.totalPontos, 2)
  })
})

describe('viagens › concorrência (revisão de 20/10/2026)', () => {
  const viagemDe = (codigo: string) =>
    db
      .selectFrom('ordensViagens as v')
      .innerJoin('ordens as o', 'o.id', 'v.ordemId')
      .selectAll('v')
      .where('o.codigo', '=', codigo)
      .executeTakeFirstOrThrow()
  const contar = async (ordemId: string, acao: string) =>
    (await historicoDoLote(ordemId)).filter((a) => a === acao).length

  it('Finalizar e o aviso "terminou" do rastreador ao mesmo tempo: um registro só, pelo operador', async () => {
    const lote = await criarOrdem()
    const t = trip(lote.codigo)
    await servico.sincronizar()
    const v = await viagemDe(lote.codigo)
    // O rastreador avisa "terminou" enquanto o Finalizar ainda está em andamento.
    const avisos: Promise<unknown>[] = []
    rastreador.aoEncerrar = (tripId) =>
      avisos.push(servico.tempoReal.viagemTerminada({ tripId }), servico.sincronizar())
    const r = await api(`/viagens/${v.id}/finalizar`, { method: 'POST' })
    rastreador.aoEncerrar = null
    await Promise.all(avisos)
    assert.equal(r.status, 200, JSON.stringify(r.body))
    assert.equal(t.status, 'Finalizada')
    const depois = await viagemDe(lote.codigo)
    assert.equal(depois.finalizadaPor, 'operador')
    assert.equal(depois.arquivada, 1)
    assert.equal(await contar(lote.id, 'viagem_finalizada'), 1)
  })

  it('o "Cheguei" atrasado não reabre a viagem já recebida', async () => {
    const lote = await criarOrdem()
    const t = trip(lote.codigo)
    await servico.sincronizar()
    await receber(lote.id)
    await servico.tempoReal.aguardandoConfirmacao({ tripId: t.tripId })
    t.status = 'AguardandoConfirmação'
    await servico.sincronizar()
    assert.equal((await viagemDe(lote.codigo)).status, 'finalizada')
  })

  it('emergência que chega antes de a viagem ser amarrada não se perde', async () => {
    const lote = await criarOrdem()
    const t = trip(lote.codigo)
    await servico.tempoReal.emergencia({ tripId: t.tripId, type: 'Assalto' })
    await ate(async () => (await viagemDe(lote.codigo)).emergenciaEm !== null)
    const v = await viagemDe(lote.codigo)
    assert.equal(v.tripId, t.tripId)
    assert.equal(v.emergenciaTipo, 'assalto')
    assert.equal(await contar(lote.id, 'viagem_emergencia'), 1)
  })

  it('o código de chegada é gravado no rastreador uma vez só, mesmo com eventos repetidos', async () => {
    const lote = await criarOrdem()
    const t = trip(lote.codigo)
    const evento = {
      tripId: t.tripId,
      serviceOrder: lote.codigo,
      clientName: 'TechNova',
      driverName: t.driverName,
      plate: t.plate,
      status: 'Ativa',
      startedAt: t.startedAt,
      pointCount: 0,
    }
    await Promise.all([
      servico.tempoReal.viagemIniciada(evento),
      servico.tempoReal.viagemIniciada(evento),
      servico.sincronizar(),
    ])
    const gravacoes = rastreador.chamadas.filter(
      (c) => c === `POST /api/trips/${t.tripId}/arrival-code`,
    ).length
    assert.equal(gravacoes, 1)
    assert.equal(await contar(lote.id, 'viagem_iniciada'), 1)
  })

  it('receber logo depois de o motorista sair (ainda não amarrada) encerra a viagem lá', async () => {
    const lote = await criarOrdem()
    const t = trip(lote.codigo)
    await receber(lote.id)
    await ate(() => t.status === 'Finalizada')
    assert.equal(t.status, 'Finalizada')
    const v = await viagemDe(lote.codigo)
    assert.equal(v.status, 'finalizada')
    assert.equal(v.tripId, t.tripId)
    assert.equal(v.arquivada, 1)
  })

  it('desligar o rastreio logo depois de o motorista sair é recusado', async () => {
    const lote = await criarOrdem()
    trip(lote.codigo)
    const completo = (await api(`/ordens/${lote.id}`)).body
    const r = await api(`/ordens/${lote.id}`, {
      method: 'PUT',
      body: {
        clienteId,
        siteId,
        docaId,
        transportadoraId: null,
        referenciaCliente: null,
        coletaPrevista: '2026-10-25',
        dataColeta: null,
        dataChegada: null,
        rastrear: false,
        motoristaId: null,
        placa: null,
        servicos: completo.servicos,
        quantidades: completo.quantidades,
        escopo: completo.escopo,
        observacoes: null,
      },
    })
    assert.equal(r.status, 409)
    assert.equal(r.body.code, 'trip_in_progress')
  })

  it('anexo do chat só do próprio rastreador', () => {
    assert.equal(urlDaMidia(RASTREADOR, '/api/media/abc'), `${RASTREADOR}/api/media/abc`)
    assert.equal(urlDaMidia(RASTREADOR, `${RASTREADOR}/api/media/x`), `${RASTREADOR}/api/media/x`)
    assert.equal(urlDaMidia(RASTREADOR, 'https://golpe.exemplo/api/media/x'), null)
    assert.equal(urlDaMidia(RASTREADOR, '/outra/coisa'), null)
  })
})

describe('viagens › lotes de fora (só para ver)', () => {
  it('acha a viagem do LOT do iERP antigo e mostra sem ações', async () => {
    const lote = await criarOrdem({ rastrear: false, motoristaId: null, placa: null })
    await db
      .updateTable('ordens')
      .set({
        externoSistema: 'MSDC',
        externoId: '12',
        externoDados: JSON.stringify({
          // O `lote` da ordem é o PO do cliente; o LOT do iERP antigo vem no painel.
          ordem: { lote: 'PO-MS004', numero: 'MS004' },
          painel: { id: '12', numero: 'MS004', lote: 'LOT-20260163' },
        }),
      })
      .where('id', '=', lote.id)
      .execute()
    const t = trip('LOT-20260163', { driverName: 'Motorista do antigo' })
    await servico.sincronizar({ forcarDeFora: true })
    const v = (await abertas()).find((x) => x.tripId === t.tripId)
    assert.ok(v)
    assert.equal(v.id, `ext-${t.tripId}`)
    assert.equal(v.somenteLeitura, true)
    assert.equal(v.origem, 'MSDC')
    assert.equal(v.loteCodigo, lote.codigo)
    assert.equal(v.codigoRastreio, 'LOT-20260163')
    assert.equal(v.codigoChegada, null)
    assert.equal(v.linkMotorista, null)
    assert.equal((await api(`/viagens/${v.id}`)).body.trajeto.length, 2)
    assert.equal(
      (await api(`/viagens/${v.id}/finalizar`, { method: 'POST' })).body.code,
      'trip_read_only',
    )
    // Nada foi gravado no rastreador para o lote de fora.
    assert.equal(t.codigoHash, null)
    // Terminou lá: sai da tela.
    await servico.tempoReal.viagemTerminada({ tripId: t.tripId })
    assert.equal(
      (await abertas()).find((x) => x.tripId === t.tripId),
      undefined,
    )
  })
})

describe('viagens › mapa', () => {
  it('trânsito pela chave guardada no servidor; postos e balanças do OpenStreetMap', async () => {
    const tile = await api('/viagens/mapa/transito/10/379/578.png')
    assert.equal(tile.status, 200)
    const tomtom = rastreador.chamadas.find((c) => c.startsWith('https://api.tomtom.com/'))!
    assert.match(
      tomtom,
      /\/traffic\/map\/4\/tile\/flow\/relative0\/10\/379\/578\.png\?key=tomtom-123$/,
    )
    assert.equal((await api('/viagens/mapa/transito/2/9/0.png')).status, 422)
    const pois = await api('/viagens/mapa/pois?s=-23.7&w=-46.8&n=-23.3&e=-46.4')
    assert.equal(pois.status, 200)
    assert.ok((pois.body as unknown as { tipo: string }[]).some((p) => p.tipo === 'balanca'))
    // Guardado: a segunda consulta da mesma região não vai ao Overpass.
    const antes = rastreador.chamadas.filter((c) => c === 'overpass').length
    await api('/viagens/mapa/pois?s=-23.7&w=-46.8&n=-23.3&e=-46.4')
    assert.equal(rastreador.chamadas.filter((c) => c === 'overpass').length, antes)
  })

  it('o Overpass principal ocupado: usa o reserva', async () => {
    rastreador.overpassPrincipalFora = true
    const r = await api('/viagens/mapa/pois?s=-20.2&w=-44.2&n=-20.1&e=-44.1')
    rastreador.overpassPrincipalFora = false
    assert.equal(r.status, 200)
    assert.ok(rastreador.chamadas.includes('reserva'))
  })
})
