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

/* Busca global (Ctrl+K): todos os tipos de registro. */

let db: Db
let base: string
let pasta: string
let fechar: () => void

async function api(caminho: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${base}${caminho}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const texto = await res.text()
  return { status: res.status, body: texto ? JSON.parse(texto) : undefined }
}

const buscar = async (q: string) =>
  (await api(`/busca?q=${encodeURIComponent(q)}`)).body as {
    tipo: string
    codigo: string
    titulo: string
    detalhe?: string | null
    paiId?: string
    tituloTraduzido?: { textos: Record<string, string> }
  }[]

before(async () => {
  pasta = await mkdtemp(path.join(os.tmpdir(), 'ierp-busca-'))
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  await semear(db)
  const servidor = criarApp(db, { arquivosDir: pasta }).listen(0)
  await new Promise((ok) => servidor.once('listening', ok))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
  fechar = () => servidor.close()

  // Cliente com site, um lote, uma área, um caixote e um pallet.
  const cliente = await api('/clientes', {
    method: 'POST',
    body: {
      nome: 'Datacenter Busca Ltda',
      cnpj: '11.444.777/0001-61',
      contatos: [
        { nome: null, email: 'dc@busca.exemplo.com', telefone: '11987654321', principal: true },
      ],
    },
  })
  assert.equal(cliente.status, 201, JSON.stringify(cliente.body))
  const site = await api(`/clientes/${cliente.body.id}/sites`, {
    method: 'POST',
    body: {
      codigo: 'HRT-77',
      regiao: null,
      horario: null,
      totalGaylords: null,
      cep: null,
      endereco: 'Rua das Torres, Centro, Hortolândia – SP',
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
  assert.equal(site.status, 201, JSON.stringify(site.body))
  const form = new FormData()
  form.append(
    'dados',
    JSON.stringify({
      clienteId: cliente.body.id,
      siteId: site.body.id,
      docaId: site.body.docas[0].id,
      coletaPrevista: '2026-11-10',
      referenciaCliente: 'PO-BUSCA-9',
      rastrear: false,
      servicos: { recycleOnly: true },
      quantidades: { pallets: 2 },
      escopo: 'Coleta de teste',
    }),
  )
  const lote = await fetch(`${base}/ordens`, { method: 'POST', body: form })
  assert.equal(lote.status, 201, await lote.clone().text())

  const area = await api('/areas', { method: 'POST', body: { nome: 'GALPAO-BUSCA' } })
  const cobre = (await api('/materiais')).body.find(
    (m: { nome: { textos: Record<string, string> } }) => m.nome.textos['pt-BR'] === 'Cobre',
  )
  for (const tipo of ['caixote', 'pallet'])
    assert.equal(
      (
        await api('/recipientes', {
          method: 'POST',
          body: { tipo, materialId: cobre.id, taraKg: 10, areaId: area.body.id, posicao: 'Z-99' },
        })
      ).status,
      201,
    )
})

after(async () => {
  fechar()
  await db.destroy()
  await rm(pasta, { recursive: true, force: true })
})

describe('busca global', () => {
  it('lote pelo código ou pela referência do cliente', async () => {
    const porCodigo = await buscar('lot-00001')
    assert.ok(porCodigo.some((r) => r.tipo === 'lote' && r.codigo === 'LOT-00001'))
    const porReferencia = await buscar('po-busca')
    const lote = porReferencia.find((r) => r.tipo === 'lote')
    assert.equal(lote?.titulo, 'Datacenter Busca Ltda')
    assert.equal(lote?.detalhe, 'HRT-77')
  })

  it('caixote e pallet pelo código e pela posição; material nos 3 idiomas', async () => {
    const r = await buscar('z-99')
    const caixote = r.find((x) => x.tipo === 'caixote')
    assert.match(caixote!.codigo, /^CXT-/)
    assert.equal(caixote!.tituloTraduzido!.textos.en, 'Copper')
    assert.ok(r.some((x) => x.tipo === 'pallet' && /^PLT-/.test(x.codigo)))
  })

  it('site pelo código (com a cidade e o cliente), área, material, perfil e veículo', async () => {
    const site = (await buscar('hrt-77')).find((x) => x.tipo === 'site')
    assert.equal(site?.detalhe, 'Hortolândia')
    assert.ok(site?.paiId)
    assert.ok((await buscar('galpao')).some((x) => x.tipo === 'area'))
    assert.ok((await buscar('cobre')).some((x) => x.tipo === 'material'))
    assert.ok((await buscar('leitura')).some((x) => x.tipo === 'perfil'))
    assert.ok((await buscar('vei-')).some((x) => x.tipo === 'veiculo'))
  })

  it('menos de 2 letras não busca', async () => {
    assert.deepEqual(await buscar('a'), [])
  })
})
