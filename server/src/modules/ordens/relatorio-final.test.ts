import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import { unzipSync } from 'fflate'
import { criarApp } from '../../app.js'
import { criarDb, type Db } from '../../db/database.js'
import { migrarParaUltima } from '../../db/migrate.js'
import { semear } from '../../db/seed.js'

/*
 * Tipos de documento por cliente + PDF da OS + ZIP do relatório final (22/10/2026) — HTTP real,
 * SQLite em memória e pasta temporária para os arquivos.
 */

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

async function multipart(caminho: string, form: FormData) {
  const res = await fetch(`${base}${caminho}`, { method: 'POST', body: form })
  return { status: res.status, body: JSON.parse(await res.text()) }
}

async function baixar(caminho: string) {
  const res = await fetch(`${base}${caminho}`)
  return {
    status: res.status,
    tipo: res.headers.get('content-type') ?? '',
    disposicao: res.headers.get('content-disposition') ?? '',
    conteudo: new Uint8Array(await res.arrayBuffer()),
  }
}

const PADRAO = {
  rastrearColeta: false,
  rastreioExcecao: true,
  exigirMotoristaPlaca: false,
  servicosPadrao: null,
  transportadoraPadraoId: null,
  instrucoes: null,
  exigirEscopoPlanilha: false,
  exigirLacre: false,
  exigirNota: false,
  exigirTara: false,
  exigirFotosGerais: false,
  sistemaProcessamento: null,
  slaDias: null,
  diasParadoEtapa: null,
  antecedenciaDias: null,
  agendamentoBloqueado: false,
  bloqueioMotivo: null,
}

let seqDia = 0
const outroDia = () =>
  new Date(Date.UTC(2028, 0, 1) + seqDia++ * 86_400_000).toISOString().slice(0, 10)

const ordem = () => ({
  clienteId,
  siteId,
  docaId,
  transportadoraId: null,
  referenciaCliente: 'PO-77',
  coletaPrevista: outroDia(),
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
    boxes: 2,
    pallets: 4,
    gaylords: 1,
    racks: 0,
    placasPolicarbonato: null,
    requerPalletsVazios: false,
    palletsVazios: null,
    itensMais25kg: false,
    fatorLimitante: null,
  },
  escopo: 'Recolher notebooks do 3º andar.',
  observacoes: null,
})

async function criarOrdem() {
  const form = new FormData()
  form.append('dados', JSON.stringify(ordem()))
  const r = await multipart('/ordens', form)
  assert.equal(r.status, 201, JSON.stringify(r.body))
  return r.body as { id: string; codigo: string }
}

function documento(ordemId: string, tipo: string, nome: string) {
  const form = new FormData()
  form.append('tipo', tipo)
  form.append('arquivos', new Blob([`conteúdo de ${nome}`]), nome)
  return multipart(`/ordens/${ordemId}/anexos`, form)
}

function receber(ordemId: string) {
  const form = new FormData()
  form.append(
    'dados',
    JSON.stringify({
      dataRecebimento: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
        new Date(),
      ),
      inspecao: 'bom',
      inspecaoDescricao: null,
      lacres: [],
      notas: [],
      pallets: [{ pesoBruto: 120, tara: 15, conteudo: 'Notebooks' }],
    }),
  )
  form.append('pallets.0', new Blob(['foto']), 'pallet.jpg')
  return multipart(`/ordens/${ordemId}/recebimento`, form)
}

