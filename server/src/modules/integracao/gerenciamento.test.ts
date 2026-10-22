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
import { sistemaDoLote } from './destinos.js'
import type { OrdemGerenciamento, PedidoPainel } from './gerenciamento.js'
import { lerPaineis } from './sincronizacao.js'

/*
 * Gerenciamento de Projetos → iERP 2.0 (só leitura): o iERP lê o painel e as ordens de lá, cria
 * os lotes (cliente cadastrado aqui, site/doca criados se faltarem), espelha as etapas e não
 * deixa ninguém alterar o lote pela tela.
 */

const TOKEN = 'senha-do-gerenciamento'
const GP = 'http://gp.teste:5005'

let db: Db
let base: string
let pasta: string
let fechar: () => void
let integracaoId: string

/** O que o Gerenciamento falso responde (muda ao longo dos testes). */
const gp = {
  pedidos: [] as PedidoPainel[],
  ordens: new Map<string, OrdemGerenciamento>(),
  chamadas: [] as string[],
  /** Ids que `?desde=` devolve (null = todas). */
  recentes: null as Set<string> | null,
  /** Ids que NÃO vêm na lista inteira (a de lá tem limite e pode filtrar clientes). */
  foraDaLista: new Set<string>(),
  /** Ids cuja ordem, pedida uma a uma, dá erro lá. */
  quebradas: new Set<string>(),
  /** A lista "mudadas desde ontem" dá erro lá. */
  desdeQuebrado: false,
}

const fetchFalso = (async (url: string | URL | Request, init?: RequestInit) => {
  const endereco = String(url)
  gp.chamadas.push(endereco)
  if (new Headers(init?.headers).get('X-Reteck-Token') !== TOKEN)
    return Response.json({ ok: false }, { status: 401 })
  const caminho = endereco.replace(GP, '')
  if (caminho === '/api/integracao/painel')
    return Response.json({ ok: true, sistema: 'Gerenciamento-Ericsson', pedidos: gp.pedidos })
  if (caminho.startsWith('/api/integracao/ordens?desde=') && gp.desdeQuebrado)
    return Response.json({ error: 'quebrou' }, { status: 500 })
  if (caminho.startsWith('/api/integracao/ordens?desde='))
    return Response.json(
      [...gp.ordens.values()].filter((o) => !gp.recentes || gp.recentes.has(String(o.id))),
    )
  if (caminho.startsWith('/api/integracao/ordens?'))
    return Response.json([...gp.ordens.values()].filter((o) => !gp.foraDaLista.has(String(o.id))))
  const completa = caminho.match(/^\/api\/integracao\/ordens\/([^/]+)\/completa$/)
  if (completa)
    return Response.json({
      ordem: gp.ordens.get(completa[1]!),
      declarado: { peso_kg: 900, qtd_pallets: 3 },
      pesagens: [
        {
          id: 7,
          peso_kg: 412.5,
          qtd_pallets: 1,
          conteudo: '["Rádios","Antenas"]',
          pesado_por: 'Ana',
          pesado_em: '2026-10-18 10:00',
          foto_url: `${GP}/api/recebimento-lote/foto/p7.jpg`,
        },
        { id: 8, peso_kg: 300, qtd_pallets: 1, foto_url: 'javascript:alert(1)' },
      ],
      pesado: { peso_kg: 712.5, qtd_pallets: 2, pesagens: 2, fotos: 1 },
      arquivos: [
        {
          id: 3,
          tipo: 'laudo',
          nome: 'laudo.pdf',
          enviado_em: '2026-10-18 13:05:00',
          url: `${GP}/api/collections/1/laudo/foto/l.pdf`,
        },
      ],
      materiais: [{ tipo: 'Placas', descricao: 'PCB', embalagem: 'Gaylord', peso_kg: 120 }],
      notas: [{ autor: 'Bia', data: '2026-10-18', texto: 'Chegou com lacre.' }],
      seriais: 0,
    })
  const uma = caminho.match(/^\/api\/integracao\/ordens\/([^/?]+)$/)
  if (uma) {
    if (gp.quebradas.has(uma[1]!)) return Response.json({ error: 'quebrou' }, { status: 500 })
    const o = gp.ordens.get(uma[1]!)
    return o ? Response.json(o) : Response.json({ error: 'x' }, { status: 404 })
  }
  return Response.json({ error: 'não existe' }, { status: 404 })
}) as typeof fetch

