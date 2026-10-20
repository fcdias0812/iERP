import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import { criarApp } from '../../app.js'
import { criarDb, type Db } from '../../db/database.js'
import { migrarParaUltima } from '../../db/migrate.js'
import { semear } from '../../db/seed.js'
import {
  base as raizDoSistema,
  criarServicoEstoque,
  ehPeca,
  maquinaDeFora,
  paleteParaMaterial,
  posicaoParaEcommerce,
} from './estoque.js'

/*
 * Estoque (20/10/2026): Materiais ← armazém, Assets/Peças ← Controle de Notebooks, E-commerce ←
 * RTB WMS — lidos ao vivo pela MESMA porta do iERP antigo (`/api/integracao/estoque`), guardados 1
 * minuto. Os três sistemas são FALSOS (em memória), com o mesmo formato dos de verdade.
 */

const ARMAZEM = 'http://armazem.teste:4000'
const NOTEBOOKS = 'http://notebooks.teste:5012'
const WMS = 'http://wms.teste:5010'

let db: Db
let base: string
let fechar: () => void

const fontes = {
  chamadas: [] as string[],
  armazemFora: false,
  /** Simula defeitos de lá: 'html' (página de login), 'mesmaPagina', 'redireciona'. */
  defeito: null as null | 'html' | 'mesmaPagina' | 'redireciona',
  /** Atraso das respostas (ms), para ver leituras simultâneas. */
  atraso: 0,
  paletes: [] as Record<string, unknown>[],
  maquinas: [] as Record<string, unknown>[],
  posicoes: [] as Record<string, unknown>[],
  /** Linhas por página (o de verdade usa o que o cliente pede, até 500). */
  porPagina: 500,
}

function pagina<T>(lista: T[], url: URL) {
  const p = Number(url.searchParams.get('pagina') ?? 1)
  const n = Math.min(Number(url.searchParams.get('porPagina') ?? 200), fontes.porPagina)
  const fatia = lista.slice((p - 1) * n, p * n)
  return { total: lista.length, fatia, proxima: p * n < lista.length ? p + 1 : null }
}

const fetchFalso = (async (entrada: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(entrada))
  fontes.chamadas.push(`${url.origin}${url.pathname}?${url.searchParams.get('pagina')}`)
  const chave = new Headers(init?.headers).get('X-Chave-Integracao')
  const falha = Response.json(
    { success: false, error: { code: 'CHAVE_INVALIDA' } },
    { status: 401 },
  )
  if (url.pathname !== '/api/integracao/estoque') return new Response('?', { status: 404 })
  if (fontes.atraso) await new Promise((ok) => setTimeout(ok, fontes.atraso))
  if (fontes.defeito === 'html') return new Response('<html>login</html>', { status: 200 })
  if (fontes.defeito === 'redireciona')
    return new Response(null, { status: 302, headers: { location: 'http://outro.host/' } })
  if (url.origin === ARMAZEM) {
    if (fontes.armazemFora) throw new TypeError('fetch failed')
    if (chave !== 'sgi_chave_do_2') return falha
    const p = pagina(fontes.paletes, url)
    return Response.json({
      success: true,
      data: {
        sistema: 'Inventory-Management',
        total: p.total,
        proximaPagina: p.proxima,
        lotes: p.fatia,
      },
    })
  }
  if (url.origin === NOTEBOOKS) {
    if (chave !== 'chave-notebooks') return falha
    const p = pagina(fontes.maquinas, url)
    return Response.json({
      success: true,
      data: { total: p.total, proximaPagina: p.proxima, maquinas: p.fatia },
    })
  }
  if (url.origin === WMS) {
    if (chave !== 'chave-wms') return falha
    const p = pagina(fontes.posicoes, url)
    const proxima = fontes.defeito === 'mesmaPagina' ? 1 : p.proxima
    return Response.json({
      success: true,
      data: { total: p.total, proximaPagina: proxima, posicoes: p.fatia },
    })
  }
  throw new TypeError('fetch failed')
}) as typeof fetch

async function api(caminho: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${base}${caminho}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const texto = await res.text()
  return { status: res.status, body: texto ? JSON.parse(texto) : undefined }
}