before(async () => {
  pasta = await mkdtemp(path.join(os.tmpdir(), 'ierp-relatorio-'))
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
      codigo: 'REL-01',
      regiao: 'sudeste',
      horario: '08h às 17h',
      totalGaylords: null,
      cep: null,
      endereco: 'Rua do Relatório, 100 — São Paulo/SP',
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

describe('tipos de documento', () => {
  it('lista os do sistema e cria um novo (nome único)', async () => {
    const lista = await api('/tipos-documento')
    assert.deepEqual(
      lista.body.map((t: { codigo: string }) => t.codigo),
      ['escopo', 'nota_fiscal', 'mtr', 'cdf', 'foto', 'outro'],
    )
    const nome = { origem: 'pt-BR', textos: { 'pt-BR': 'Laudo técnico' } }
    const novo = await api('/tipos-documento', { method: 'POST', body: { nome } })
    assert.equal(novo.status, 201)
    assert.match(novo.body.codigo, /^tp-/)
    const repetido = await api('/tipos-documento', {
      method: 'POST',
      body: { nome: { origem: 'pt-BR', textos: { 'pt-BR': 'LAUDO TECNICO' } } },
    })
    assert.equal(repetido.status, 409)
  })

  it('o cliente marca o que aceita; o lote recusa o resto', async () => {
    const semMarca = await api(`/clientes/${clienteId}`)
    const foto = semMarca.body.configuracoes.documentos.find(
      (t: { codigo: string }) => t.codigo === 'foto',
    )
    assert.deepEqual([foto.aceita, foto.relatorio], [true, false])

    const salvo = await api(`/clientes/${clienteId}/configuracoes`, {
      method: 'PUT',
      body: {
        ...PADRAO,
        documentos: [
          { tipo: 'foto', aceita: false, relatorio: true },
          { tipo: 'escopo', aceita: false, relatorio: false },
        ],
      },
    })
    assert.equal(salvo.status, 200, JSON.stringify(salvo.body))
    const por = Object.fromEntries(
      salvo.body.configuracoes.documentos.map(
        (t: { codigo: string; aceita: boolean; relatorio: boolean }) => [
          t.codigo,
          [t.aceita, t.relatorio],
        ],
      ),
    )
    // Não aceito não vai no relatório; o escopo é sempre aceito.
    assert.deepEqual(por.foto, [false, false])
    assert.deepEqual(por.escopo, [true, false])

    const o = await criarOrdem()
    const recusado = await documento(o.id, 'foto', 'doca.jpg')
    assert.equal(recusado.status, 422)
    assert.equal(recusado.body.code, 'document_type_not_accepted')
    assert.equal((await documento(o.id, 'mtr', 'mtr.pdf')).status, 201)
  })
})

describe('PDF da OS e relatório final', () => {
  it('PDF sai a qualquer momento; o ZIP só recebido e com os documentos marcados', async () => {
    const tipos = (await api('/tipos-documento')).body as { codigo: string }[]
    const laudo = tipos.find((t) => t.codigo.startsWith('tp-'))!.codigo
    const cfg = await api(`/clientes/${clienteId}/configuracoes`, {
      method: 'PUT',
      body: {
        ...PADRAO,
        documentos: [
          { tipo: 'cdf', aceita: true, relatorio: true },
          { tipo: laudo, aceita: true, relatorio: true },
        ],
      },
    })
    assert.equal(cfg.status, 200)
    const o = await criarOrdem()

    const pdf = await baixar(`/ordens/${o.id}/pdf`)
    assert.equal(pdf.status, 200)
    assert.equal(pdf.tipo, 'application/pdf')
    assert.match(pdf.disposicao, new RegExp(`OS-${o.codigo}\\.pdf`))
    assert.equal(Buffer.from(pdf.conteudo.subarray(0, 5)).toString(), '%PDF-')

    let s = await api(`/ordens/${o.id}/relatorio-final/situacao`)
    assert.deepEqual(s.body, { pronto: false, recebido: false, faltam: ['cdf', laudo] })
    const cedo = await api(`/ordens/${o.id}/relatorio-final`)
    assert.equal(cedo.status, 409)
    assert.equal(cedo.body.code, 'report_not_received')

    assert.equal((await receber(o.id)).status, 201)
    assert.equal((await documento(o.id, 'cdf', 'cdf.pdf')).status, 201)
    s = await api(`/ordens/${o.id}/relatorio-final/situacao`)
    assert.deepEqual(s.body, { pronto: false, recebido: true, faltam: [laudo] })
    const falta = await api(`/ordens/${o.id}/relatorio-final`)
    assert.equal(falta.body.code, 'report_missing_documents')

    assert.equal((await documento(o.id, laudo, 'laudo.pdf')).status, 201)
    assert.equal((await documento(o.id, 'cdf', 'cdf.pdf')).status, 201)
    s = await api(`/ordens/${o.id}/relatorio-final/situacao`)
    assert.equal(s.body.pronto, true)

    const zip = await baixar(`/ordens/${o.id}/relatorio-final`)
    assert.equal(zip.status, 200)
    assert.equal(zip.tipo, 'application/zip')
    const arquivos = unzipSync(zip.conteudo)
    assert.deepEqual(Object.keys(arquivos).sort(), [
      `OS-${o.codigo}.pdf`,
      `Relatorio-${o.codigo}.xlsx`,
      'documentos/CDF/2-cdf.pdf',
      'documentos/CDF/cdf.pdf',
      'documentos/Laudo técnico/laudo.pdf',
    ])
    assert.equal(Buffer.from(arquivos['documentos/CDF/cdf.pdf']!).toString(), 'conteúdo de cdf.pdf')
  })
})