async function api(caminho: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${base}${caminho}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'content-type': 'application/json' } : {},
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const texto = await res.text()
  return { status: res.status, body: texto ? JSON.parse(texto) : undefined }
}

async function cliente(nome: string, cnpj: string) {
  const c = await api('/clientes', {
    method: 'POST',
    body: {
      nome,
      cnpj,
      contatos: [
        {
          nome: null,
          email: `dc@${cnpj.slice(0, 2)}.exemplo.com`,
          telefone: '11987654321',
          principal: true,
        },
      ],
    },
  })
  assert.equal(c.status, 201, JSON.stringify(c.body))
  return c.body.id as string
}

function pedido(id: string, cliente: string, extra: Partial<PedidoPainel> = {}): PedidoPainel {
  return {
    id,
    numero: `SO-${id}`,
    lote: null,
    cliente,
    pedidoEm: '2026-10-10',
    coletaAgendadaEm: '2026-10-15',
    coletaPrevistaEm: '2026-10-14',
    chegadaEm: null,
    codNumero: null,
    codEm: null,
    encerradoEm: null,
    semCod: false,
    grupo: 'antes',
    etapa: { nome: 'Coleta agendada', desde: null, indice: 3, total: 8 },
    etapas: [{ nome: 'Solicitada', grupo: 'antes', desde: '2026-10-10', estado: 'feita' }],
    previstoPallets: 3,
    previstoPesoKg: 900,
    previstoUnidades: null,
    ...extra,
  }
}

function ordem(id: string, cliente: string, extra: Partial<OrdemGerenciamento> = {}) {
  const o: OrdemGerenciamento = {
    id: Number(id),
    numero: `SO-${id}`,
    lote: null,
    cliente,
    cliente_id: cliente.toLowerCase(),
    site: 'GRU60',
    endereco: 'Av. Exemplo, 1000',
    cidade: 'Jundiaí',
    uf: 'SP',
    pais: null,
    transportadora: 'Transportadora Alfa',
    data_coleta: '2026-10-15',
    data_chegada: null,
    escopo_trabalho: 'Recycle Only',
    observacoes: 'Doca 3',
    ...extra,
  }
  gp.ordens.set(id, o)
  return o
}

const lotePorReferencia = async (ref: string) =>
  db.selectFrom('ordensLista').selectAll().where('referenciaCliente', '=', ref).executeTakeFirst()

before(async () => {
  pasta = await mkdtemp(path.join(os.tmpdir(), 'ierp-gerenciamento-'))
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  await semear(db)
  const servidor = criarApp(db, { arquivosDir: pasta, fetchExterno: fetchFalso }).listen(0)
  await new Promise((ok) => servidor.once('listening', ok))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
  fechar = () => servidor.close()

  await cliente('Ericsson Telecomunicações S.A.', '11.444.777/0001-61')
  await cliente('AWS Serviços Brasil Ltda', '45.997.418/0001-53')
  // Nokia de propósito NÃO cadastrada: a coleta dela espera.
})

after(async () => {
  fechar()
  await db.destroy()
  await rm(pasta, { recursive: true, force: true })
})

describe('gerenciamento › cadastro', () => {
  it('cadastra o Gerenciamento com o token que ele tiver (o do MoonShot exige 32)', async () => {
    const sistemas = await api('/integracoes/sistemas')
    assert.ok(
      sistemas.body.some(
        (s: { sistema: string; tipo: string }) =>
          s.sistema === 'GERENCIAMENTO' && s.tipo === 'origem',
      ),
    )
    const curto = await api('/integracoes', {
      method: 'POST',
      body: { sistema: 'MOONSHOT', nome: 'MoonShot', tokenPainel: 'curto' },
    })
    assert.equal(curto.status, 422)
    const criada = await api('/integracoes', {
      method: 'POST',
      body: {
        sistema: 'GERENCIAMENTO',
        nome: 'Gerenciamento de Projetos',
        urlPainel: `${GP}/api/integracao/painel`,
        tokenPainel: TOKEN,
      },
    })
    assert.equal(criada.status, 201, JSON.stringify(criada.body))
    assert.equal(criada.body.tipo, 'origem')
    integracaoId = criada.body.id
  })
})