async function cadastrar(sistema: string, url: string, chave: string) {
  const r = await api('/integracoes', {
    method: 'POST',
    body: { sistema, nome: sistema, urlPainel: url, tokenPainel: chave },
  })
  assert.equal(r.status, 201, JSON.stringify(r.body))
  return r.body.id as string
}

const palete = (lote: string, extra: Record<string, unknown> = {}) => ({
  lote,
  palete: 'P-01',
  categoriaNegocio: 'ITAD',
  origem: 'Coleta',
  cliente: 'Dell',
  projeto: null,
  tipoMercadoria: 'Notebooks',
  categoriaProduto: 'Informática',
  quantidade: 12,
  quantidadeEstimada: false,
  pesoKg: 230.5,
  statusFisico: {
    codigo: 'FUNCIONANDO',
    rotulo: 'Funcionando',
    rotuloEn: 'Working',
    rotuloZh: '運作中',
  },
  statusVenda: { codigo: 'VENDAVEL', rotulo: 'Vendável', rotuloEn: null, rotuloZh: null },
  area: { codigo: 'A', nome: 'Área A' },
  posicao: 'A-01',
  lugar: { texto: 'Área A · A-01', area: 'Área A', posicao: 'A-01' },
  descricao: 'Notebooks',
  dataEntrada: '2026-10-10T12:00:00.000Z',
  encerrado: false,
  itens: 12,
  fotos: 2,
  ...extra,
})

const maquina = (serial: string, tipo: string, extra: Record<string, unknown> = {}) => ({
  serial,
  semSerial: false,
  tipo,
  marca: 'Dell',
  modelo: 'Latitude 5420',
  grade: 'A',
  cor: null,
  cpu: 'i5-1145G7',
  memoriaTexto: null,
  memoriaGB: 16,
  disco: null,
  discoGB: 256,
  tela: '14"',
  gpu: null,
  so: 'Windows 11',
  acessorios: null,
  especResumo: 'i5 16GB 256GB',
  status: { codigo: 2, nome: 'Pronto para venda' },
  preparo: { codigo: 2, nome: 'Pronto para e-commerce' },
  lote: 'Lote 7',
  dataEntrada: '2026-10-01',
  dataTriagem: '2026-10-02',
  noEstoque: true,
  ...extra,
})

before(async () => {
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  await semear(db)
  const estoque = criarServicoEstoque(db, { fetch: fetchFalso, atualizarDepoisMs: 0 })
  const servidor = criarApp(db, { fetchExterno: fetchFalso, estoque }).listen(0)
  await new Promise((ok) => servidor.once('listening', ok))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
  fechar = () => servidor.close()
})

after(async () => {
  fechar()
  await db.destroy()
})

describe('estoque › tradução (pura)', () => {
  it('palete → Materiais; sem lote não entra', () => {
    const m = paleteParaMaterial(palete('LOT-20261010-0001'))!
    assert.equal(m.id, 'armazem:LOT-20261010-0001')
    assert.equal(m.area, 'Área A')
    assert.equal(m.posicao, 'A-01')
    assert.equal(m.statusFisico?.rotuloEn, 'Working')
    assert.equal(paleteParaMaterial({ lote: '  ' }), null)
  })

  it('máquina → Assets; memória e disco em texto; link da lista buscada pelo serial', () => {
    const m = maquinaDeFora(maquina('ABC 123', 'Notebook'), NOTEBOOKS)!
    assert.equal(m.memoria, '16GB')
    assert.equal(m.disco, '256GB')
    assert.equal(m.link, `${NOTEBOOKS}/Computadores?Busca=ABC%20123`)
    assert.equal(maquinaDeFora({ tipo: 'Notebook' }, NOTEBOOKS), null)
  })

  it('peça: "Peça", "peca", "Peças" — e só elas', () => {
    for (const t of ['Peça', 'peca', 'PEÇAS']) assert.equal(ehPeca(t), true, t)
    for (const t of ['Notebook', 'Servidor', null]) assert.equal(ehPeca(t), false, String(t))
  })

  it('posição do RTB WMS → E-commerce; sem SKU ou posição não entra', () => {
    const p = posicaoParaEcommerce({
      sku: 'SKU1',
      posicao: '1-1',
      quantidade: '4',
      produtoAtivo: true,
    })!
    assert.equal(p.id, 'wms:SKU1@1-1')
    assert.equal(p.quantidade, 4)
    assert.equal(posicaoParaEcommerce({ sku: 'SKU1' }), null)
  })
})

