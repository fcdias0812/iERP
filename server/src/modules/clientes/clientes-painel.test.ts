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
import { diaNoFuso, somarDias } from '../../shared/datas.js'

/* Clientes › Visão geral: o painel do cliente (HTTP real + SQLite em memória). */

let db: Db
let base: string
let pasta: string
let fechar: () => void
let clienteId: string
let siteId: string
let docaId: string

const DIA = 86_400_000
const hoje = diaNoFuso()
const haDias = (n: number) => new Date(Date.now() - n * DIA).toISOString()

async function api(caminho: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${base}${caminho}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const texto = await res.text()
  return { status: res.status, body: texto ? JSON.parse(texto) : undefined }
}

/** Cria um lote agendado (coleta no dia pedido) e devolve o id. */
async function lote(coletaPrevista: string) {
  const form = new FormData()
  form.append(
    'dados',
    JSON.stringify({
      clienteId,
      siteId,
      docaId,
      transportadoraId: null,
      referenciaCliente: null,
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
      escopo: 'Coleta de teste.',
      observacoes: null,
    }),
  )
  const res = await fetch(`${base}/ordens`, { method: 'POST', body: form })
  const corpo = (await res.json()) as { id: string; juntadoA: unknown }
  assert.equal(res.status, 201, JSON.stringify(corpo))
  return corpo.id
}

/** Põe o lote numa etapa, com as datas de chegada e COD. */
const etapa = (id: string, status: string, recebidoEm: string | null, codEmitidoEm?: string) =>
  db
    .updateTable('ordens')
    .set({ status, recebidoEm, codEmitidoEm: codEmitidoEm ?? null })
    .where('id', '=', id)
    .execute()

const pallet = (ordemId: string, numero: number, pesoKg: number | null) =>
  db
    .insertInto('ordensPallets')
    .values({
      id: randomUUID(),
      ordemId,
      numero,
      pesoKg,
      taraKg: null,
      conteudo: null,
      pesadoPor: 'Teste',
      pesadoEm: haDias(1),
      fotoExtensao: null,
      origem: 'recebimento',
      criadoEm: haDias(1),
    })
    .execute()

const ocorrencia = (
  ordemId: string,
  categoria: string,
  status = 'registrada',
  criadoEm = haDias(2),
) =>
  db
    .insertInto('ordensOcorrencias')
    .values({
      id: randomUUID(),
      ordemId,
      numero: Math.floor(Math.random() * 1e6),
      momento: 'coleta',
      categoria,
      texto: JSON.stringify({ origem: 'pt-BR', textos: { 'pt-BR': 'x' } }),
      status,
      criadoEm,
      criadoPor: 'Teste',
      alteradoEm: criadoEm,
      alteradoPor: 'Teste',
    })
    .execute()

