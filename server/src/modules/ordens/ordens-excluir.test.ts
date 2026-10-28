import assert from 'node:assert/strict'
import { access, mkdtemp, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import { criarApp } from '../../app.js'
import { criarDb, type Db } from '../../db/database.js'
import { migrarParaUltima } from '../../db/migrate.js'
import { semear } from '../../db/seed.js'

/*
 * EXCLUIR LOTE (27/10/2026, o mesmo do iERP 1.0): só agendado, daqui e sem caminhão na rua; some
 * de vez, mas fica na Auditoria e nos históricos de módulo, e o código nunca volta. O principal
 * leva a coleta inteira; o juntado sai sozinho.
 */

let db: Db
let base: string
let pasta: string
let fechar: () => void
let clienteId: string
let motoristaId: string
let site: { id: string; doca: string }

async function api(caminho: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${base}${caminho}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const texto = await res.text()
  return { status: res.status, body: texto ? JSON.parse(texto) : undefined }
}

const excluir = (id: string) => api(`/ordens/${id}`, { method: 'DELETE' })

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

async function existe(caminho: string) {
  return access(caminho).then(
    () => true,
    () => false,
  )
}

before(async () => {
  pasta = await mkdtemp(path.join(os.tmpdir(), 'ierp-excluir-'))
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  await semear(db)
  const servidor = criarApp(db, { arquivosDir: pasta }).listen(0)
  await new Promise((ok) => servidor.once('listening', ok))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
  fechar = () => servidor.close()
  clienteId = (await api('/clientes?q=technova')).body.rows[0].id
  motoristaId = (await api('/motoristas')).body.rows[0].id
  const r = await api(`/clientes/${clienteId}/sites`, {
    method: 'POST',
    body: {
      codigo: 'EXC-A',
      regiao: null,
      horario: null,
      totalGaylords: null,
      cep: null,
      endereco: 'Rua do Teste, 1 - São Paulo',
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
  site = { id: r.body.id, doca: r.body.docas[0].id }
})

after(async () => {
  fechar()
  await db.destroy()
  await rm(pasta, { recursive: true, force: true })
})

describe('ordens › excluir lote', () => {
  it('apaga o lote agendado de vez, com os arquivos, e deixa o registro na auditoria', async () => {
    const lote = await agendar(corpo('2027-05-03'), 'escopo.pdf')
    assert.ok(await existe(path.join(pasta, 'ordens', lote.id)))

    const r = await excluir(lote.id)
    assert.equal(r.status, 200, JSON.stringify(r.body))
    assert.deepEqual(r.body.codigos, [lote.codigo])
    assert.equal((await api(`/ordens/${lote.id}`)).status, 404)
    assert.equal(await existe(path.join(pasta, 'ordens', lote.id)), false)

    const auditoria = (await api('/auditoria')).body as {
      acao: string
      registroId: string
      registroRotulo: string
      registroExcluido: boolean
    }[]
    const ev = auditoria.find((e) => e.acao === 'lote_excluido' && e.registroId === lote.id)
    assert.ok(ev)
    assert.equal(ev.registroRotulo, lote.codigo)
    assert.equal(ev.registroExcluido, true)

    // Ordens › Histórico: o agendamento e a exclusão continuam lá, com o código e o cliente.
    const modulo = (await api('/historico/ordens')).body as {
      acao: string
      registroId: string
      registroCodigo: string
      clienteNome: string
      registroExcluido: boolean
    }[]
    const doLote = modulo.filter((e) => e.registroId === lote.id).map((e) => e.acao)
    assert.deepEqual(doLote.sort(), ['criado', 'lote_excluido'])
    const ex = modulo.find((e) => e.registroId === lote.id && e.acao === 'lote_excluido')!
    assert.equal(ex.registroCodigo, lote.codigo)
    assert.equal(ex.registroExcluido, true)
    assert.ok(ex.clienteNome)
  })

  it('o código do lote excluído nunca volta', async () => {
    const ultimo = await agendar(corpo('2027-05-04'))
    assert.equal((await excluir(ultimo.id)).status, 200)
    const proximo = await agendar(corpo('2027-05-05'))
    const numero = (codigo: string) => Number(codigo.replace('LOT-', ''))
    assert.equal(numero(proximo.codigo), numero(ultimo.codigo) + 1)
  })

  it('recusa o lote já recebido', async () => {
    const lote = await agendar(corpo('2027-05-06'))
    await db.updateTable('ordens').set({ status: 'inspecao' }).where('id', '=', lote.id).execute()
    const r = await excluir(lote.id)
    assert.equal(r.status, 409)
    assert.equal(r.body.code, 'lot_not_scheduled')
    assert.equal((await api(`/ordens/${lote.id}`)).status, 200)
  })

  it('recusa o lote de outro sistema', async () => {
    const lote = await agendar(corpo('2027-05-07'))
    await db
      .updateTable('ordens')
      .set({ externoSistema: 'GERENCIAMENTO', externoId: '99' })
      .where('id', '=', lote.id)
      .execute()
    const r = await excluir(lote.id)
    assert.equal(r.status, 409)
    assert.equal(r.body.code, 'external_lot')
  })

  it('recusa com caminhão na rua; esperando o motorista, a viagem sai junto', async () => {
    const lote = await agendar(
      corpo('2027-05-08', { rastrear: true, caminhoes: [{ motoristaId, placa: 'ABC1D23' }] }),
    )
    await db
      .updateTable('ordensViagens')
      .set({ status: 'em_rota' })
      .where('ordemId', '=', lote.id)
      .execute()
    const r = await excluir(lote.id)
    assert.equal(r.status, 409)
    assert.equal(r.body.code, 'lot_trip_on_road')

    await db
      .updateTable('ordensViagens')
      .set({ status: 'aguardando_motorista' })
      .where('ordemId', '=', lote.id)
      .execute()
    assert.equal((await excluir(lote.id)).status, 200)
    const viagens = await db
      .selectFrom('ordensViagens')
      .select('id')
      .where('ordemId', '=', lote.id)
      .execute()
    assert.equal(viagens.length, 0)
  })

  it('o juntado sai sozinho; o principal fica e registra a saída', async () => {
    const principal = await agendar(corpo('2027-05-10'))
    const juntado = await agendar(corpo('2027-05-10'))
    assert.equal(juntado.juntadoA?.id, principal.id)

    assert.equal((await excluir(juntado.id)).status, 200)
    const p = (await api(`/ordens/${principal.id}`)).body
    assert.equal(p.juntados.length, 0)
    const ev = p.historico.find((h: { acao: string }) => h.acao === 'juntado_excluido')
    assert.ok(ev)
    assert.equal(ev.mudancas[0].antes, juntado.codigo)
  })

  it('o principal leva a coleta inteira', async () => {
    const principal = await agendar(corpo('2027-05-12'))
    const juntado = await agendar(corpo('2027-05-12'))
    const r = await excluir(principal.id)
    assert.equal(r.status, 200, JSON.stringify(r.body))
    assert.deepEqual(r.body.codigos, [principal.codigo, juntado.codigo])
    assert.equal((await api(`/ordens/${juntado.id}`)).status, 404)
  })

  it('o principal com um juntado recebido não apaga nada', async () => {
    const principal = await agendar(corpo('2027-05-14'))
    const juntado = await agendar(corpo('2027-05-14'))
    await db
      .updateTable('ordens')
      .set({ status: 'inspecao' })
      .where('id', '=', juntado.id)
      .execute()
    const r = await excluir(principal.id)
    assert.equal(r.status, 409)
    assert.match(r.body.message, new RegExp(juntado.codigo))
    assert.equal((await api(`/ordens/${principal.id}`)).status, 200)
  })

  it('lote que não existe: 404', async () => {
    assert.equal((await excluir('nao-existe')).status, 404)
  })
})