describe('estoque › telas', () => {
  it('sem cadastro em Integração: a tela diz o que falta', async () => {
    const r = await api('/estoque/materiais')
    assert.equal(r.status, 200)
    assert.equal(r.body.configurado, false)
    assert.equal(r.body.motivo, 'nao_configurado')
    assert.deepEqual(r.body.linhas, [])
    assert.equal((await api('/estoque/servidores')).status, 422)
  })

  it('os três sistemas são do tipo estoque em Administração › Integração', async () => {
    const sistemas = (await api('/integracoes/sistemas')).body as {
      sistema: string
      tipo: string
    }[]
    for (const s of ['ARMAZEM', 'NOTEBOOKS', 'RTB_WMS'])
      assert.equal(sistemas.find((x) => x.sistema === s)?.tipo, 'estoque', s)
  })

  it('Materiais: todas as páginas, sem repetir a linha que pulou de página', async () => {
    await cadastrar('ARMAZEM', `${ARMAZEM}/`, 'sgi_chave_do_2')
    fontes.porPagina = 2
    fontes.paletes = [palete('L1'), palete('L2'), palete('L2'), palete('L3'), palete('L4')]
    const r = await api('/estoque/materiais')
    fontes.porPagina = 500
    assert.equal(r.body.indisponivel, false)
    assert.equal(r.body.total, 5)
    // Páginas de 2: [L1, L2] e [L2, L3] — o L2 que reaparece na página seguinte é a mesma
    // linha empurrada por uma entrada nova lá: sai. Nada some.
    assert.deepEqual(
      r.body.linhas.map((l: { lote: string }) => l.lote),
      ['L1', 'L2', 'L3', 'L4'],
    )
    assert.equal(r.body.urlSistema, `${ARMAZEM}/`)
  })

  it('guarda 1 minuto; "Atualizar" lê de novo', async () => {
    const antes = fontes.chamadas.filter((c) => c.startsWith(ARMAZEM)).length
    await api('/estoque/materiais')
    assert.equal(fontes.chamadas.filter((c) => c.startsWith(ARMAZEM)).length, antes)
    fontes.paletes = [palete('L9')]
    const r = await api('/estoque/materiais?atualizar=1')
    assert.deepEqual(
      r.body.linhas.map((l: { lote: string }) => l.lote),
      ['L9'],
    )
  })

  it('sistema fora do ar: a tela avisa (e a falha não fica guardada)', async () => {
    fontes.armazemFora = true
    const r = await api('/estoque/materiais?atualizar=1')
    assert.equal(r.body.indisponivel, true)
    assert.equal(r.body.motivo, 'sem_resposta')
    fontes.armazemFora = false
    assert.equal((await api('/estoque/materiais')).body.indisponivel, false)
  })

  it('chave trocada em Integração: a próxima leitura já usa a nova (e a recusada avisa)', async () => {
    const id = (await api('/integracoes')).body.find(
      (i: { sistema: string }) => i.sistema === 'ARMAZEM',
    ).id
    await api(`/integracoes/${id}`, {
      method: 'PUT',
      body: { nome: 'ARMAZEM', urlAvisos: null, urlPainel: ARMAZEM, tokenPainel: 'revogada' },
    })
    const r = await api('/estoque/materiais')
    assert.equal(r.body.motivo, 'chave_recusada')
  })

  it('Assets e Peças dividem UMA leitura do Controle de Notebooks (Servidor fica em Assets)', async () => {
    await cadastrar('NOTEBOOKS', NOTEBOOKS, 'chave-notebooks')
    fontes.maquinas = [
      maquina('N1', 'Notebook'),
      maquina('S1', 'Servidor'),
      maquina('P1', 'Peça', { modelo: 'Tela 14"' }),
    ]
    const antes = fontes.chamadas.filter((c) => c.startsWith(NOTEBOOKS)).length
    const assets = await api('/estoque/assets')
    const pecas = await api('/estoque/pecas')
    assert.deepEqual(
      assets.body.linhas.map((m: { serial: string }) => m.serial),
      ['N1', 'S1'],
    )
    assert.deepEqual(
      pecas.body.linhas.map((m: { serial: string }) => m.serial),
      ['P1'],
    )
    assert.equal(fontes.chamadas.filter((c) => c.startsWith(NOTEBOOKS)).length, antes + 1)
    assert.equal(assets.body.urlSistema, `${NOTEBOOKS}/Computadores`)
  })

  it('E-commerce: as posições do RTB WMS', async () => {
    await cadastrar('RTB_WMS', WMS, 'chave-wms')
    fontes.posicoes = [
      {
        sku: 'MLB1',
        descricao: 'Mouse',
        posicao: '1-1',
        zona: '*',
        quantidade: 3,
        produtoAtivo: true,
      },
      {
        sku: 'MLB2',
        descricao: null,
        posicao: 'A3',
        zona: 'A',
        quantidade: 1,
        produtoAtivo: false,
      },
    ]
    const r = await api('/estoque/ecommerce')
    assert.equal(r.body.linhas.length, 2)
    assert.equal(r.body.urlSistema, `${WMS}/admin/`)
  })

  it('mais de 8 páginas: mostra o que veio e diz que está incompleto', async () => {
    fontes.porPagina = 1
    fontes.posicoes = Array.from({ length: 10 }, (_, i) => ({ sku: `S${i}`, posicao: '1-1' }))
    const r = await api('/estoque/ecommerce?atualizar=1')
    fontes.porPagina = 500
    assert.equal(r.body.linhas.length, 8)
    assert.equal(r.body.total, 10)
    assert.equal(r.body.incompleto, true)
  })

  it('Peças com a lista incompleta: o total de lá (todas as máquinas) não é mostrado como dela', async () => {
    fontes.porPagina = 1
    fontes.maquinas = Array.from({ length: 10 }, (_, i) =>
      maquina(`M${i}`, i % 2 ? 'Peça' : 'Notebook'),
    )
    const r = await api('/estoque/pecas?atualizar=1')
    fontes.porPagina = 500
    assert.equal(r.body.incompleto, true)
    assert.equal(r.body.total, null)
  })
})

