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

/*
 * Clientes › Configurações (22/10/2026) de ponta a ponta: gravar com histórico e as regras
 * conferidas no Agendamento, no Recebimento, no Dashboard e no destino dos lotes.
 */

let db: Db
let base: string
let pasta: string
let fechar: () => void
let clienteId: string
let siteId: string
let docaId: string
let motoristaId: string

async function api(caminho: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${base}${caminho}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const texto = await res.text()
  return { status: res.status, body: texto ? JSON.parse(texto) : undefined }
}

async function multipart(
  caminho: string,
  dados: Record<string, unknown>,
  arquivos: { campo: string; nome: string }[] = [],
  method = 'POST',
) {
  const form = new FormData()
  form.append('dados', JSON.stringify(dados))
  for (const a of arquivos) form.append(a.campo, new Blob([a.nome]), a.nome)
  const res = await fetch(`${base}${caminho}`, { method, body: form })
  return { status: res.status, body: JSON.parse(await res.text()) }
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

const configurar = (extra: Record<string, unknown>) =>
  api(`/clientes/${clienteId}/configuracoes`, { method: 'PUT', body: { ...PADRAO, ...extra } })

const ordem = (extra: Record<string, unknown> = {}) => ({
  clienteId,
  siteId,
  docaId,
  transportadoraId: null,
  referenciaCliente: null,
  coletaPrevista: '2026-12-01',
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
    pallets: 4,
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
  ...extra,
})

const hojeSp = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

const recebimento = (extra: Record<string, unknown> = {}) => ({
  dataRecebimento: hojeSp(),
  inspecao: 'bom',
  inspecaoDescricao: null,
  lacres: [],
  notas: [],
  pallets: [{ pesoBruto: 200, tara: null }],
  ...extra,
})

before(async () => {
  pasta = await mkdtemp(path.join(os.tmpdir(), 'ierp-config-'))
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
      codigo: 'CFG-01',
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
  assert.equal(site.status, 201)
  siteId = site.body.id
  docaId = site.body.docas[0].id
  motoristaId = (await api('/motoristas')).body.rows[0].id
})

after(async () => {
  fechar()
  await db.destroy()
  await rm(pasta, { recursive: true, force: true })
})

describe('clientes › configurações', () => {
  it('cliente existente começa como antes: rastreio escolhido em cada coleta, nada exigido', async () => {
    const c = (await api(`/clientes/${clienteId}`)).body
    assert.equal(c.configuracoes.rastrearColeta, false)
    assert.equal(c.configuracoes.rastreioExcecao, true)
    assert.equal(c.configuracoes.exigirLacre, false)
    assert.equal(c.configuracoes.sistemaProcessamento, null)
  })

  it('grava tudo e registra no histórico só o que mudou', async () => {
    const transportadora = (await api('/transportadoras')).body.rows[0]
    const r = await configurar({
      rastrearColeta: true,
      servicosPadrao: {
        psm: true,
        onsiteShredding: false,
        recycleOnly: true,
        valueRecoveryRacks: false,
        valueRecoveryItad: false,
      },
      transportadoraPadraoId: transportadora.id,
      instrucoes: { origem: 'pt-BR', textos: { 'pt-BR': 'Usar EPI completo no site.' } },
      slaDias: 20,
    })
    assert.equal(r.status, 200)
    assert.equal(r.body.configuracoes.rastrearColeta, true)
    assert.equal(r.body.configuracoes.transportadoraPadraoNome, transportadora.nome)
    assert.equal(r.body.slaDias, 20)
    const ev = r.body.historico[0]
    assert.equal(ev.acao, 'configurado')
    const campos = Object.fromEntries(
      ev.mudancas.map((m: { campo: string; depois: unknown }) => [m.campo, m.depois]),
    )
    assert.deepEqual(Object.keys(campos).sort(), [
      'instrucoes',
      'rastrearColeta',
      'servicosPadrao',
      'slaDias',
      'transportadoraPadrao',
    ])
    assert.equal(campos.servicosPadrao, 'I, III')
    assert.equal(campos.transportadoraPadrao, transportadora.nome)
    assert.equal(campos.instrucoes, 'Usar EPI completo no site.')

    // Gravar de novo igual não cria evento.
    const igual = await configurar({ ...r.body.configuracoes, transportadoraPadraoNome: undefined })
    assert.equal(igual.body.historico.length, r.body.historico.length)
  })

  it('valida: bloqueio sem motivo, sistema desconhecido, transportadora inexistente', async () => {
    assert.equal((await configurar({ agendamentoBloqueado: true })).status, 422)
    assert.equal((await configurar({ sistemaProcessamento: 'OUTRO' })).status, 422)
    assert.equal((await configurar({ transportadoraPadraoId: 'nao-existe' })).status, 422)
  })

  it('cliente novo com "Dell" no nome já nasce indo para o MoonShot', async () => {
    const r = await api('/clientes', {
      method: 'POST',
      body: {
        nome: 'Dell Computadores do Brasil',
        cnpj: '11.444.777/0001-61',
        contatos: [{ email: 'a@dell.com', telefone: '11987654321', principal: true }],
      },
    })
    assert.equal(r.status, 201)
    assert.equal(r.body.configuracoes.sistemaProcessamento, 'MOONSHOT')
  })
})

describe('clientes › configurações no agendamento', () => {
  it('bloqueado: não agenda e diz o motivo', async () => {
    await configurar({ agendamentoBloqueado: true, bloqueioMotivo: 'Pendência de contrato' })
    const r = await multipart('/ordens', ordem())
    assert.equal(r.status, 409)
    assert.equal(r.body.code, 'client_blocked')
    assert.match(r.body.message, /Pendência de contrato/)
  })

  it('sem exceção, o rastreio é o do cliente', async () => {
    await configurar({ rastrearColeta: true, rastreioExcecao: false })
    const sem = await multipart('/ordens', ordem({ rastrear: false }))
    assert.equal(sem.status, 422)
    assert.equal(sem.body.code, 'tracking_by_client')
    const com = await multipart('/ordens', ordem({ rastrear: true }))
    assert.equal(com.status, 201)
  })

  it('com exceção, quem agenda escolhe', async () => {
    await configurar({ rastrearColeta: true, rastreioExcecao: true })
    assert.equal((await multipart('/ordens', ordem({ rastrear: false }))).status, 201)
  })

  it('exige motorista e placa na coleta rastreada', async () => {
    await configurar({ exigirMotoristaPlaca: true })
    const sem = await multipart('/ordens', ordem({ rastrear: true }))
    assert.equal(sem.body.code, 'driver_plate_required')
    const com = await multipart('/ordens', ordem({ rastrear: true, motoristaId, placa: 'ABC1D23' }))
    assert.equal(com.status, 201)
    // Coleta sem rastreio não precisa.
    assert.equal((await multipart('/ordens', ordem())).status, 201)
  })

  it('exige a planilha de escopo (.xlsx)', async () => {
    await configurar({ exigirEscopoPlanilha: true })
    const sem = await multipart('/ordens', ordem(), [{ campo: 'escopo', nome: 'escopo.pdf' }])
    assert.equal(sem.body.code, 'scope_spreadsheet_required')
    const com = await multipart('/ordens', ordem(), [{ campo: 'escopo', nome: 'Escopo.XLSX' }])
    assert.equal(com.status, 201)
  })
})

describe('clientes › configurações no recebimento', () => {
  it('exige lacre, nota fiscal, tara e foto geral', async () => {
    await configurar({
      exigirLacre: true,
      exigirNota: true,
      exigirTara: true,
      exigirFotosGerais: true,
    })
    const lote = (await multipart('/ordens', ordem())).body
    const caminho = `/ordens/${lote.id}/recebimento`
    const pallet = [{ campo: 'pallets.0', nome: 'p.jpg' }]
    const tentar = (extra: Record<string, unknown>, fotos: { campo: string; nome: string }[]) =>
      multipart(caminho, recebimento(extra), [...pallet, ...fotos])

    assert.equal((await tentar({}, [])).body.code, 'seal_required')
    const lacres = [{ numero: 'L1' }]
    const fotoLacre = [{ campo: 'lacres.0', nome: 'l.jpg' }]
    assert.equal((await tentar({ lacres }, fotoLacre)).body.code, 'invoice_required')
    const notas = [{ numero: 'NF1' }]
    const fotoNota = [{ campo: 'notas.0', nome: 'n.jpg' }]
    assert.equal(
      (await tentar({ lacres, notas }, [...fotoLacre, ...fotoNota])).body.code,
      'tare_required',
    )
    const comTara = { lacres, notas, pallets: [{ pesoBruto: 200, tara: 15 }] }
    assert.equal((await tentar(comTara, [...fotoLacre, ...fotoNota])).body.code, 'photos_required')
    const ok = await tentar(comTara, [
      ...fotoLacre,
      ...fotoNota,
      { campo: 'gerais', nome: 'g.jpg' },
    ])
    assert.equal(ok.status, 201)
  })
})

describe('clientes › configurações no dashboard e no destino', () => {
  it('lote parado na etapa além do limite do cliente vira anomalia', async () => {
    await configurar({ diasParadoEtapa: 3 })
    const lote = (await multipart('/ordens', ordem())).body
    const r = await multipart(`/ordens/${lote.id}/recebimento`, recebimento(), [
      { campo: 'pallets.0', nome: 'p.jpg' },
    ])
    assert.equal(r.status, 201)
    const cincoDias = new Date(Date.now() - 5 * 86_400_000).toISOString()
    await db
      .updateTable('ordens')
      .set({ etapaDesde: cincoDias })
      .where('id', '=', lote.id)
      .execute()
    const d = (await api('/dashboard/operacao')).body
    const linha = d.lotes.find((l: { id: string }) => l.id === lote.id)
    assert.ok(
      linha.anomalias.some(
        (a: { tipo: string; dias: number }) => a.tipo === 'parado' && a.dias >= 5,
      ),
    )
  })

  it('o destino do lote vem do cliente: ligar o MoonShot manda os lotes para lá', async () => {
    await configurar({ sistemaProcessamento: 'MOONSHOT' })
    const v = await db
      .selectFrom('ordensLista')
      .select('clienteSistema')
      .where('clienteId', '=', clienteId)
      .executeTakeFirstOrThrow()
    assert.equal(v.clienteSistema, 'MOONSHOT')
  })
})