before(async () => {
  pasta = await mkdtemp(path.join(os.tmpdir(), 'ierp-painel-'))
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  await semear(db)
  const servidor = criarApp(db, { arquivosDir: pasta }).listen(0)
  await new Promise((ok) => servidor.once('listening', ok))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
  fechar = () => servidor.close()
  clienteId = (await api('/clientes?q=technova')).body.rows[0].id
  await db.updateTable('clientes').set({ slaDias: 10 }).where('id', '=', clienteId).execute()
  const site = await api(`/clientes/${clienteId}/sites`, {
    method: 'POST',
    body: {
      codigo: 'PAINEL-01',
      regiao: null,
      horario: null,
      totalGaylords: null,
      cep: null,
      endereco: 'Rua do Painel, 1 — São Paulo/SP',
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
  assert.equal(site.status, 201)
  siteId = site.body.id
  docaId = site.body.docas[0].id
})

after(async () => {
  fechar()
  await db.destroy()
  await rm(pasta, { recursive: true, force: true })
})

describe('clientes › painel da visão geral', () => {
  it('cliente sem lotes: tudo zerado, sem prazo calculado', async () => {
    const r = await api(`/clientes/${clienteId}/painel`)
    assert.equal(r.status, 200)
    assert.equal(r.body.periodo, '365')
    assert.deepEqual(r.body.agora, { aChegar: 0, emOperacao: 0, proximaColeta: null })
    assert.equal(r.body.numeros.lotes, 0)
    assert.equal(r.body.prazo.cumprimento, null)
    assert.equal(r.body.porMes.length >= 12, true)
    assert.equal((await api('/clientes/nao-existe/painel')).status, 404)
  })

  it('números, etapas, meses, prazo, materiais e ocorrências; mesma coleta conta uma vez', async () => {
    // Concluído no prazo (5 dias da chegada ao COD) e fora do prazo (15 dias).
    const noPrazo = await lote(somarDias(hoje, -20))
    await etapa(noPrazo, 'concluido', haDias(8), haDias(3))
    await pallet(noPrazo, 1, 100)
    await pallet(noPrazo, 2, 50.5)
    const atrasado = await lote(somarDias(hoje, -40))
    await etapa(atrasado, 'concluido', haDias(30), haDias(15))
    await pallet(atrasado, 1, 200)
    // Em operação há 12 dias (já fora do SLA de 10) e um em inspeção recente.
    const parado = await lote(somarDias(hoje, -14))
    await etapa(parado, 'processo', haDias(12))
    const recente = await lote(somarDias(hoje, -2))
    await etapa(recente, 'inspecao', haDias(1))
    await pallet(recente, 1, null)
    // A chegar: dois lotes da MESMA coleta (viram um) e um cancelado (fora das contas).
    const dia = somarDias(hoje, 5)
    const principal = await lote(dia)
    const juntado = await lote(dia)
    const linha = await db
      .selectFrom('ordens')
      .select('juntadoA')
      .where('id', '=', juntado)
      .executeTakeFirstOrThrow()
    assert.equal(linha.juntadoA, principal)
    const cancelado = await lote(somarDias(hoje, 9))
    await etapa(cancelado, 'cancelado', null)
    // Lote de 2 anos atrás: só no "tudo".
    const antigo = await lote(somarDias(hoje, -700))
    await etapa(antigo, 'concluido', haDias(700), haDias(695))
    await pallet(antigo, 1, 1000)

    await db
      .insertInto('ordensBalancos')
      .values({
        ordemId: noPrazo,
        sistema: 'MOONSHOT',
        recebidoEm: haDias(3),
        payload: JSON.stringify({
          balanco: {},
          commodities: [
            { codigo: 'ALU', rotulo: 'Alumínio', pesoKg: 30 },
            { codigo: 'PCB', rotulo: 'Placas', pesoKg: 45.25 },
          ],
        }),
      })
      .execute()
    await ocorrencia(parado, 'atraso')
    await ocorrencia(recente, 'atraso')
    await ocorrencia(recente, 'avaria_carga')
    await ocorrencia(recente, 'outro', 'cancelado')

    const r = await api(`/clientes/${clienteId}/painel?periodo=365`)
    assert.equal(r.status, 200)
    const p = r.body
    assert.deepEqual(p.agora, { aChegar: 1, emOperacao: 2, proximaColeta: dia })
    assert.deepEqual(p.numeros, {
      lotes: 5,
      concluidos: 2,
      kgRecebidos: 350.5,
      palletsRecebidos: 4,
    })
    assert.deepEqual(
      Object.fromEntries(p.etapas.map((e: { etapa: string; lotes: number }) => [e.etapa, e.lotes])),
      { agendado: 1, inspecao: 1, processo: 1, aguardando_cod: 0, concluido: 2 },
    )
    assert.equal(
      p.porMes.reduce((a: number, m: { kg: number }) => a + m.kg, 0),
      350.5,
    )
    assert.equal(p.porMes.at(-1).mes, hoje.slice(0, 7))
    assert.deepEqual(p.prazo, {
      slaDias: 10,
      noPrazo: 1,
      foraDoPrazo: 1,
      cumprimento: 0.5,
      tempoMedioDias: 10,
      atrasadosAgora: 1,
    })
    assert.deepEqual(p.materiais, [
      { codigo: 'PCB', rotulo: 'Placas', kg: 45.3 },
      { codigo: 'ALU', rotulo: 'Alumínio', kg: 30 },
    ])
    assert.deepEqual(p.ocorrencias, [
      { categoria: 'atraso', total: 2 },
      { categoria: 'avaria_carga', total: 1 },
    ])
    assert.equal(p.ultimos.length, 5)
    assert.equal(
      p.ultimos.some((u: { id: string }) => u.id === juntado),
      false,
    )

    // 30 dias: os lotes de coleta mais antiga saem; "agora" não muda.
    const curto = (await api(`/clientes/${clienteId}/painel?periodo=30`)).body
    assert.equal(curto.numeros.lotes, 4)
    assert.deepEqual(curto.agora, p.agora)
    // Tudo: entra o lote de 2 anos atrás.
    const tudo = (await api(`/clientes/${clienteId}/painel?periodo=tudo`)).body
    assert.equal(tudo.desde, null)
    assert.equal(tudo.numeros.lotes, 6)
    assert.equal(tudo.numeros.kgRecebidos, 1350.5)
    assert.equal(tudo.porMes.length, 24)
    // Período inválido volta para 12 meses.
    assert.equal((await api(`/clientes/${clienteId}/painel?periodo=x`)).body.periodo, '365')
  })
})