describe('estoque › defeitos de lá (revisão de 20/10/2026)', () => {
  it('página de login (HTML) no lugar do JSON: erro de formato, sem derrubar nada', async () => {
    fontes.defeito = 'html'
    const r = await api('/estoque/ecommerce?atualizar=1')
    fontes.defeito = null
    assert.equal(r.status, 200)
    assert.equal(r.body.motivo, 'erro')
    assert.equal(r.body.detalhe, 'formato')
  })

  it('redirecionamento: a chave não segue para outro endereço', async () => {
    fontes.defeito = 'redireciona'
    const antes = fontes.chamadas.length
    const r = await api('/estoque/ecommerce?atualizar=1')
    fontes.defeito = null
    assert.equal(r.body.motivo, 'erro')
    assert.equal(r.body.detalhe, '302')
    assert.ok(fontes.chamadas.slice(antes).every((c) => c.startsWith(WMS)))
  })

  it('"próxima página" que não anda: para, sem laço infinito', async () => {
    fontes.porPagina = 1
    fontes.posicoes = [
      { sku: 'A', posicao: '1-1' },
      { sku: 'B', posicao: '1-2' },
    ]
    fontes.defeito = 'mesmaPagina'
    const r = await api('/estoque/ecommerce?atualizar=1')
    fontes.defeito = null
    fontes.porPagina = 500
    assert.equal(r.body.linhas.length, 1)
  })

  it('uma leitura por vez: telas abertas juntas dividem a mesma ida lá', async () => {
    fontes.atraso = 50
    const antes = fontes.chamadas.filter((c) => c.startsWith(NOTEBOOKS)).length
    await Promise.all([
      api('/estoque/assets?atualizar=1'),
      api('/estoque/pecas?atualizar=1'),
      api('/estoque/assets'),
    ])
    fontes.atraso = 0
    assert.equal(fontes.chamadas.filter((c) => c.startsWith(NOTEBOOKS)).length, antes + 1)
  })

  it('endereço colado com o caminho da porta ou do painel vira a raiz do sistema', () => {
    assert.equal(raizDoSistema('http://h:4000/api/integracao/estoque/'), 'http://h:4000')
    assert.equal(raizDoSistema('http://h:5010/admin/'), 'http://h:5010')
    assert.equal(raizDoSistema('http://h:5012/Computadores'), 'http://h:5012')
  })
})

