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
import { fecharConta } from './balanco.js'
import { sistemaDoCliente } from './destinos.js'
import { enviarAvisos, lerPaineis } from './sincronizacao.js'

/*
 * Integração com o MoonShot (Dell) pelo contrato do iERP antigo: chave, ordem no contrato,
 * planilha do escopo, aviso ao receber, painel de andamento → "Processamento i/N", balanço e
 * devolução ao recebimento.
 */

let db: Db
let base: string
let pasta: string
let fechar: () => void
let chave: string
let integracaoId: string
let loteDell: { id: string; codigo: string }
let loteOutro: { id: string; codigo: string }

async function api(caminho: string, init?: { method?: string; body?: unknown; chave?: string }) {
  const headers: Record<string, string> = {}
  if (init?.body) headers['content-type'] = 'application/json'
  if (init?.chave) headers['X-Api-Key'] = init.chave
  const res = await fetch(`${base}${caminho}`, {
    method: init?.method ?? 'GET',
    headers,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const texto = await res.text()
  let body
  try {
    body = texto ? JSON.parse(texto) : undefined
  } catch {
    body = texto
  }
  return { status: res.status, body, headers: res.headers }
}
const contrato = (caminho: string, init: { method?: string; body?: unknown } = {}) =>
  api(`/integracao/v1${caminho}`, { ...init, chave })

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

async function clienteComSite(nome: string, cnpj: string, codigoSite: string) {
  const c = await api('/clientes', {
    method: 'POST',
    body: {
      nome,
      cnpj,
      contatos: [
        {
          nome: null,
          email: `dc@${codigoSite}.exemplo.com`,
          telefone: '11987654321',
          principal: true,
        },
      ],
    },
  })
  assert.equal(c.status, 201, JSON.stringify(c.body))
  const s = await api(`/clientes/${c.body.id}/sites`, {
    method: 'POST',
    body: {
      codigo: codigoSite,
      regiao: null,
      horario: null,
      totalGaylords: null,
      cep: null,
      endereco: 'Rua das Torres, Distrito Industrial, Hortolândia – SP',
      latitude: null,
      longitude: null,
      shredderProprio: false,
      edgeSite: false,
      docas: [doca],
    },
  })
  assert.equal(s.status, 201, JSON.stringify(s.body))
  return {
    clienteId: c.body.id as string,
    siteId: s.body.id as string,
    docaId: s.body.docas[0].id as string,
  }
}

async function criarLote(local: Awaited<ReturnType<typeof clienteComSite>>, planilha: boolean) {
  const form = new FormData()
  form.append(
    'dados',
    JSON.stringify({
      ...local,
      coletaPrevista: '2026-10-25',
      rastrear: false,
      placa: null,
      servicos: { recycleOnly: true },
      quantidades: { pallets: 2 },
      escopo: planilha ? null : 'Coleta de teste.',
    }),
  )
  if (planilha) form.append('escopo', new Blob(['PK-planilha-da-dell']), 'Lista Dell.xlsx')
  const res = await fetch(`${base}/ordens`, { method: 'POST', body: form })
  const corpo = JSON.parse(await res.text())
  assert.equal(res.status, 201, JSON.stringify(corpo))
  return { id: corpo.id as string, codigo: corpo.codigo as string }
}

const hojeSp = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

async function enviarRecebimento(ordemId: string, dados: unknown, fotos: string[], method: string) {
  const form = new FormData()
  form.append('dados', JSON.stringify(dados))
  for (const campo of fotos) form.append(campo, new Blob(['x']), `${campo}.jpg`)
  const res = await fetch(`${base}/ordens/${ordemId}/recebimento`, { method, body: form })
  const texto = await res.text()
  assert.ok(res.status === 200 || res.status === 201, texto)
}

/** Recebe o lote (2 pallets com tara). */
const receber = (ordemId: string) =>
  enviarRecebimento(
    ordemId,
    {
      dataRecebimento: hojeSp(),
      inspecao: 'bom',
      inspecaoDescricao: null,
      lacres: [{ numero: 'LAC-001' }],
      notas: [],
      pallets: [
        { pesoBruto: 250.5, tara: 20 },
        { pesoBruto: 300, tara: 25 },
      ],
    },
    ['lacres.0', 'pallets.0', 'pallets.1'],
    'POST',
  )

/** Corrige o recebimento como a tela faz (mantém as fotos), trocando o peso do 1º pallet. */
async function corrigir(ordemId: string, pesoPrimeiro: number) {
  const o = (await api(`/ordens/${ordemId}`)).body
  const ids = (fotos: { id: string }[]) => fotos.map((f) => f.id)
  await enviarRecebimento(
    ordemId,
    {
      dataRecebimento: hojeSp(),
      inspecao: 'bom',
      inspecaoDescricao: null,
      lacres: o.recebimento.lacres.map((l: { id: string; numero: string; fotos: [] }) => ({
        id: l.id,
        numero: l.numero,
        fotosManter: ids(l.fotos),
      })),
      notas: [],
      pallets: o.pallets.map(
        (p: { id: string; pesoKg: number; taraKg: number | null; fotos: [] }, i: number) => ({
          id: p.id,
          pesoBruto: i === 0 ? pesoPrimeiro : p.pesoKg,
          tara: p.taraKg,
          fotosManter: ids(p.fotos),
        }),
      ),
      fotosGeraisManter: ids(o.recebimento.fotosGerais),
    },
    [],
    'PUT',
  )
}

/** Um `fetch` falso que responde ao painel e registra os avisos recebidos. */
function sistemaFalso(painel: () => unknown) {
  const avisos: { url: string; corpo: unknown; evento: string | null }[] = []
  const fazer = (async (url: string | URL | Request, init?: RequestInit) => {
    const endereco = String(url)
    if (endereco.endsWith('/api/ierp2/painel')) {
      const h = new Headers(init?.headers)
      if (h.get('X-Reteck-Token') !== 'token-do-painel-com-mais-de-32-caracteres')
        return new Response('{}', { status: 401 })
      return Response.json(painel())
    }
    avisos.push({
      url: endereco,
      corpo: JSON.parse(String(init?.body)),
      evento: new Headers(init?.headers).get('X-Reteck-Evento'),
    })
    return Response.json({ success: true })
  }) as typeof fetch
  return { fazer, avisos }
}

const estado = async (id: string) => (await api(`/ordens/${id}`)).body

before(async () => {
  pasta = await mkdtemp(path.join(os.tmpdir(), 'ierp-integracao-'))
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  await semear(db)
  const servidor = criarApp(db, { arquivosDir: pasta }).listen(0)
  await new Promise((ok) => servidor.once('listening', ok))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
  fechar = () => servidor.close()

  const dell = await clienteComSite(
    'Dell Computadores do Brasil Ltda',
    '11.444.777/0001-61',
    'HRT-DELL',
  )
  const outro = await clienteComSite('Modello Eletrônicos Ltda', '45.997.418/0001-53', 'MOD-01')
  loteDell = await criarLote(dell, true)
  loteOutro = await criarLote(outro, false)
})

after(async () => {
  fechar()
  await db.destroy()
  await rm(pasta, { recursive: true, force: true })
})

describe('integração › destinos e chaves', () => {
  it('Dell (palavra inteira) vai para o MoonShot; o resto fica aqui', () => {
    assert.equal(sistemaDoCliente('Dell Computadores do Brasil Ltda'), 'MOONSHOT')
    assert.equal(sistemaDoCliente('DELL'), 'MOONSHOT')
    assert.equal(sistemaDoCliente('Modello Eletrônicos Ltda'), null)
  })

  it('cadastra o sistema, gera a chave (aparece uma vez) e a chave abre o contrato', async () => {
    const curto = await api('/integracoes', {
      method: 'POST',
      body: { sistema: 'MOONSHOT', nome: 'MoonShot', tokenPainel: 'curto' },
    })
    assert.equal(curto.status, 422)
    const criada = await api('/integracoes', {
      method: 'POST',
      body: {
        sistema: 'MOONSHOT',
        nome: 'MoonShot (Dell)',
        urlAvisos: 'http://moonshot.teste/api/ierp2/avisos',
        urlPainel: 'http://moonshot.teste/api/ierp2/painel',
        tokenPainel: 'token-do-painel-com-mais-de-32-caracteres',
      },
    })
    assert.equal(criada.status, 201, JSON.stringify(criada.body))
    integracaoId = criada.body.id
    assert.equal(criada.body.temTokenPainel, true)
    assert.equal(criada.body.tokenPainel, undefined)
    const repetida = await api('/integracoes', {
      method: 'POST',
      body: { sistema: 'MOONSHOT', nome: 'Outro' },
    })
    assert.equal(repetida.status, 409)

    assert.equal((await api('/integracao/v1/ping')).status, 401)
    const gerada = await api(`/integracoes/${integracaoId}/chave`, { method: 'POST' })
    chave = gerada.body.chave
    assert.match(chave, /^rtk_/)
    assert.equal(gerada.body.integracao.chavePrefixo, chave.slice(0, 8))
    const ping = await contrato('/ping')
    assert.equal(ping.status, 200)
    assert.deepEqual(
      { success: ping.body.success, sistema: ping.body.data.sistema },
      { success: true, sistema: 'MOONSHOT' },
    )
    const errada = await api('/integracao/v1/ping', { chave: 'rtk_errada_errada_errada' })
    assert.equal(errada.status, 401)
    assert.equal(errada.body.success, false)
    assert.equal(errada.body.error.code, 'invalid_key')
  })
})

describe('integração › contrato da ordem', () => {
  it('só os lotes do sistema da chave; ordem com planilha do escopo e anexo baixável', async () => {
    const lista = await contrato('/ordens')
    const codigos = lista.body.data.lotes.map((l: { codigo: string }) => l.codigo)
    assert.deepEqual(codigos, [loteDell.codigo])
    assert.equal(lista.body.data.temMais, false)
    assert.equal((await contrato(`/ordens/${loteOutro.codigo}`)).status, 404)

    const o = (await contrato(`/ordens/${loteDell.codigo}`)).body.data
    assert.equal(o.codigo, loteDell.codigo)
    assert.equal(typeof o.id, 'number')
    assert.equal(o.cliente.nome, 'Dell Computadores do Brasil Ltda')
    assert.equal(o.dataColeta, '2026-10-25')
    assert.equal(o.recebimento, null)
    const planilha = o.anexos[0]
    assert.equal(typeof planilha.id, 'number')
    assert.equal(planilha.nome, 'Lista Dell.xlsx')
    assert.equal(planilha.tipoAnexo.escopo, true)
    assert.match(planilha.url, /^\/api\/integracao\/v1\/ordens\/LOT-\d+\/anexos\/\d+$/)
    const arquivo = await fetch(`${base.replace(/\/api$/, '')}${planilha.url}`, {
      headers: { 'X-Api-Key': chave },
    })
    assert.equal(arquivo.status, 200)
    assert.equal(await arquivo.text(), 'PK-planilha-da-dell')
  })

  it('receber o lote da Dell avisa o MoonShot; os pallets vão com destino MOONSHOT', async () => {
    await receber(loteDell.id)
    await receber(loteOutro.id)
    const falso = sistemaFalso(() => ({ ok: true, lotes: [] }))
    assert.equal(await enviarAvisos(db, falso.fazer), 1)
    assert.deepEqual(falso.avisos, [
      {
        url: 'http://moonshot.teste/api/ierp2/avisos',
        corpo: { codigo: loteDell.codigo, evento: 'ordem.recebida' },
        evento: 'ordem.recebida',
      },
    ])
    // Fila vazia: não reenvia.
    assert.equal(await enviarAvisos(db, falso.fazer), 0)

    const o = (await contrato(`/ordens/${loteDell.codigo}`)).body.data
    assert.equal(o.status, 'inspecao')
    assert.equal(o.recebimento.inspecao, 'Bom')
    assert.deepEqual(o.recebimento.lacres, ['LAC-001'])
    assert.equal(o.recebimento.pallets.length, 2)
    assert.ok(o.recebimento.pallets.every((p: { destino: string }) => p.destino === 'MOONSHOT'))
    assert.equal(o.recebimento.total.pesoBrutoKg, 550.5)
    assert.equal(o.recebimento.total.pesoLiquidoKg, 505.5)
  })

  it('MoonShot fora do ar: o aviso fica na fila e é reenviado depois', async () => {
    await corrigir(loteDell.id, 251)
    const fora = (async () => new Response('fora', { status: 503 })) as typeof fetch
    assert.equal(await enviarAvisos(db, fora), 0)
    const detalhe = (await api(`/integracoes/${integracaoId}`)).body
    assert.equal(detalhe.avisosPendentes, 1)
    assert.match(detalhe.ultimoErro, /503/)
    // Vence a espera e entrega.
    await db.updateTable('integracoesAvisos').set({ proximaEm: '2000-01-01T00:00:00Z' }).execute()
    const falso = sistemaFalso(() => ({ ok: true, lotes: [] }))
    assert.equal(await enviarAvisos(db, falso.fazer), 1)
    assert.equal(falso.avisos[0]!.evento, 'ordem.editada')
    // Entregue: o erro antigo do aviso some da tela.
    assert.equal((await api(`/integracoes/${integracaoId}`)).body.ultimoErro, null)
  })

  it('planilha anexada depois do recebimento: o MoonShot é avisado e a vê no lote', async () => {
    const anexar = async (ordemId: string) => {
      const form = new FormData()
      form.append('tipo', 'escopo')
      form.append('arquivos', new Blob(['PK-lista-nova']), 'Lista nova.xlsx')
      const res = await fetch(`${base}/ordens/${ordemId}/anexos`, { method: 'POST', body: form })
      assert.equal(res.status, 201, await res.text())
    }
    await anexar(loteDell.id)
    await anexar(loteOutro.id)
    const falso = sistemaFalso(() => ({ ok: true, lotes: [] }))
    assert.equal(await enviarAvisos(db, falso.fazer), 1)
    assert.deepEqual(falso.avisos[0]!.corpo, { codigo: loteDell.codigo, evento: 'ordem.editada' })
    const o = (await contrato(`/ordens/${loteDell.codigo}`)).body.data
    assert.ok(o.anexos.some((a: { nome: string }) => a.nome === 'Lista nova.xlsx'))
  })
})

describe('integração › andamento no MoonShot', () => {
  const lotePainel = (extra: Record<string, unknown>) => ({
    ok: true,
    sistema: 'MoonShot',
    lotes: [
      // O painel traz também os lotes do iERP antigo — ficam de fora.
      {
        lote: 'LOT-20260081',
        grupo: 'processo',
        etapa: { nome: 'Leitura das peças', indice: 2, total: 4 },
      },
      { lote: loteDell.codigo, ...extra },
    ],
  })

  it('fica em Recebidos (inspeção) até a primeira ação lá; depois "Processamento i/N"', async () => {
    const parado = sistemaFalso(() =>
      lotePainel({
        grupo: 'inspecao',
        etapa: {
          nome: 'Pesagem das caixas',
          indice: 1,
          total: 4,
          desde: '2026-10-19T10:00:00.000-03:00',
        },
        ultimaAtividadeEm: null,
      }),
    )
    await lerPaineis(db, parado.fazer)
    let o = await estado(loteDell.id)
    assert.equal(o.status, 'inspecao')
    assert.equal(o.processamento.etapa, 'Pesagem das caixas')

    const pesando = sistemaFalso(() =>
      lotePainel({
        grupo: 'inspecao',
        etapa: {
          nome: 'Pesagem das caixas',
          indice: 1,
          total: 4,
          desde: '2026-10-19T10:00:00.000-03:00',
        },
        ultimaAtividadeEm: '2026-10-19T10:05:00.000-03:00',
      }),
    )
    await lerPaineis(db, pesando.fazer)
    o = await estado(loteDell.id)
    assert.equal(o.status, 'processo')
    assert.deepEqual(
      {
        etapa: o.processamento.etapa,
        indice: o.processamento.indice,
        total: o.processamento.total,
      },
      { etapa: 'Pesagem das caixas', indice: 1, total: 4 },
    )

    const lendo = sistemaFalso(() =>
      lotePainel({
        grupo: 'processo',
        etapa: {
          nome: 'Leitura das peças',
          indice: 2,
          total: 4,
          desde: '2026-10-19T11:00:00.000-03:00',
        },
        ultimaAtividadeEm: '2026-10-19T11:10:00.000-03:00',
      }),
    )
    await lerPaineis(db, lendo.fazer)
    o = await estado(loteDell.id)
    assert.equal(o.processamento.indice, 2)
    const eventos = o.historico.map((e: { acao: string }) => e.acao)
    assert.ok(eventos.includes('processamento'))
    const fases = o.historico
      .filter((e: { acao: string }) => e.acao === 'processamento')
      .map((e: { mudancas: { depois: string }[] }) => e.mudancas[0]!.depois)
    assert.deepEqual(fases, ['2/4 · Leitura das peças'])
    assert.equal(
      o.historico.find((e: { acao: string }) => e.acao === 'status').autor,
      'MoonShot (Dell)',
    )
  })

  it('devolução ao recebimento: o MoonShot pede, o iERP corrige e a devolução sai', async () => {
    const semMotivo = await contrato(`/ordens/${loteDell.codigo}/devolucao`, {
      method: 'POST',
      body: { motivo: ' ' },
    })
    assert.equal(semMotivo.status, 422)
    const pedida = await contrato(`/ordens/${loteDell.codigo}/devolucao`, {
      method: 'POST',
      body: { motivo: 'Pallet 2 com peso trocado.', pedidoPor: 'Operador da linha' },
    })
    assert.equal(pedida.status, 200, JSON.stringify(pedida.body))
    assert.equal(pedida.body.data.devolucao.aberta, true)
    assert.equal((await estado(loteDell.id)).devolucao.motivo, 'Pallet 2 com peso trocado.')

    // Em processamento, a correção só vale porque há devolução pedida.
    await corrigir(loteDell.id, 260)
    const o = (await contrato(`/ordens/${loteDell.codigo}`)).body.data
    assert.equal(o.devolucao, null)
    assert.equal(o.recebimento.pallets[0].pesoBrutoKg, 260)
    const falso = sistemaFalso(() => ({ ok: true, lotes: [] }))
    await enviarAvisos(db, falso.fazer)
    assert.equal(falso.avisos.at(-1)?.evento, 'ordem.editada')
  })

  it('balanço guardado; lote encerrado lá fica Concluído aqui (fim do SLA)', async () => {
    const r = await contrato(`/ordens/${loteDell.codigo}/balanco`, {
      method: 'POST',
      body: {
        versao: 'v1',
        externo: {
          id: '7',
          nome: loteDell.codigo,
          url: 'http://moonshot.teste/Batch?batchId=7',
          fechadoEm: '2026-10-20T15:00:00.000-03:00',
        },
        fase: { nome: 'Lote encerrado', indice: 4, total: 4, momento: 'fim' },
        balanco: {
          brutoRecebidoKg: 550.5,
          embalagemKg: 45,
          lidoKg: 480.2,
          scrapTriadoKg: 20,
          toleranciaPercent: 2,
          pecasLidas: 30,
          pecasSemPeso: 1,
        },
        commodities: [{ codigo: 'PCB', rotulo: 'Placas', pesoKg: 300.2 }],
        containers: [
          { codigo: 'BB-001', categoria: 'PCB', situacao: 'fechado', desteLoteKg: 300.2 },
        ],
      },
    })
    assert.equal(r.status, 200, JSON.stringify(r.body))
    const o = await estado(loteDell.id)
    assert.equal(o.status, 'concluido')
    assert.equal(o.codEmitidoEm, '2026-10-20T15:00:00.000-03:00')
    assert.equal(o.processamento.url, 'http://moonshot.teste/Batch?batchId=7')
    const guardado = await db.selectFrom('ordensBalancos').selectAll().executeTakeFirstOrThrow()
    assert.equal(JSON.parse(guardado.payload).balanco.lidoKg, 480.2)
    // A conta fecha aqui: 550,5 − 45 = 505,5 líquido; 480,2 + 20 = 500,2 contabilizado.
    assert.equal(o.balanco.liquidoKg, 505.5)
    assert.equal(o.balanco.contabilizadoKg, 500.2)
    assert.equal(o.balanco.diferencaKg, 5.3)
    assert.equal(o.balanco.situacao, 'fechado')
    assert.equal(o.balanco.commodities[0].rotulo, 'Placas')
    assert.equal(o.balanco.containers[0].desteLoteKg, 300.2)
    assert.equal(o.balanco.scrapRecebidoKg, null)

    // Concluído não volta atrás com um painel atrasado.
    await lerPaineis(
      db,
      sistemaFalso(() =>
        lotePainel({
          grupo: 'processo',
          etapa: { nome: 'Leitura das peças', indice: 2, total: 4 },
        }),
      ).fazer,
    )
    const depois = await estado(loteDell.id)
    assert.equal(depois.status, 'concluido')
    assert.equal(depois.processamento.etapa, 'Lote encerrado')
  })
})

describe('integração › conta do balanço de massa', () => {
  const m = {
    brutoKg: 1000,
    embalagemKg: 100,
    lidoKg: 850,
    scrapTriadoKg: 20,
    toleranciaPercent: 2,
  }
  it('sem bruto ou embalagem não há conta', () => {
    assert.equal(fecharConta({ ...m, embalagemKg: null }, true).situacao, 'aguardando')
  })
  it('fora da tolerância quando a diferença passa dela; parcial enquanto não concluído', () => {
    const fora = fecharConta(m, true)
    assert.equal(fora.diferencaKg, 30)
    assert.ok(Math.abs(fora.diferencaPercent! - 3.333) < 0.001)
    assert.equal(fora.situacao, 'fora')
    assert.equal(fecharConta(m, false).situacao, 'parcial')
    assert.equal(fecharConta({ ...m, lidoKg: 870 }, true).situacao, 'fechado')
  })
})
