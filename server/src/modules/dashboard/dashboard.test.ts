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
import { diaNoFuso, somarDias } from '../../shared/datas.js'

/*
 * Operação › Dashboard — lotes em várias etapas (as etapas depois de "agendado" são gravadas
 * direto no banco, como a integração fará) e o cálculo de SLA, previsão e mapa.
 */

const DIA = 86_400_000
let db: Db
let base: string
let pasta: string
let fechar: () => void
let microsoftId: string
let siteId: string
const hoje = diaNoFuso()

async function api(caminho: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${base}${caminho}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const texto = await res.text()
  return { status: res.status, body: texto ? JSON.parse(texto) : undefined }
}

async function criarLote(docaId: string, dataColeta: string, pallets = 2) {
  const form = new FormData()
  form.append(
    'dados',
    JSON.stringify({
      clienteId: microsoftId,
      siteId,
      docaId,
      dataColeta,
      rastrear: false,
      servicos: { recycleOnly: true },
      quantidades: { pallets, racks: 1 },
      escopo: 'Coleta de teste',
    }),
  )
  const res = await fetch(`${base}/ordens`, { method: 'POST', body: form })
  const corpo = JSON.parse(await res.text())
  assert.equal(res.status, 201, JSON.stringify(corpo))
  return corpo.id as string
}

/** Leva o lote para uma etapa, com a chegada há `diasDesdeChegada` dias. */
async function mover(
  id: string,
  status: string,
  diasDesdeChegada: number,
  codDepoisDe: number | null = null,
) {
  const recebido = new Date(Date.now() - diasDesdeChegada * DIA)
  await db
    .updateTable('ordens')
    .set({
      status,
      recebidoEm: recebido.toISOString(),
      etapaDesde: new Date(Date.now() - DIA).toISOString(),
      codEmitidoEm:
        codDepoisDe === null
          ? null
          : new Date(recebido.getTime() + codDepoisDe * DIA).toISOString(),
    })
    .where('id', '=', id)
    .execute()
}

before(async () => {
  pasta = await mkdtemp(path.join(os.tmpdir(), 'ierp-dashboard-'))
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  await semear(db)
  const servidor = criarApp(db, { arquivosDir: pasta }).listen(0)
  await new Promise((ok) => servidor.once('listening', ok))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
  fechar = () => servidor.close()

  const cliente = await api('/clientes', {
    method: 'POST',
    body: {
      nome: 'Microsoft do Brasil',
      cnpj: '11.444.777/0001-61',
      slaDias: 15,
      contatos: [
        { nome: null, email: 'dc@microsoft.exemplo.com', telefone: '11987654321', principal: true },
      ],
    },
  })
  assert.equal(cliente.status, 201, JSON.stringify(cliente.body))
  assert.equal(cliente.body.slaDias, 15)
  microsoftId = cliente.body.id
  const doca = {
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
  }
  const base2 = {
    regiao: null,
    horario: null,
    totalGaylords: null,
    cep: null,
    endereco: null,
    shredderProprio: false,
    edgeSite: false,
    docas: [doca],
  }
  const site = await api(`/clientes/${microsoftId}/sites`, {
    method: 'POST',
    body: { ...base2, codigo: 'CPQ01', latitude: -22.82, longitude: -47.27 },
  })
  assert.equal(site.status, 201)
  siteId = site.body.id
  // Site sem pino no mapa.
  await api(`/clientes/${microsoftId}/sites`, {
    method: 'POST',
    body: { ...base2, codigo: 'CPQ02', latitude: null, longitude: null },
  })
  const docaId = site.body.docas[0].id

  const atrasado = await criarLote(docaId, somarDias(hoje, -30))
  await mover(atrasado, 'processo', 20) // 20 > 15 → atrasado 5 dias
  const risco = await criarLote(docaId, somarDias(hoje, -20))
  await mover(risco, 'inspecao', 13) // 13/15 = 87% → em risco
  const cod = await criarLote(docaId, somarDias(hoje, -5))
  await mover(cod, 'aguardando_cod', 2) // no prazo
  const fechadoNoPrazo = await criarLote(docaId, somarDias(hoje, -15))
  await mover(fechadoNoPrazo, 'concluido', 12, 10) // COD em 10 dias ≤ 15
  const fechadoAtrasado = await criarLote(docaId, somarDias(hoje, -25))
  await mover(fechadoAtrasado, 'concluido', 25, 20) // COD em 20 dias > 15
  await criarLote(docaId, somarDias(hoje, 1), 3) // chega amanhã
  await criarLote(docaId, somarDias(hoje, 10)) // fora dos 7 dias
})

