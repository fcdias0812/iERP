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
import { sistemaDoLote } from '../integracao/destinos.js'

/*
 * A MESMA COLETA vira um lote só (22/10/2026): mesmo cliente, mesmo endereço do site, mesma data.
 * O primeiro criado é o principal; os outros ficam juntados a ele.
 */

let db: Db
let base: string
let pasta: string
let fechar: () => void
let clienteId: string
let siteA: { id: string; doca: string }
let siteB: { id: string; doca: string }
let siteLonge: { id: string; doca: string }

async function api(caminho: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${base}${caminho}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const texto = await res.text()
  return { status: res.status, body: texto ? JSON.parse(texto) : undefined }
}

const corpo = (
  site: { id: string; doca: string },
  dia: string,
  extra: Record<string, unknown> = {},
) => ({
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
    pallets: 4,
    gaylords: 1,
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
      codigo,
      regiao: null,
      horario: null,
      totalGaylords: null,
      cep: null,
      endereco,
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
  pasta = await mkdtemp(path.join(os.tmpdir(), 'ierp-coleta-'))
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  await semear(db)
  const servidor = criarApp(db, { arquivosDir: pasta }).listen(0)
  await new Promise((ok) => servidor.once('listening', ok))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
  fechar = () => servidor.close()
  clienteId = (await api('/clientes?q=technova')).body.rows[0].id
  siteA = await novoSite('COL-A', 'Rua das Flores, 100 - São Paulo')
  // Outro site no MESMO endereço (escrito diferente): a mesma coleta, como no 1.0.
  siteB = await novoSite('COL-B', 'rua das flores,  100 - Sao Paulo')
  siteLonge = await novoSite('COL-C', 'Av. Longe, 9')
})

after(async () => {
  fechar()
  await db.destroy()
  await rm(pasta, { recursive: true, force: true })
})

describe('ordens › a mesma coleta vira um lote só', () => {
  type Lote = Awaited<ReturnType<typeof agendar>>
  let principal: Lote
  let segundo: Lote

  it('o segundo lote da mesma coleta é juntado ao primeiro (mesmo endereço, outro site)', async () => {
    principal = await agendar(corpo(siteA, '2027-03-10'))
    segundo = await agendar(
      corpo(siteB, '2027-03-10', { servicos: { ...corpo(siteA, '').servicos, psm: true } }),
      'anexo.pdf',
    )
    assert.equal(principal.juntadoA, null)
    assert.equal(segundo.juntadoA?.codigo, principal.codigo)
    // Outro endereço ou outro dia: lotes separados.
    const longe = await agendar(corpo(siteLonge, '2027-03-10'))
    const outroDia = await agendar(corpo(siteA, '2027-03-11'))
    assert.equal(longe.juntadoA, null)
    assert.equal(outroDia.juntadoA, null)
  })

  it('as listas mostram só o principal; ele traz a coleta somada e os documentos de todos', async () => {
    const lista = (await api(`/ordens?q=${encodeURIComponent('COL-')}&ps=50`)).body.rows as {
      codigo: string
    }[]
    const codigos = lista.map((l) => l.codigo)
    assert.ok(codigos.includes(principal.codigo))
    assert.ok(!codigos.includes(segundo.codigo))
    const p = (await api(`/ordens/${principal.id}`)).body
    assert.equal(p.juntados.length, 1)
    assert.equal(p.juntados[0].codigo, segundo.codigo)
    assert.equal(p.juntados[0].origem, 'IERP')
    assert.equal(p.coleta.quantidades.pallets, 8)
    assert.equal(p.coleta.totalVolumes, 10)
    assert.equal(p.coleta.servicos.psm, true)
    // As quantidades do próprio lote ficam (a edição usa).
    assert.equal(p.quantidades.pallets, 4)
    const doSegundo = p.anexos.find((a: { nome: string }) => a.nome === 'anexo.pdf')
    assert.equal(doSegundo.ordemId, segundo.id)
    assert.equal(doSegundo.loteCodigo, segundo.codigo)
    const historico = p.historico.map((h: { acao: string }) => h.acao)
    assert.ok(historico.includes('coleta_juntada'))
  })

  it('o recebimento é um só, no principal, e vale para o juntado', async () => {
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
      new Date(),
    )
    const receber = async (id: string) => {
      const form = new FormData()
      form.append(
        'dados',
        JSON.stringify({
          dataRecebimento: hoje,
          inspecao: 'bom',
          inspecaoDescricao: null,
          lacres: [],
          notas: [],
          pallets: [{ pesoBruto: 100, tara: null }],
        }),
      )
      form.append('pallets.0', new Blob(['x']), 'p.jpg')
      const res = await fetch(`${base}/ordens/${id}/recebimento`, { method: 'POST', body: form })
      return { status: res.status, body: JSON.parse(await res.text()) }
    }
    const noJuntado = await receber(segundo.id)
    assert.equal(noJuntado.status, 409)
    assert.equal(noJuntado.body.code, 'lot_merged')
    const ok = await receber(principal.id)
    assert.equal(ok.status, 201, JSON.stringify(ok.body))
    const s = (await api(`/ordens/${segundo.id}`)).body
    assert.equal(s.status, 'inspecao')
  })

  it('editar a data separa (e volta a juntar)', async () => {
    const a = await agendar(corpo(siteA, '2027-04-01'))
    const b = await agendar(corpo(siteA, '2027-04-01'))
    assert.equal(b.juntadoA?.id, a.id)
    const separado = await api(`/ordens/${b.id}`, {
      method: 'PUT',
      body: corpo(siteA, '2027-04-02'),
    })
    assert.equal(separado.status, 200, JSON.stringify(separado.body))
    assert.equal(separado.body.juntadoA, null)
    assert.ok(separado.body.historico.some((h: { acao: string }) => h.acao === 'separado'))
    const junto = await api(`/ordens/${b.id}`, { method: 'PUT', body: corpo(siteA, '2027-04-01') })
    assert.equal(junto.body.juntadoA?.id, a.id)
  })

  it('o juntado não vai sozinho para o sistema de processamento', () => {
    assert.equal(
      sistemaDoLote({ clienteSistema: 'MOONSHOT', externoSistema: null, juntadoA: 'x' }),
      null,
    )
    assert.equal(
      sistemaDoLote({ clienteSistema: 'MOONSHOT', externoSistema: null, juntadoA: null }),
      'MOONSHOT',
    )
  })
})
