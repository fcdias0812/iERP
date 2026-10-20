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
import { certificadosValidos } from './integracao.js'
import { fetchComCa } from './rede.js'
import { lerPaineis } from './sincronizacao.js'

/*
 * Re-Teck MSDC (equip-rack-2, Microsoft) → iERP 2.0, só leitura (20/10/2026): o mesmo motor do
 * Gerenciamento de Projetos, com o formato do MSDC — painel com `lotes` (e a carga ainda não
 * contada, que fica de fora), a rota nova de ordens (o corpo da fila do iERP antigo), o fim do
 * SLA no encerramento e o espelho em `{ success, data }`.
 */

const TOKEN = 'token-do-msdc'
const MSDC = 'http://msdc.teste:5013'

let db: Db
let base: string
let pasta: string
let fechar: () => void
let integracaoId: string

const msdc = {
  lotes: [] as Record<string, unknown>[],
  ordens: new Map<string, Record<string, unknown>>(),
  chamadas: [] as string[],
}

const fetchFalso = (async (url: string | URL | Request, init?: RequestInit) => {
  const endereco = String(url)
  msdc.chamadas.push(endereco)
  if (new Headers(init?.headers).get('X-Reteck-Token') !== TOKEN)
    return Response.json({ success: false }, { status: 401 })
  const caminho = endereco.replace(MSDC, '')
  if (caminho === '/api/integracao/painel?diasDePecas=1')
    return Response.json({
      success: true,
      ok: true,
      sistema: 'equip-rack-2',
      lotes: msdc.lotes,
      harvesting: { pecas: [], desmontagens: [] },
    })
  if (caminho.startsWith('/api/integracao/ordens?')) return Response.json([...msdc.ordens.values()])
  const completa = caminho.match(/^\/api\/integracao\/ordens\/([^/]+)\/completa$/)
  if (completa)
    return Response.json({
      success: true,
      data: {
        resumo: [
          { rotulo: 'Etapa', valor: 'Inventário de peças', detalhe: '6 de 8' },
          { rotulo: 'Racks', valor: 4, detalhe: '4 inventariado(s)' },
        ],
        materiais: [
          { tipo: null, descricao: 'Memória: 120 peças', embalagem: null, peso_kg: null },
        ],
        historico: [],
        seriais: 37,
      },
    })
  const uma = caminho.match(/^\/api\/integracao\/ordens\/([^/?]+)$/)
  if (uma) {
    const o = msdc.ordens.get(uma[1]!)
    return o ? Response.json(o) : Response.json({ success: false }, { status: 404 })
  }
  return Response.json({ success: false }, { status: 404 })
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

/** Um lote no painel do MSDC (formato dele). */
function lote(id: string, numero: string, grupo: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    numero,
    lote: 'LOT-20260163',
    cliente: 'Microsoft',
    origem: 'equip-rack-2',
    aguardandoLote: false,
    criadoEm: '2026-10-10T14:00:00.000Z',
    chegadaEm: null,
    grupo,
    etapa: { nome: 'Coleta agendada', desde: '2026-10-10T14:00:00.000Z', indice: 1, total: 8 },
    etapas: [
      {
        nome: 'Coleta agendada',
        grupo: 'antes',
        desde: '2026-10-10T14:00:00.000Z',
        estado: 'feita',
      },
    ],
    encerradoEm: null,
    encerradoAproximado: false,
    ultimaAtividadeEm: '2026-10-20T10:00:00.000Z',
    contagens: { racks: 0 },
    ...extra,
  }
}

/** A ordem do MSDC (rota nova): o corpo da fila do iERP antigo. */
function ordem(id: string, numero: string, extra: Record<string, unknown> = {}) {
  const o = {
    id: Number(id),
    numero,
    lote: `PO-${numero}`,
    cliente: 'Microsoft',
    cliente_id: 'microsoft',
    site: 'SP-HORTO',
    endereco: null,
    cidade: null,
    uf: null,
    pais: null,
    doca: 'D2',
    transportadora: 'Carga Certa',
    data_coleta: '2026-10-22',
    data_chegada: null,
    data_coleta_prevista: '2026-10-21',
    servico: null,
    escopo_trabalho: 'Desmontagem de racks',
    observacoes: 'Doca 2',
    agendamento: { quantidades: { pallets: 2, racks: 4 } },
    url: `https://msdc.publico:5013/lotes/${id}`,
    atualizado_em: '2026-10-20T10:00:00.000Z',
    ...extra,
  }
  msdc.ordens.set(id, o)
  return o
}

const porReferencia = (ref: string) =>
  db.selectFrom('ordensLista').selectAll().where('referenciaCliente', '=', ref).executeTakeFirst()

before(async () => {
  pasta = await mkdtemp(path.join(os.tmpdir(), 'ierp-msdc-'))
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  await semear(db)
  const servidor = criarApp(db, { arquivosDir: pasta, fetchExterno: fetchFalso }).listen(0)
  await new Promise((ok) => servidor.once('listening', ok))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
  fechar = () => servidor.close()
  const c = await api('/clientes', {
    method: 'POST',
    body: {
      nome: 'Microsoft do Brasil Ltda',
      cnpj: '88.990.011/0001-07',
      contatos: [
        { nome: null, email: 'dc@ms.exemplo.com', telefone: '11987654321', principal: true },
      ],
    },
  })
  assert.equal(c.status, 201, JSON.stringify(c.body))
})

after(async () => {
  fechar()
  await db.destroy()
  await rm(pasta, { recursive: true, force: true })
})

describe('MSDC (Microsoft) › cadastro', () => {
  it('é sistema de origem; o certificado da CA tem de ser PEM', async () => {
    const sistemas = (await api('/integracoes/sistemas')).body
    assert.ok(
      sistemas.some(
        (s: { sistema: string; tipo: string }) => s.sistema === 'MSDC' && s.tipo === 'origem',
      ),
    )
    const torto = await api('/integracoes', {
      method: 'POST',
      body: {
        sistema: 'MSDC',
        nome: 'Re-Teck MSDC (Microsoft)',
        urlPainel: `${MSDC}/api/integracao/painel`,
        tokenPainel: TOKEN,
        caPainel: 'isto não é um certificado',
      },
    })
    assert.equal(torto.status, 422)
    const criada = await api('/integracoes', {
      method: 'POST',
      body: {
        sistema: 'MSDC',
        nome: 'Re-Teck MSDC (Microsoft)',
        urlPainel: `${MSDC}/api/integracao/painel`,
        tokenPainel: TOKEN,
      },
    })
    assert.equal(criada.status, 201, JSON.stringify(criada.body))
    integracaoId = criada.body.id
  })
})

describe('MSDC (Microsoft) › sincronização', () => {
  it('cria os lotes da Microsoft (site e doca do agendamento); a carga não contada fica de fora', async () => {
    msdc.lotes = [
      lote('12', 'MS004', 'antes'),
      lote('13', 'MS005', 'processo', {
        chegadaEm: '2026-10-15',
        etapa: {
          nome: 'Inventário de peças',
          desde: '2026-10-17T13:30:00.000Z',
          indice: 6,
          total: 8,
        },
      }),
      lote('3', 'BR26003', 'encerrado', {
        origem: 'ierp',
        chegadaEm: '2026-09-15',
        encerradoEm: '2026-09-30T18:45:00.000Z',
        encerradoAproximado: true,
        etapa: {
          nome: 'Desmontagem concluída',
          desde: '2026-09-30T18:45:00.000Z',
          indice: 8,
          total: 8,
        },
      }),
      // A carga que o iERP antigo entregou e ainda não virou lote: fica de fora.
      lote('chegada:5', '', 'inspecao', { numero: null, aguardandoLote: true }),
    ]
    ordem('12', 'MS004')
    ordem('13', 'MS005', { doca: 'D3', data_chegada: '2026-10-15' })
    ordem('3', 'BR26003', { site: null, doca: null, agendamento: null, url: null })

    await lerPaineis(db, fetchFalso)

    const ms4 = (await porReferencia('MS004'))!
    assert.equal(ms4.status, 'agendado')
    assert.equal(ms4.clienteNome, 'Microsoft do Brasil Ltda')
    assert.equal(ms4.siteCodigo, 'SP-HORTO')
    assert.equal(ms4.docaNumero, 'D2')
    assert.equal(ms4.qtdPallets, 2)
    assert.equal(ms4.dataColeta, '2026-10-22T03:00:00.000Z')
    assert.equal(ms4.coletaPrevista, '2026-10-21T03:00:00.000Z')
    assert.equal(ms4.processamentoUrl, 'https://msdc.publico:5013/lotes/12')
    assert.equal(ms4.externoSistema, 'MSDC')
    assert.equal(ms4.criadoPor, 'Re-Teck MSDC (Microsoft)')

    // Mesmo site, outra doca (D3): a doca entra no site que já existe.
    const ms5 = (await porReferencia('MS005'))!
    assert.equal(ms5.status, 'processo')
    assert.equal(ms5.siteId, ms4.siteId)
    assert.equal(ms5.docaNumero, 'D3')
    assert.equal(ms5.recebidoEm, '2026-10-15T03:00:00.000Z')
    // A hora de lá vale como veio (o MSDC manda instante com Z).
    assert.equal(ms5.etapaDesde, '2026-10-17T13:30:00.000Z')

    // O que veio pela doca do iERP antigo também entra; o fim do SLA é o encerramento lá.
    const br3 = (await porReferencia('BR26003'))!
    assert.equal(br3.status, 'concluido')
    assert.equal(br3.codEmitidoEm, '2026-09-30T18:45:00.000Z')
    assert.equal(br3.processamentoUrl, `${MSDC}/lotes/3`)

    const n = await db
      .selectFrom('ordens')
      .select(db.fn.countAll<number>().as('n'))
      .where('externoSistema', '=', 'MSDC')
      .executeTakeFirstOrThrow()
    assert.equal(Number(n.n), 3)
    assert.ok(msdc.chamadas.some((c) => c.endsWith('/api/integracao/painel?diasDePecas=1')))
    const i = (await api(`/integracoes/${integracaoId}`)).body
    assert.equal(i.ultimoErro, null)
    assert.deepEqual(i.sincronizacao.pendencias, [])
  })

  it('o espelho do MSDC: resumo da desmontagem e materiais; sem pesagens nem arquivos', async () => {
    const ms5 = (await porReferencia('MS005'))!
    const e = await api(`/ordens/${ms5.id}/externo`)
    assert.equal(e.status, 200, JSON.stringify(e.body))
    assert.equal(e.body.temPesagens, false)
    assert.equal(e.body.arquivos, null)
    assert.equal(e.body.seriais, 37)
    assert.deepEqual(e.body.resumo[1], {
      rotulo: 'Racks',
      valor: '4',
      detalhe: '4 inventariado(s)',
    })
    assert.equal(e.body.materiais[0].descricao, 'Memória: 120 peças')
  })

  it('o lote do MSDC é só para ver e nunca vai para o MoonShot', async () => {
    const ms4 = (await porReferencia('MS004'))!
    const editar = await api(`/ordens/${ms4.id}`, { method: 'PUT', body: {} })
    assert.equal(editar.status, 409)
    assert.equal(editar.body.code, 'external_lot')
  })
})

describe('MSDC › HTTPS com a CA dele', () => {
  it('sem CA, ou com endereço http, é o fetch de sempre', async () => {
    let chamou = 0
    const base = (async () => {
      chamou++
      return new Response('ok')
    }) as typeof fetch
    await fetchComCa(null, base)('https://a.teste/x')
    await fetchComCa(
      '-----BEGIN CERTIFICATE-----x-----END CERTIFICATE-----',
      base,
    )('http://a.teste/x')
    assert.equal(chamou, 2)
  })
})

/** Certificado PÚBLICO descartável (auto-assinado, sem uso fora deste teste; a chave não existe mais). */
const CERTIFICADO = `-----BEGIN CERTIFICATE-----
MIIBojCCAUmgAwIBAgIUFoejSi960q+YoJpUGewWqs+Gdn4wCgYIKoZIzj0EAwIw
JzElMCMGA1UEAwwcQ2VydGlmaWNhZG8gZGUgdGVzdGUgZG8gaUVSUDAeFw0yNjEw
MjAxNDMxNDVaFw0zNjEwMTcxNDMxNDVaMCcxJTAjBgNVBAMMHENlcnRpZmljYWRv
IGRlIHRlc3RlIGRvIGlFUlAwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAQX3qBR
iypQdQuznHdBpTZt/znQjTveWc00fcmjIfp4Buw2qWCaTday3PNmgDQtk1WVQinN
0gkzQEQNLl6g6pmyo1MwUTAdBgNVHQ4EFgQU40RmYAu0WI2dtLGHWICdHYgeHRQw
HwYDVR0jBBgwFoAU40RmYAu0WI2dtLGHWICdHYgeHRQwDwYDVR0TAQH/BAUwAwEB
/zAKBggqhkjOPQQDAgNHADBEAiA9jvj31pkiNnQcOlTFDSJ0CTL932+shExPwe9C
ugFQ4wIgaB6qHPYUQDrzdrf8rOgUJFhnVtWFTdlQTZ1BGu/u92g=
-----END CERTIFICATE-----`

describe('MSDC › achados da revisão', () => {
  it('certificado da CA: só certificado de verdade; chave privada é recusada', async () => {
    assert.equal(certificadosValidos(CERTIFICADO), true)
    assert.equal(certificadosValidos(`${CERTIFICADO}\n${CERTIFICADO}`), true)
    assert.equal(
      certificadosValidos(
        `${CERTIFICADO}\n-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----`,
      ),
      false,
    )
    assert.equal(
      certificadosValidos('-----BEGIN CERTIFICATE-----\nlixo\n-----END CERTIFICATE-----'),
      false,
    )
    assert.equal(certificadosValidos(`texto solto ${CERTIFICADO}`), false)
    const comChave = await api(`/integracoes/${integracaoId}`, {
      method: 'PUT',
      body: {
        nome: 'Re-Teck MSDC (Microsoft)',
        urlPainel: `${MSDC}/api/integracao/painel`,
        caPainel: `${CERTIFICADO}\n-----BEGIN EC PRIVATE KEY-----\nAAAA\n-----END EC PRIVATE KEY-----`,
      },
    })
    assert.equal(comChave.status, 422)
    const certo = await api(`/integracoes/${integracaoId}`, {
      method: 'PUT',
      body: {
        nome: 'Re-Teck MSDC (Microsoft)',
        urlPainel: `${MSDC}/api/integracao/painel`,
        caPainel: CERTIFICADO,
      },
    })
    assert.equal(certo.status, 200, JSON.stringify(certo.body))
    // Endereço http: a CA não é usada (a leitura segue pelo fetch de sempre).
    await api(`/integracoes/${integracaoId}`, {
      method: 'PUT',
      body: {
        nome: 'Re-Teck MSDC (Microsoft)',
        urlPainel: `${MSDC}/api/integracao/painel`,
        caPainel: '',
      },
    })
  })

  it('endereço do painel com o parâmetro já escrito: não repete (lá viraria lista e daria 400)', async () => {
    await api(`/integracoes/${integracaoId}`, {
      method: 'PUT',
      body: {
        nome: 'Re-Teck MSDC (Microsoft)',
        urlPainel: `${MSDC}/api/integracao/painel?diasDePecas=8`,
      },
    })
    msdc.chamadas = []
    await lerPaineis(db, fetchFalso)
    assert.ok(msdc.chamadas.includes(`${MSDC}/api/integracao/painel?diasDePecas=1`))
    assert.equal((await api(`/integracoes/${integracaoId}`)).body.ultimoErro, null)
    await api(`/integracoes/${integracaoId}`, {
      method: 'PUT',
      body: { nome: 'Re-Teck MSDC (Microsoft)', urlPainel: `${MSDC}/api/integracao/painel` },
    })
  })

  it('doca trocada lá no mesmo site chega ao lote (a doca nova entra no site)', async () => {
    const antes = (await porReferencia('MS004'))!
    ordem('12', 'MS004', { doca: 'D9', atualizado_em: '2026-10-20T11:00:00.000Z' })
    await lerPaineis(db, fetchFalso)
    const depois = (await porReferencia('MS004'))!
    assert.equal(depois.siteId, antes.siteId)
    assert.equal(depois.docaNumero, 'D9')
  })

  it('lote EXCLUÍDO no MSDC (some do painel e a ordem dá 404) vira Cancelado; concluído fica', async () => {
    msdc.lotes = msdc.lotes.filter((l) => l.id !== '12' && l.id !== '3')
    msdc.ordens.delete('12')
    msdc.ordens.delete('3')
    await lerPaineis(db, fetchFalso)
    const ms4 = (await porReferencia('MS004'))!
    assert.equal(ms4.status, 'cancelado')
    const historico = (await api(`/ordens/${ms4.id}`)).body.historico
    assert.ok(
      historico.some((h: { nota?: string }) => h.nota === 'Excluído no Re-Teck MSDC (Microsoft).'),
    )
    // O concluído não é mexido: fica e aparece em "sumidos".
    assert.equal((await porReferencia('BR26003'))!.status, 'concluido')
    const i = (await api(`/integracoes/${integracaoId}`)).body
    assert.deepEqual(
      i.sincronizacao.sumidos.map((s: { referencia: string }) => s.referencia),
      ['BR26003'],
    )
  })
})