after(async () => {
  fechar()
  await db.destroy()
  await rm(pasta, { recursive: true, force: true })
})

describe('dashboard › operação', () => {
  it('cards: em processo por etapa, SLA vencido/em risco, cumprimento e COD pendente', async () => {
    const { status, body } = await api('/dashboard/operacao')
    assert.equal(status, 200)
    assert.deepEqual(body.cards.emProcesso, {
      total: 3,
      inspecao: 1,
      processo: 1,
      aguardandoCod: 1,
    })
    assert.equal(body.cards.slaVencido, 1)
    assert.equal(body.cards.slaEmRisco, 1)
    assert.equal(body.cards.cumprimentoSla30d, 0.5) // 1 de 2 fechados no prazo
    assert.equal(body.cards.codPendente, 1)
    assert.equal(body.cards.chegadasPrevistas7d, 1)
  })

  it('previsão: os 7 dias a partir de hoje, com os lotes agendados pela data de coleta', async () => {
    const { body } = await api('/dashboard/operacao')
    assert.equal(body.forecast.length, 7)
    assert.equal(body.forecast[0].dia, hoje)
    const amanha = body.forecast[1]
    assert.equal(amanha.lotes.length, 1)
    assert.equal(amanha.lotes[0].pallets, 3)
    assert.equal(amanha.lotes[0].siteCodigo, 'CPQ01')
  })

  it('por cliente e anomalias de prazo', async () => {
    const { body } = await api('/dashboard/operacao')
    const ms = body.porCliente.find((c: { clienteId: string }) => c.clienteId === microsoftId)
    assert.equal(ms.slaDias, 15)
    assert.equal(ms.emProcesso, 3)
    assert.equal(ms.atrasados, 1)
    assert.equal(ms.emRisco, 1)
    assert.equal(ms.slaCumprido30d, 0.5)
    assert.equal(ms.situacao, 'atrasado')
    assert.ok(body.porCliente.some((c: { situacao: string }) => c.situacao === 'sem_sla'))
    // Mais grave primeiro.
    assert.equal(body.lotes[0].etapa, 'processo')
    assert.deepEqual(body.lotes[0].anomalias, [{ tipo: 'atrasado', dias: 5 }])
    assert.equal(body.lotes[0].restante, -5)
    assert.equal(body.lotes[1].anomalias[0].tipo, 'risco')
    assert.deepEqual(body.lotes[2].anomalias, [])
  })

  it('mapa: sites do cliente Microsoft com as coletas do período', async () => {
    const semana = await api(
      `/dashboard/operacao?mapaDe=${somarDias(hoje, -30)}&mapaAte=${somarDias(hoje, 30)}`,
    )
    assert.equal(semana.body.mapa.clienteEncontrado, true)
    assert.equal(semana.body.mapa.pontos.length, 1)
    assert.equal(semana.body.mapa.pontos[0].coletas, 7)
    assert.deepEqual(
      semana.body.mapa.semLocalizacao.map((s: { siteCodigo: string }) => s.siteCodigo),
      ['CPQ02'],
    )
    const dia = await api(`/dashboard/operacao?mapaDe=${hoje}&mapaAte=${hoje}`)
    assert.equal(dia.body.mapa.pontos[0].coletas, 0)
  })
})