describe('gerenciamento › sincronização', () => {
  it('cria os lotes das coletas (cliente daqui, site e doca criados); sem cliente, espera', async () => {
    // Ericsson já tem o site "Indaiatuba" com doca: é reaproveitado.
    const ericsson = await db
      .selectFrom('clientes')
      .select('id')
      .where('nome', 'like', 'Ericsson%')
      .executeTakeFirstOrThrow()
    const site = await api(`/clientes/${ericsson.id}/sites`, {
      method: 'POST',
      body: {
        codigo: 'Indaiatuba',
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
    assert.equal(site.status, 201, JSON.stringify(site.body))

    gp.pedidos = [
      pedido('1', 'Ericsson', {
        grupo: 'processo',
        chegadaEm: '2026-10-16',
        etapa: { nome: 'Processando', desde: '2026-10-17', indice: 6, total: 8 },
        etapas: [
          { nome: 'Solicitada', grupo: 'antes', desde: '2026-10-10', estado: 'feita' },
          { nome: 'Recebida', grupo: 'inspecao', desde: '2026-10-16', estado: 'feita' },
          { nome: 'Processando', grupo: 'processo', desde: '2026-10-17', estado: 'atual' },
        ],
      }),
      pedido('2', 'AWS'),
      pedido('3', 'Nokia'),
      pedido('4', 'AWS', { grupo: 'cancelado' }),
    ]
    ordem('1', 'Ericsson', { site: 'Indaiatuba', transportadora: null })
    ordem('2', 'AWS')
    ordem('3', 'Nokia')
    ordem('4', 'AWS')

    await lerPaineis(db, fetchFalso)

    const um = await lotePorReferencia('SO-1')
    assert.ok(um)
    assert.equal(um.status, 'processo')
    assert.equal(um.clienteNome, 'Ericsson Telecomunicações S.A.')
    assert.equal(um.siteCodigo, 'Indaiatuba')
    assert.equal(um.docaNumero, 'D1')
    assert.equal(um.externoSistema, 'GERENCIAMENTO')
    assert.equal(um.processamentoEtapa, 'Processando')
    assert.equal(um.processamentoUrl, `${GP}/coletas/1`)
    assert.equal(um.recebidoEm, '2026-10-16T03:00:00.000Z')
    assert.equal(um.criadoPor, 'Gerenciamento de Projetos')

    // AWS: site GRU60 criado no cliente, com a doca padrão (altura legal 4,40 m).
    const dois = await lotePorReferencia('SO-2')
    assert.ok(dois)
    assert.equal(dois.status, 'agendado')
    assert.equal(dois.siteCodigo, 'GRU60')
    assert.equal(dois.docaNumero, 'Principal')
    assert.equal(dois.dataColeta, '2026-10-15T03:00:00.000Z')
    assert.equal(dois.coletaPrevista, '2026-10-14T03:00:00.000Z')
    assert.equal(dois.qtdPallets, 3)
    const doca = await db
      .selectFrom('clientesDocas')
      .select('alturaMaxCaminhao')
      .where('id', '=', dois.docaId)
      .executeTakeFirstOrThrow()
    assert.equal(doca.alturaMaxCaminhao, 4.4)
    const gru = await db
      .selectFrom('clientesSites')
      .select(['regiao', 'endereco'])
      .where('id', '=', dois.siteId)
      .executeTakeFirstOrThrow()
    assert.equal(gru.regiao, 'sudeste')
    assert.equal(gru.endereco, 'Av. Exemplo, 1000 – Jundiaí/SP')

    // Nokia sem cadastro: espera. A AWS cancelada lá também vira lote (todas as coletas, como no
    // iERP antigo), já cancelado.
    assert.equal(await lotePorReferencia('SO-3'), undefined)
    assert.equal((await lotePorReferencia('SO-4'))!.status, 'cancelado')
    const i = (await api(`/integracoes/${integracaoId}`)).body
    assert.equal(i.ultimoErro, null)
    assert.deepEqual(i.sincronizacao.pendencias, [
      { cliente: 'Nokia', coletas: 1, motivo: 'sem_cliente' },
    ])
    assert.equal(i.sincronizacao.coletas, 4)
    assert.equal(i.sincronizacao.ligadas, 3)

    // Linha do tempo com as datas de lá.
    const detalhe = (await api(`/ordens/${um.id}`)).body
    assert.deepEqual(
      detalhe.etapas.map((e: { etapa: string }) => e.etapa),
      ['agendado', 'inspecao', 'processo'],
    )
    assert.equal(detalhe.externo.sistema, 'GERENCIAMENTO')
    assert.equal(detalhe.externoDados.numero, 'SO-1')
  })

  it('cadastrado o cliente que faltava, a coleta vira lote na leitura seguinte', async () => {
    await cliente('Nokia Solutions and Networks', '33.445.566/0001-86')
    await lerPaineis(db, fetchFalso)
    assert.ok(await lotePorReferencia('SO-3'))
    const i = (await api(`/integracoes/${integracaoId}`)).body
    assert.deepEqual(i.sincronizacao.pendencias, [])
  })

  it('o lote espelha a etapa de lá: COD = concluído; cancelado lá = cancelado aqui', async () => {
    const antes = await lotePorReferencia('SO-1')
    gp.pedidos[0] = pedido('1', 'Ericsson', {
      grupo: 'encerrado',
      chegadaEm: '2026-10-16',
      codNumero: 'COD-77',
      codEm: '2026-10-19',
      etapa: { nome: 'COD', desde: '2026-10-19', indice: 8, total: 8 },
    })
    gp.pedidos[1] = pedido('2', 'AWS', { grupo: 'cancelado' })
    await lerPaineis(db, fetchFalso)
    const um = await lotePorReferencia('SO-1')
    assert.equal(um!.status, 'concluido')
    assert.equal(um!.codEmitidoEm, '2026-10-19T03:00:00.000Z')
    assert.equal(um!.recebidoEm, antes!.recebidoEm)
    assert.equal((await lotePorReferencia('SO-2'))!.status, 'cancelado')
    const historico = (await api(`/ordens/${um!.id}`)).body.historico
    assert.ok(
      historico.some(
        (h: { acao: string; autor: string }) =>
          h.acao === 'status' && h.autor === 'Gerenciamento de Projetos',
      ),
    )

    // Sem mudança lá, nada muda aqui (nem o histórico).
    const n = historico.length
    await lerPaineis(db, fetchFalso)
    assert.equal((await api(`/ordens/${um!.id}`)).body.historico.length, n)
  })

  it('o lote de lá não muda pela tela: editar, receber, ocorrência e documento são recusados', async () => {
    const tres = await lotePorReferencia('SO-3')
    const editar = await api(`/ordens/${tres!.id}`, { method: 'PUT', body: {} })
    assert.equal(editar.status, 409)
    assert.equal(editar.body.code, 'external_lot')
    const form = new FormData()
    form.append('dados', JSON.stringify({}))
    const receber = await fetch(`${base}/ordens/${tres!.id}/recebimento`, {
      method: 'POST',
      body: form,
    })
    assert.equal(receber.status, 409)
    const oc = new FormData()
    oc.append('dados', JSON.stringify({}))
    const ocorrencia = await fetch(`${base}/ordens/${tres!.id}/ocorrencias`, {
      method: 'POST',
      body: oc,
    })
    assert.equal(ocorrencia.status, 409)
    const doc = new FormData()
    doc.append('tipo', 'outro')
    doc.append('arquivos', new Blob(['x']), 'a.pdf')
    const documento = await fetch(`${base}/ordens/${tres!.id}/anexos`, {
      method: 'POST',
      body: doc,
    })
    assert.equal(documento.status, 409)
  })

  it('o espelho (pesagens, fotos, documentos) vem ao vivo de lá, só com endereço http', async () => {
    const um = await lotePorReferencia('SO-1')
    const e = await api(`/ordens/${um!.id}/externo`)
    assert.equal(e.status, 200, JSON.stringify(e.body))
    assert.equal(e.body.pesado.pesoKg, 712.5)
    assert.equal(e.body.pesagens[0].fotoUrl, `${GP}/api/recebimento-lote/foto/p7.jpg`)
    assert.equal(e.body.pesagens[0].conteudo, 'Rádios, Antenas')
    assert.equal(e.body.pesagens[1].fotoUrl, null)
    assert.equal(e.body.arquivos[0].nome, 'laudo.pdf')
    assert.equal(e.body.materiais[0].pesoKg, 120)
    // As horas de lá vêm sem fuso: a da pesagem é de São Paulo; a do envio, UTC.
    assert.equal(e.body.pesagens[0].pesadoEm, '2026-10-18T13:00:00.000Z')
    assert.equal(e.body.arquivos[0].enviadoEm, '2026-10-18T13:05:00.000Z')
    assert.equal(e.body.notas[0].data, '2026-10-18T03:00:00.000Z')
    assert.equal(e.body.url, `${GP}/coletas/1`)
  })

  it('lote de lá nunca vai para o MoonShot, mesmo com o cliente configurado para ele', () => {
    assert.equal(
      sistemaDoLote({ clienteSistema: 'MOONSHOT', externoSistema: 'GERENCIAMENTO' }),
      null,
    )
    assert.equal(sistemaDoLote({ clienteSistema: 'MOONSHOT', externoSistema: null }), 'MOONSHOT')
    assert.equal(sistemaDoLote({ clienteSistema: null, externoSistema: null }), null)
  })

  it('Gerenciamento fora do ar: o erro aparece na integração e nenhum lote muda', async () => {
    const fora = (async () => new Response('fora', { status: 503 })) as typeof fetch
    await lerPaineis(db, fora)
    const i = (await api(`/integracoes/${integracaoId}`)).body
    assert.match(i.ultimoErro, /503/)
  })
})

describe('gerenciamento › todas as etapas e robustez', () => {
  const dia = (n: number) => `2026-10-${String(n).padStart(2, '0')}`
  const instante = (n: number) => `${dia(n)}T03:00:00.000Z`

  it('passa por TODAS as etapas: agendado → inspeção → processo → aguardando COD → concluído', async () => {
    gp.recentes = null
    const escada = (grupo: string, extra: Partial<PedidoPainel> = {}) =>
      pedido('10', 'Ericsson', { grupo, ...extra })
    ordem('10', 'Ericsson', { site: 'Indaiatuba' })
    gp.pedidos.push(escada('antes'))
    const status = async () => {
      await lerPaineis(db, fetchFalso)
      return (await lotePorReferencia('SO-10'))!
    }
    assert.equal((await status()).status, 'agendado')
    assert.equal((await lotePorReferencia('SO-10'))!.recebidoEm, null)

    const passo = async (grupo: string, extra: Partial<PedidoPainel>) => {
      gp.pedidos[gp.pedidos.length - 1] = escada(grupo, extra)
      return status()
    }
    const recebido = await passo('inspecao', {
      chegadaEm: dia(16),
      etapa: { nome: 'Recebida', desde: dia(16), indice: 5, total: 8 },
    })
    assert.equal(recebido.status, 'inspecao')
    assert.equal(recebido.recebidoEm, instante(16))
    const processo = await passo('processo', {
      chegadaEm: dia(16),
      etapa: { nome: 'Processando', desde: dia(17), indice: 6, total: 8 },
    })
    assert.equal(processo.status, 'processo')
    const aguardando = await passo('aguardandoCod', {
      chegadaEm: dia(16),
      etapa: { nome: 'Aguardando COD', desde: dia(18), indice: 7, total: 8 },
    })
    assert.equal(aguardando.status, 'aguardando_cod')
    const fim = await passo('encerrado', {
      chegadaEm: dia(16),
      codNumero: 'COD-10',
      codEm: dia(19),
      // Como o painel de lá faz no COD: a fase volta a "Processando", com o dia do início dele.
      etapa: { nome: 'Processando', desde: dia(17), indice: 6, total: 8 },
    })
    assert.equal(fim.status, 'concluido')
    // O SLA: começou na chegada e terminou no COD — e não andou sozinho a cada leitura.
    assert.equal(fim.recebidoEm, instante(16))
    assert.equal(fim.codEmitidoEm, instante(19))
    const detalhe = (await api(`/ordens/${fim.id}`)).body
    assert.deepEqual(
      detalhe.etapas.map((e: { etapa: string; em: string }) => [e.etapa, e.em]),
      [
        ['agendado', instante(10)],
        ['inspecao', instante(16)],
        ['processo', instante(17)],
        ['aguardando_cod', instante(18)],
        ['concluido', instante(19)],
      ],
    )
    assert.equal(fim.etapaDesde, instante(19))
    const status_ = detalhe.historico.filter((h: { acao: string }) => h.acao === 'status')
    assert.equal(status_.length, 4)
  })

  it('coleta de cliente não cadastrado não custa nada lá; erro numa coleta não trava as outras', async () => {
    gp.recentes = new Set()
    gp.chamadas = []
    // "Google" não está cadastrado aqui: a coleta espera, sem pedir nada lá.
    ordem('20', 'Google')
    gp.pedidos.push(pedido('20', 'Google'))
    // A 21 dá erro lá; a 22 não pode ficar presa por causa dela.
    ordem('21', 'AWS')
    ordem('22', 'AWS')
    gp.quebradas.add('21')
    gp.pedidos.push(pedido('21', 'AWS'), pedido('22', 'AWS'))
    await lerPaineis(db, fetchFalso)
    assert.ok(!gp.chamadas.some((c) => c.endsWith('/ordens/20')))
    assert.ok(!gp.chamadas.some((c) => c.includes('?limite=')))
    assert.equal(await lotePorReferencia('SO-21'), undefined)
    assert.ok(await lotePorReferencia('SO-22'))
    let i = (await api(`/integracoes/${integracaoId}`)).body
    assert.equal(i.sincronizacao.falhas[0].coleta, 'SO-21')
    assert.ok(i.sincronizacao.pendencias.some((p: { cliente: string }) => p.cliente === 'Google'))

    // Voltou ao normal lá: a 21 entra na leitura seguinte.
    gp.quebradas.clear()
    await lerPaineis(db, fetchFalso)
    assert.ok(await lotePorReferencia('SO-21'))
    i = (await api(`/integracoes/${integracaoId}`)).body
    assert.deepEqual(i.sincronizacao.falhas, [])
  })

  it('1ª carga com muitas coletas: lista inteira, e as que não vêm nela, uma a uma', async () => {
    gp.recentes = new Set()
    gp.chamadas = []
    for (let n = 30; n < 55; n++) {
      ordem(String(n), 'AWS', { site: `GRU${n}` })
      gp.pedidos.push(pedido(String(n), 'AWS'))
    }
    gp.foraDaLista.add('54')
    await lerPaineis(db, fetchFalso)
    assert.ok(gp.chamadas.some((c) => c.endsWith('/api/integracao/ordens?limite=2000')))
    assert.ok(gp.chamadas.some((c) => c.endsWith('/api/integracao/ordens/54')))
    for (let n = 30; n < 55; n++) {
      const l = await lotePorReferencia(`SO-${n}`)
      assert.ok(l, `SO-${n}`)
      assert.equal(l.siteCodigo, `GRU${n}`)
    }
    // Leitura seguinte sem mudança: não cria de novo, não pede a lista inteira.
    gp.chamadas = []
    const antes = await db
      .selectFrom('ordens')
      .select(db.fn.countAll<number>().as('n'))
      .executeTakeFirstOrThrow()
    await lerPaineis(db, fetchFalso)
    const depois = await db
      .selectFrom('ordens')
      .select(db.fn.countAll<number>().as('n'))
      .executeTakeFirstOrThrow()
    assert.equal(Number(depois.n), Number(antes.n))
    assert.ok(!gp.chamadas.some((c) => c.includes('?limite=2000') && !c.includes('desde')))
  })
})

describe('gerenciamento › achados da revisão', () => {
  const dia = (n: number) => `2026-10-${String(n).padStart(2, '0')}`
  const instante = (n: number) => `${dia(n)}T03:00:00.000Z`
  const ler = () => lerPaineis(db, fetchFalso)
  const integracao = async () => (await api(`/integracoes/${integracaoId}`)).body
  const trocar = (id: string, p: PedidoPainel) => {
    const i = gp.pedidos.findIndex((x) => String(x.id) === id)
    if (i < 0) gp.pedidos.push(p)
    else gp.pedidos[i] = p
  }

  it('lista "desde ontem" com erro lá não trava: os lotes mudam de etapa do mesmo jeito', async () => {
    gp.recentes = null
    ordem('60', 'Ericsson', { site: 'Indaiatuba' })
    trocar('60', pedido('60', 'Ericsson'))
    await ler()
    assert.equal((await lotePorReferencia('SO-60'))!.status, 'agendado')
    gp.desdeQuebrado = true
    trocar(
      '60',
      pedido('60', 'Ericsson', {
        grupo: 'inspecao',
        chegadaEm: dia(16),
        etapa: { nome: 'Recebida', desde: dia(16), indice: 5, total: 8 },
      }),
    )
    await ler()
    assert.equal((await lotePorReferencia('SO-60'))!.status, 'inspecao')
    const i = await integracao()
    assert.equal(i.ultimoErro, null)
    assert.equal(i.sincronizacao.falhas[0].coleta, 'Ordens mudadas desde ontem')
    gp.desdeQuebrado = false
  })

  it('fase desconhecida lá: o lote fica como estava (sem perder o SLA) e a Integração avisa', async () => {
    trocar('60', pedido('60', 'Ericsson', { grupo: 'novidade', chegadaEm: dia(16) }))
    await ler()
    const l = (await lotePorReferencia('SO-60'))!
    assert.equal(l.status, 'inspecao')
    assert.equal(l.recebidoEm, instante(16))
    assert.match((await integracao()).sincronizacao.falhas[0].erro, /Fase desconhecida/)
  })

  it('correção lá para trás e cancelado que volta a andar são espelhados', async () => {
    const em = (grupo: string, extra: Partial<PedidoPainel> = {}) =>
      trocar('60', pedido('60', 'Ericsson', { grupo, chegadaEm: dia(16), ...extra }))
    em('processo', { etapa: { nome: 'Processando', desde: dia(17), indice: 6, total: 8 } })
    await ler()
    assert.equal((await lotePorReferencia('SO-60'))!.status, 'processo')
    em('inspecao', { etapa: { nome: 'Recebida', desde: dia(16), indice: 5, total: 8 } })
    await ler()
    assert.equal((await lotePorReferencia('SO-60'))!.status, 'inspecao')
    em('cancelado', { etapa: { nome: 'Cancelada', desde: null, indice: 1, total: 1 } })
    await ler()
    assert.equal((await lotePorReferencia('SO-60'))!.status, 'cancelado')
    em('processo', { etapa: { nome: 'Processando', desde: dia(18), indice: 6, total: 8 } })
    await ler()
    const l = (await lotePorReferencia('SO-60'))!
    assert.equal(l.status, 'processo')
    assert.equal(l.recebidoEm, instante(16))
  })

  it('escada da AWS (sem inspeção) e etapas puladas entre leituras ganham o dia de lá', async () => {
    ordem('61', 'AWS', { site: 'GRU61' })
    trocar('61', pedido('61', 'AWS'))
    await ler()
    // Entre duas leituras, lá a coleta chegou, processou e teve o COD.
    trocar(
      '61',
      pedido('61', 'AWS', {
        grupo: 'encerrado',
        chegadaEm: dia(12),
        codEm: dia(15),
        etapa: { nome: 'COD', desde: dia(15), indice: 4, total: 4 },
        etapas: [
          { nome: 'a Coletar', grupo: 'antes', desde: dia(10), estado: 'feita' },
          { nome: 'Coletado', grupo: 'antes', desde: dia(11), estado: 'feita' },
          { nome: 'Processamento', grupo: 'processo', desde: dia(12), estado: 'feita' },
          { nome: 'COD', grupo: 'encerrado', desde: dia(15), estado: 'atual' },
        ],
      }),
    )
    await ler()
    const l = (await lotePorReferencia('SO-61'))!
    assert.equal(l.status, 'concluido')
    assert.equal(l.recebidoEm, instante(12))
    assert.equal(l.codEmitidoEm, instante(15))
    const etapas = (await api(`/ordens/${l.id}`)).body.etapas.map(
      (e: { etapa: string; em: string }) => [e.etapa, e.em],
    )
    assert.deepEqual(etapas.slice(1), [
      ['processo', instante(12)],
      ['concluido', instante(15)],
    ])
  })

  it('encerrada sem COD fica fora do SLA; sem a chegada lá, o SLA não ganha data inventada', async () => {
    ordem('62', 'AWS', { site: 'GRU62' })
    trocar(
      '62',
      pedido('62', 'AWS', {
        grupo: 'encerrado',
        semCod: true,
        encerradoEm: dia(14),
        chegadaEm: null,
        etapa: { nome: 'Finalizado', desde: dia(14), indice: 4, total: 4 },
      }),
    )
    await ler()
    const l = (await lotePorReferencia('SO-62'))!
    assert.equal(l.status, 'concluido')
    assert.equal(l.codEmitidoEm, null)
    assert.equal(l.recebidoEm, null)
  })

  it('coleta restaurada da Lixeira lá (id novo, mesmo número) religa o lote, sem duplicar', async () => {
    const antes = (await lotePorReferencia('SO-62'))!
    gp.pedidos = gp.pedidos.filter((p) => String(p.id) !== '62')
    ordem('162', 'AWS', { site: 'GRU62', numero: 'SO-62' })
    gp.pedidos.push(
      pedido('162', 'AWS', { numero: 'SO-62', grupo: 'antes', semCod: false, chegadaEm: null }),
    )
    await ler()
    const lotes = await db
      .selectFrom('ordens')
      .select(['id', 'externoId'])
      .where('referenciaCliente', '=', 'SO-62')
      .execute()
    assert.deepEqual(lotes, [{ id: antes.id, externoId: '162' }])
  })

  it('coleta que some do painel: o lote fica como está e a Integração avisa', async () => {
    gp.pedidos = gp.pedidos.filter((p) => String(p.id) !== '61')
    await ler()
    assert.equal((await lotePorReferencia('SO-61'))!.status, 'concluido')
    const i = await integracao()
    assert.ok(i.sincronizacao.sumidos.some((s: { referencia: string }) => s.referencia === 'SO-61'))
  })

  it('site renomeado no cadastro daqui não vira site duplicado quando a coleta muda lá', async () => {
    const l = (await lotePorReferencia('SO-60'))!
    await db
      .updateTable('clientesSites')
      .set({ codigo: 'INDAIATUBA-SP' })
      .where('id', '=', l.siteId)
      .execute()
    const sitesAntes = await db
      .selectFrom('clientesSites')
      .select('id')
      .where('clienteId', '=', l.clienteId)
      .execute()
    ordem('60', 'Ericsson', { site: 'Indaiatuba', observacoes: 'mudou só a observação' })
    gp.recentes = null
    await ler()
    const sitesDepois = await db
      .selectFrom('clientesSites')
      .select('id')
      .where('clienteId', '=', l.clienteId)
      .execute()
    assert.equal(sitesDepois.length, sitesAntes.length)
    assert.equal((await lotePorReferencia('SO-60'))!.siteId, l.siteId)
    assert.equal((await lotePorReferencia('SO-60'))!.observacoes, 'mudou só a observação')
  })

  it('cliente só inativo aqui: o aviso diz que está inativo (não que falta cadastrar)', async () => {
    const id = await cliente('Dell LATAM Ltda', '66.778.899/0001-86')
    await api(`/clientes/${id}/transicao`, { method: 'POST', body: { acao: 'inativar' } })
    ordem('70', 'Dell LATAM')
    trocar('70', pedido('70', 'Dell LATAM'))
    await ler()
    const pend = (await integracao()).sincronizacao.pendencias.find(
      (p: { cliente: string }) => p.cliente === 'Dell LATAM',
    )
    assert.equal(pend?.motivo, 'cliente_inativo')
  })
})