describe('estoque › histórico (o iERP compara as leituras)', () => {
  const eventos = async () =>
    (await api('/estoque/historico')).body as {
      acao: string
      tipo: string
      registroRotulo: string
      autor: string
      mudancas?: { campo: string; antes: unknown; depois: unknown }[]
      rotulos: Record<string, { pt: string }> | null
    }[]

  it('a primeira leitura só tira o retrato; depois registra entrou, saiu e mudou', async () => {
    // O armazém já foi lido nos testes acima: o retrato existe. Uma leitura falha não conta.
    await cadastrarDeNovo()
    fontes.paletes = [palete('H1'), palete('H2')]
    await api('/estoque/materiais?atualizar=1')
    const antes = (await eventos()).length
    fontes.paletes = [
      palete('H1', {
        statusFisico: {
          codigo: 'COM_DEFEITO',
          rotulo: 'Com defeito',
          rotuloEn: 'Defective',
          rotuloZh: '有缺陷',
        },
        quantidade: 10,
      }),
      palete('H3'),
    ]
    await api('/estoque/materiais?atualizar=1')
    const novos = (await eventos()).slice(0, (await eventos()).length - antes)
    const de = (codigo: string, acao: string) =>
      novos.find((e) => e.registroRotulo === codigo && e.acao === acao)
    assert.ok(de('H3', 'entrada'), 'H3 entrou')
    assert.ok(de('H2', 'saida'), 'H2 saiu')
    const mudou = de('H1', 'alterado')!
    assert.deepEqual(
      mudou.mudancas?.map((m) => [m.campo, m.antes, m.depois]),
      [
        ['statusFisico', 'FUNCIONANDO', 'COM_DEFEITO'],
        ['quantidade', 12, 10],
      ],
    )
    assert.equal(mudou.rotulos?.COM_DEFEITO?.pt, 'Com defeito')
    assert.equal(mudou.tipo, 'materiais')
    assert.equal(mudou.autor, 'ARMAZEM')
  })

  it('leitura incompleta ou com falha não registra saída', async () => {
    const antes = (await eventos()).length
    fontes.armazemFora = true
    await api('/estoque/materiais?atualizar=1')
    fontes.armazemFora = false
    fontes.porPagina = 1
    fontes.paletes = Array.from({ length: 10 }, (_, i) => palete(`X${i}`))
    await api('/estoque/materiais?atualizar=1')
    fontes.porPagina = 500
    assert.equal((await eventos()).length, antes)
  })

  it('Notebooks: a máquina vendida some da lista = saiu; status muda = alterado (com a tela certa)', async () => {
    fontes.maquinas = [maquina('V1', 'Notebook'), maquina('V2', 'Peça')]
    await api('/estoque/assets?atualizar=1')
    const antes = (await eventos()).length
    fontes.maquinas = [maquina('V2', 'Peça', { status: { codigo: 8, nome: 'Manutenção' } })]
    await api('/estoque/assets?atualizar=1')
    const novos = (await eventos()).slice(0, (await eventos()).length - antes)
    assert.ok(
      novos.find((e) => e.registroRotulo === 'V1' && e.acao === 'saida' && e.tipo === 'assets'),
    )
    const v2 = novos.find((e) => e.registroRotulo === 'V2' && e.acao === 'alterado')!
    assert.equal(v2.tipo, 'pecas')
    assert.deepEqual(v2.mudancas?.[0], { campo: 'statusMaquina', antes: 2, depois: 8 })
  })

  it('período: ?desde filtra os eventos', async () => {
    const r = await api(`/estoque/historico?desde=${encodeURIComponent('2999-01-01T00:00:00Z')}`)
    assert.equal(r.status, 200)
    assert.deepEqual(r.body, [])
  })
})

/** Volta a chave certa do armazém (um teste acima a trocou por uma revogada). */
async function cadastrarDeNovo() {
  const id = (await api('/integracoes')).body.find(
    (i: { sistema: string }) => i.sistema === 'ARMAZEM',
  ).id
  await api(`/integracoes/${id}`, {
    method: 'PUT',
    body: { nome: 'ARMAZEM', urlAvisos: null, urlPainel: ARMAZEM, tokenPainel: 'sgi_chave_do_2' },
  })
}
