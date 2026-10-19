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

/* Ordens › Agendamento — HTTP real + SQLite em memória + pasta temporária para anexos. */

let db: Db
let base: string
let pasta: string
let fechar: () => void
let clienteId: string
let siteId: string
let docaId: string
let docaPequenaId: string

async function api(caminho: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${base}${caminho}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const texto = await res.text()
  return { status: res.status, body: texto ? JSON.parse(texto) : undefined }
}

/** Cria a ordem como a tela faz: multipart com `dados` (JSON) e arquivos. */
async function criarOrdem(
  dados: Record<string, unknown>,
  arquivos: { campo: 'escopo' | 'observacoes'; nome: string; conteudo: string }[] = [],
) {
  const form = new FormData()
  form.append('dados', JSON.stringify(dados))
  for (const a of arquivos) form.append(a.campo, new Blob([a.conteudo]), a.nome)
  const res = await fetch(`${base}/ordens`, { method: 'POST', body: form })
  return { status: res.status, body: JSON.parse(await res.text()) }
}

const doca = (numero: string, extra: Record<string, unknown> = {}) => ({
  numero,
  alturaMaxCaminhao: 4.2,
  comprimentoMaxCaminhao: null,
  dockLeveler: true,
  tailLift: false,
  areaLift: null,
  espaco: null,
  altura: null,
  voltagemShredder: null,
  pisoProtecaoObrigatorio: false,
  ...extra,
})

const SERVICOS = {
  psm: false,
  onsiteShredding: false,
  recycleOnly: true,
  valueRecoveryRacks: true,
  valueRecoveryItad: false,
}

const ordem = (extra: Record<string, unknown> = {}) => ({
  clienteId,
  siteId,
  docaId,
  transportadoraId: null,
  referenciaCliente: 'PO-123',
  dataColeta: '2026-10-25',
  coletaPrevista: null,
  dataChegada: null,
  rastrear: false,
  motoristaId: null,
  placa: null,
  servicos: SERVICOS,
  quantidades: {
    boxes: 10,
    pallets: 6,
    gaylords: 2,
    racks: 3,
    placasPolicarbonato: 8,
    requerPalletsVazios: false,
    palletsVazios: null,
    itensMais25kg: true,
    fatorLimitante: null,
  },
  escopo: 'Coleta de racks no data center.',
  observacoes: null,
  ...extra,
})

before(async () => {
  pasta = await mkdtemp(path.join(os.tmpdir(), 'ierp-ordens-'))
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  await semear(db)
  const servidor = criarApp(db, { arquivosDir: pasta }).listen(0)
  await new Promise((ok) => servidor.once('listening', ok))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
  fechar = () => servidor.close()
  const lista = await api('/clientes?q=technova')
  clienteId = lista.body.rows[0].id
  const site = await api(`/clientes/${clienteId}/sites`, {
    method: 'POST',
    body: {
      codigo: 'DC-01',
      regiao: null,
      horario: null,
      totalGaylords: null,
      cep: null,
      endereco: null,
      latitude: null,
      longitude: null,
      shredderProprio: false,
      edgeSite: false,
      docas: [doca('D1'), doca('D2', { comprimentoMaxCaminhao: 4, dockLeveler: false })],
    },
  })
  assert.equal(site.status, 201)
  siteId = site.body.id
  docaId = site.body.docas.find((d: { numero: string }) => d.numero === 'D1').id
  docaPequenaId = site.body.docas.find((d: { numero: string }) => d.numero === 'D2').id
})

after(async () => {
  fechar()
  await db.destroy()
  await rm(pasta, { recursive: true, force: true })
})

describe('ordens › pré-cálculo', () => {
  it('calcula com os veículos ativos e não grava nada', async () => {
    const r = await api('/ordens/pre-calculo', {
      method: 'POST',
      body: { docaId, servicos: SERVICOS, quantidades: ordem().quantidades },
    })
    assert.equal(r.status, 200)
    // 6 + 2 + 3 = 11 volumes (boxes não contam) → truck (5 a 12), 1 viagem.
    assert.equal(r.body.totalVolumes, 11)
    assert.equal(r.body.veiculo.tipo, 'truck')
    assert.equal(r.body.viagens, 1)
    // 2 base + 1 recycle + 2 (1 bloco de racks) = 5
    assert.equal(r.body.totalPessoas, 5)
    assert.equal(r.body.levarGaylordReteck, true)
    assert.equal((await api('/ordens')).body.total, 0)
  })

  it('doca pequena rebaixa o caminhão e pede plataforma (sem dock leveler)', async () => {
    const r = await api('/ordens/pre-calculo', {
      method: 'POST',
      body: { docaId: docaPequenaId, servicos: SERVICOS, quantidades: ordem().quantidades },
    })
    assert.equal(r.body.veiculo.tipo, 'van')
    assert.equal(r.body.viagens, 3) // ceil(11 / 4)
    assert.equal(r.body.caminhaoPlataforma, true)
    assert.ok(r.body.avisos.some((a: { codigo: string }) => a.codigo === 'rebaixado'))
  })

  it('sem doca é erro de validação', async () => {
    const r = await api('/ordens/pre-calculo', {
      method: 'POST',
      body: { docaId: '', servicos: SERVICOS, quantidades: {} },
    })
    assert.equal(r.status, 422)
  })
})

describe('ordens › agendamento', () => {
  it('cria o lote agendado com anexos e o cálculo guardado', async () => {
    const r = await criarOrdem(ordem(), [
      { campo: 'escopo', nome: 'Escopo técnico.pdf', conteudo: '%PDF-1.4 escopo' },
      { campo: 'observacoes', nome: 'fotos.zip', conteudo: 'zip' },
    ])
    assert.equal(r.status, 201, JSON.stringify(r.body))
    assert.equal(r.body.codigo, 'LOT-00001')
    assert.equal(r.body.status, 'agendado')
    assert.equal(r.body.siteCodigo, 'DC-01')
    assert.equal(r.body.totalVolumes, 11)
    // Data por dia no fuso de SP (início do dia em UTC).
    assert.equal(r.body.dataColeta, '2026-10-25T03:00:00.000Z')
    assert.equal(r.body.anexos.length, 2)
    assert.equal(r.body.anexos[0].nome, 'Escopo técnico.pdf')
    assert.equal(r.body.calculo.veiculo.tipo, 'truck')
    assert.equal(r.body.historico[0].acao, 'criado')

    const arquivo = await fetch(`${base}/ordens/${r.body.id}/anexos/${r.body.anexos[0].id}/arquivo`)
    assert.equal(arquivo.status, 200)
    assert.match(arquivo.headers.get('content-disposition') ?? '', /attachment/)
    assert.equal(await arquivo.text(), '%PDF-1.4 escopo')

    const lista = await api('/ordens?q=po-123')
    assert.equal(lista.body.total, 1)
    assert.equal(lista.body.rows[0].clienteNome.includes('TechNova'), true)
  })

  it('escopo obrigatório: texto OU arquivo', async () => {
    const sem = await criarOrdem(ordem({ escopo: null }))
    assert.equal(sem.status, 422)
    assert.equal(sem.body.code, 'scope_required')
    const soArquivo = await criarOrdem(ordem({ escopo: null }), [
      { campo: 'escopo', nome: 'escopo.txt', conteudo: 'escopo em arquivo' },
    ])
    assert.equal(soArquivo.status, 201)
  })

  it('placas de policarbonato só com Value Recovery (Racks); pallets vazios pedem quantidade', async () => {
    const semPlacas = await criarOrdem(
      ordem({ quantidades: { ...ordem().quantidades, placasPolicarbonato: null } }),
    )
    assert.equal(semPlacas.status, 422)

    const semRacks = await criarOrdem(
      ordem({
        servicos: { ...SERVICOS, valueRecoveryRacks: false },
        quantidades: { ...ordem().quantidades, placasPolicarbonato: 5 },
      }),
    )
    assert.equal(semRacks.status, 201)
    assert.equal(semRacks.body.quantidades.placasPolicarbonato, null)

    const semQtdVazios = await criarOrdem(
      ordem({
        quantidades: { ...ordem().quantidades, requerPalletsVazios: true, palletsVazios: null },
      }),
    )
    assert.equal(semQtdVazios.status, 422)
  })

  it('data de coleta é obrigatória', async () => {
    const sem = await criarOrdem(ordem({ dataColeta: null }))
    assert.equal(sem.status, 422)
    const invalida = await criarOrdem(ordem({ dataColeta: '25/10/2026' }))
    assert.equal(invalida.status, 422)
  })

  it('site de outro cliente e doca de outro site são recusados', async () => {
    const outro = await api('/clientes?q=verde')
    const r = await criarOrdem(ordem({ clienteId: outro.body.rows[0].id }))
    assert.equal(r.status, 422)
    const doca = await criarOrdem(ordem({ docaId: 'nao-existe' }))
    assert.equal(doca.status, 422)
  })

  it('motorista e placa só valem com rastreio; placa inválida é recusada', async () => {
    const motoristas = await api('/motoristas')
    const motoristaId = motoristas.body.rows[0].id
    const semRastreio = await criarOrdem(ordem({ motoristaId, placa: 'ABC1D23' }))
    assert.equal(semRastreio.body.motoristaNome, null)
    assert.equal(semRastreio.body.placa, null)

    const comRastreio = await criarOrdem(ordem({ rastrear: true, motoristaId, placa: 'abc-1d23' }))
    assert.equal(comRastreio.body.placa, 'ABC1D23')
    assert.ok(comRastreio.body.motoristaNome)

    const invalida = await criarOrdem(ordem({ rastrear: true, placa: '123' }))
    assert.equal(invalida.status, 422)
  })

  it('recusa arquivo de tipo não permitido', async () => {
    const r = await criarOrdem(ordem(), [{ campo: 'escopo', nome: 'virus.exe', conteudo: 'MZ' }])
    assert.equal(r.status, 415)
  })
})

/* ------------------------------------------------------------ detalhe do lote */

/** Envia uma ocorrência como a tela faz: multipart com `dados` (JSON) e `fotos`. */
async function enviarOcorrencia(
  caminho: string,
  dados: Record<string, unknown>,
  fotos: { nome: string; conteudo: string }[] = [],
  method = 'POST',
) {
  const form = new FormData()
  form.append('dados', JSON.stringify(dados))
  for (const f of fotos) form.append('fotos', new Blob([f.conteudo]), f.nome)
  const res = await fetch(`${base}${caminho}`, { method, body: form })
  return { status: res.status, body: JSON.parse(await res.text()) }
}

const texto = (pt: string) => ({
  origem: 'pt-BR',
  textos: { 'pt-BR': pt, en: `${pt} (en)`, 'zh-TW': `${pt} (zh)` },
  automaticos: ['en', 'zh-TW'],
})

describe('ordens › detalhe do lote', () => {
  it('lote novo começa na etapa agendado, sem pallets e sem ocorrências', async () => {
    const r = await criarOrdem(ordem())
    assert.equal(r.status, 201)
    assert.deepEqual(
      r.body.etapas.map((e: { etapa: string }) => e.etapa),
      ['agendado'],
    )
    assert.deepEqual(r.body.pallets, [])
    assert.deepEqual(r.body.ocorrencias, [])
  })

  it('registra ocorrência com fotos, corrige, cancela — tudo no histórico', async () => {
    const lote = (await criarOrdem(ordem())).body
    const nova = await enviarOcorrencia(
      `/ordens/${lote.id}/ocorrencias`,
      { momento: 'coleta', categoria: 'atraso', texto: texto('Caminhão chegou 2h atrasado.') },
      [
        { nome: 'doca.jpg', conteudo: 'jpg-1' },
        { nome: 'carga.png', conteudo: 'png-1' },
      ],
    )
    assert.equal(nova.status, 201)
    const oc = nova.body.ocorrencias[0]
    assert.equal(oc.numero, 1)
    assert.equal(oc.status, 'registrada')
    assert.equal(oc.texto.textos.en, 'Caminhão chegou 2h atrasado. (en)')
    assert.equal(oc.fotos.length, 2)
    assert.equal(nova.body.historico[0].acao, 'ocorrencia_registrada')
    assert.equal(nova.body.historico[0].nota, '#1')

    // A foto é servida como imagem (exibida na tela), sem "adivinhar" o tipo.
    const foto = await fetch(
      `${base}/ordens/${lote.id}/ocorrencias/${oc.id}/fotos/${oc.fotos[0].id}`,
    )
    assert.equal(foto.status, 200)
    assert.equal(foto.headers.get('content-type'), 'image/jpeg')
    assert.equal(foto.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(await foto.text(), 'jpg-1')

    // Corrige: muda o momento, remove uma foto e acrescenta outra.
    const corrigida = await enviarOcorrencia(
      `/ordens/${lote.id}/ocorrencias/${oc.id}`,
      {
        momento: 'trajeto',
        categoria: 'atraso',
        texto: texto('Caminhão chegou 2h atrasado.'),
        removerFotos: [oc.fotos[1].id],
      },
      [{ nome: 'estrada.webp', conteudo: 'webp-1' }],
      'PATCH',
    )
    assert.equal(corrigida.status, 200)
    const depois = corrigida.body.ocorrencias[0]
    assert.equal(depois.momento, 'trajeto')
    assert.deepEqual(
      depois.fotos.map((f: { nome: string }) => f.nome),
      ['doca.jpg', 'estrada.webp'],
    )
    const ev = corrigida.body.historico[0]
    assert.equal(ev.acao, 'ocorrencia_editada')
    assert.deepEqual(
      ev.mudancas.map((m: { campo: string }) => m.campo),
      ['momento', 'fotos'],
    )

    // Segunda ocorrência ganha o número 2.
    const outra = await enviarOcorrencia(`/ordens/${lote.id}/ocorrencias`, {
      momento: 'recebimento',
      categoria: 'avaria_carga',
      texto: texto('Pallet quebrado.'),
    })
    assert.equal(outra.body.ocorrencias[0].numero, 2)

    const cancelada = await api(`/ordens/${lote.id}/ocorrencias/${oc.id}/cancelar`, {
      method: 'POST',
    })
    assert.equal(cancelada.status, 200)
    const c = cancelada.body.ocorrencias.find((o: { id: string }) => o.id === oc.id)
    assert.equal(c.status, 'cancelado')
    assert.equal(cancelada.body.historico[0].acao, 'ocorrencia_cancelada')

    // Cancelada não muda mais.
    const denovo = await api(`/ordens/${lote.id}/ocorrencias/${oc.id}/cancelar`, {
      method: 'POST',
    })
    assert.equal(denovo.status, 409)
    const editar = await enviarOcorrencia(
      `/ordens/${lote.id}/ocorrencias/${oc.id}`,
      { momento: 'coleta', categoria: 'outro', texto: texto('x') },
      [],
      'PATCH',
    )
    assert.equal(editar.status, 409)
  })

  it('momento, categoria e texto são obrigatórios; foto só imagem', async () => {
    const lote = (await criarOrdem(ordem())).body
    const url = `/ordens/${lote.id}/ocorrencias`
    const semMomento = await enviarOcorrencia(url, { categoria: 'atraso', texto: texto('x') })
    assert.equal(semMomento.status, 422)
    const semCategoria = await enviarOcorrencia(url, { momento: 'coleta', texto: texto('x') })
    assert.equal(semCategoria.status, 422)
    const semTexto = await enviarOcorrencia(url, {
      momento: 'coleta',
      categoria: 'atraso',
      texto: { origem: 'pt-BR', textos: { 'pt-BR': '   ' } },
    })
    assert.equal(semTexto.status, 422)
    const pdf = await enviarOcorrencia(
      url,
      { momento: 'coleta', categoria: 'atraso', texto: texto('x') },
      [{ nome: 'laudo.pdf', conteudo: '%PDF' }],
    )
    assert.equal(pdf.status, 415)
    const lista = await api(`/ordens/${lote.id}`)
    assert.deepEqual(lista.body.ocorrencias, [])
  })

  it('pallets recebidos aparecem no detalhe, com a foto', async () => {
    const lote = (await criarOrdem(ordem())).body
    await db
      .insertInto('ordensPallets')
      .values([
        {
          id: 'pal-1',
          ordemId: lote.id,
          numero: 1,
          pesoKg: 412.5,
          conteudo: 'Servidores',
          pesadoPor: 'Ana',
          pesadoEm: '2026-10-19T12:00:00.000Z',
          fotoExtensao: null,
          origem: 'iERP',
          criadoEm: '2026-10-19T12:00:00.000Z',
        },
      ])
      .execute()
    const r = await api(`/ordens/${lote.id}`)
    assert.equal(r.body.pallets.length, 1)
    assert.equal(r.body.pallets[0].pesoKg, 412.5)
    assert.equal(r.body.pallets[0].temFoto, false)
    const semFoto = await fetch(`${base}/ordens/${lote.id}/pallets/pal-1/foto`)
    assert.equal(semFoto.status, 404)
  })

  it('lote inexistente: 404 ao registrar ocorrência', async () => {
    const r = await enviarOcorrencia('/ordens/nao-existe/ocorrencias', {
      momento: 'coleta',
      categoria: 'atraso',
      texto: texto('x'),
    })
    assert.equal(r.status, 404)
  })
})

describe('ordens › documentos do lote', () => {
  const enviarDocs = async (ordemId: string, tipo: string | null, nomes: string[]) => {
    const form = new FormData()
    if (tipo) form.append('tipo', tipo)
    for (const n of nomes) form.append('arquivos', new Blob([n]), n)
    const res = await fetch(`${base}/ordens/${ordemId}/anexos`, { method: 'POST', body: form })
    return { status: res.status, body: JSON.parse(await res.text()) }
  }

  it('adiciona documentos com tipo, com histórico; recusa tipo/arquivo inválido', async () => {
    const lote = (
      await criarOrdem(ordem(), [
        { campo: 'escopo', nome: 'escopo.pdf', conteudo: 'a' },
        { campo: 'observacoes', nome: 'planta.pdf', conteudo: 'b' },
      ])
    ).body
    // Os do agendamento já têm tipo: escopo → escopo; observações → outro.
    assert.deepEqual(
      lote.anexos.map((a: { nome: string; tipo: string }) => `${a.nome}:${a.tipo}`).sort(),
      ['escopo.pdf:escopo', 'planta.pdf:outro'],
    )
    const r = await enviarDocs(lote.id, 'nota_fiscal', ['NF 123.pdf', 'NF 124.pdf'])
    assert.equal(r.status, 201)
    const novos = r.body.anexos.filter((a: { secao: string }) => a.secao === 'lote')
    assert.deepEqual(
      novos.map((a: { tipo: string }) => a.tipo),
      ['nota_fiscal', 'nota_fiscal'],
    )
    assert.equal(r.body.historico[0].acao, 'documento_adicionado')
    assert.equal(r.body.historico[0].mudancas[0].depois, 'nota_fiscal')

    assert.equal((await enviarDocs(lote.id, null, ['x.pdf'])).status, 422)
    assert.equal((await enviarDocs(lote.id, 'boleto', ['x.pdf'])).status, 422)
    assert.equal((await enviarDocs(lote.id, 'mtr', ['app.exe'])).status, 415)
    assert.equal((await enviarDocs(lote.id, 'mtr', [])).status, 422)
  })

  it('remove documento (histórico); o único escopo sem texto não pode sair', async () => {
    const lote = (
      await criarOrdem(ordem({ escopo: null }), [
        { campo: 'escopo', nome: 'escopo.pdf', conteudo: 'a' },
      ])
    ).body
    const comMtr = (await enviarDocs(lote.id, 'mtr', ['MTR.pdf'])).body
    const mtr = comMtr.anexos.find((a: { nome: string }) => a.nome === 'MTR.pdf')
    const escopo = comMtr.anexos.find((a: { nome: string }) => a.nome === 'escopo.pdf')

    const semMtr = await api(`/ordens/${lote.id}/anexos/${mtr.id}`, { method: 'DELETE' })
    assert.equal(semMtr.status, 200)
    assert.equal(semMtr.body.anexos.length, 1)
    assert.equal(semMtr.body.historico[0].acao, 'documento_removido')
    assert.equal(semMtr.body.historico[0].nota, 'MTR.pdf')
    const baixar = await fetch(`${base}/ordens/${lote.id}/anexos/${mtr.id}/arquivo`)
    assert.equal(baixar.status, 404)

    const unico = await api(`/ordens/${lote.id}/anexos/${escopo.id}`, { method: 'DELETE' })
    assert.equal(unico.status, 422)
    assert.equal(unico.body.code, 'scope_required')
  })
})

describe('ordens › editar lote', () => {
  it('edita enquanto agendado, refaz o pré-cálculo e registra antes → depois', async () => {
    const lote = (await criarOrdem(ordem())).body
    const r = await api(`/ordens/${lote.id}`, {
      method: 'PUT',
      body: ordem({
        docaId: docaPequenaId,
        dataColeta: '2026-11-03',
        quantidades: { ...ordem().quantidades, pallets: 30 },
      }),
    })
    assert.equal(r.status, 200)
    assert.equal(r.body.docaNumero, 'D2')
    assert.equal(r.body.totalVolumes, 35)
    assert.notDeepEqual(r.body.calculo, lote.calculo)
    const ev = r.body.historico[0]
    assert.equal(ev.acao, 'editado')
    const campos = Object.fromEntries(
      ev.mudancas.map((m: { campo: string; antes: unknown; depois: unknown }) => [
        m.campo,
        [m.antes, m.depois],
      ]),
    )
    assert.deepEqual(campos.doca, ['D1', 'D2'])
    assert.deepEqual(campos.dataColeta, ['2026-10-25', '2026-11-03'])
    assert.deepEqual(campos.pallets, [6, 30])

    // Sem mudança: não grava histórico.
    const igual = await api(`/ordens/${lote.id}`, {
      method: 'PUT',
      body: ordem({
        docaId: docaPequenaId,
        dataColeta: '2026-11-03',
        quantidades: { ...ordem().quantidades, pallets: 30 },
      }),
    })
    assert.equal(igual.body.historico.length, r.body.historico.length)
  })

  it('o cliente não muda; escopo continua obrigatório; depois de recebido, trava', async () => {
    const lote = (await criarOrdem(ordem())).body
    const outro = await api('/clientes?q=verde')
    const cliente = await api(`/ordens/${lote.id}`, {
      method: 'PUT',
      body: ordem({ clienteId: outro.body.rows[0].id }),
    })
    assert.equal(cliente.status, 422)
    const semEscopo = await api(`/ordens/${lote.id}`, {
      method: 'PUT',
      body: ordem({ escopo: null }),
    })
    assert.equal(semEscopo.status, 422)
    assert.equal(semEscopo.body.code, 'scope_required')

    await db.updateTable('ordens').set({ status: 'inspecao' }).where('id', '=', lote.id).execute()
    const travado = await api(`/ordens/${lote.id}`, { method: 'PUT', body: ordem() })
    assert.equal(travado.status, 409)
    assert.equal(travado.body.code, 'invalid_transition')
  })
})

/* ------------------------------------------------------------ recebimento */

type Foto = { campo: string; nome: string }

/** Envia o recebimento como a tela faz: multipart com `dados` (JSON) e as fotos por campo. */
async function enviarRecebimento(
  ordemId: string,
  dados: Record<string, unknown>,
  fotos: Foto[],
  method: 'POST' | 'PUT' = 'POST',
) {
  const form = new FormData()
  form.append('dados', JSON.stringify(dados))
  for (const f of fotos) form.append(f.campo, new Blob([f.nome]), f.nome)
  const res = await fetch(`${base}/ordens/${ordemId}/recebimento`, { method, body: form })
  return { status: res.status, body: JSON.parse(await res.text()) }
}

const hojeSp = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

const recebimento = (extra: Record<string, unknown> = {}) => ({
  dataRecebimento: hojeSp(),
  inspecao: 'bom',
  inspecaoDescricao: null,
  lacres: [{ numero: 'LAC-001' }],
  notas: [{ numero: '123456' }],
  pallets: [
    { pesoBruto: 250.5, tara: 20, conteudo: 'Servidores' },
    { pesoBruto: 300, tara: null },
  ],
  ...extra,
})

const FOTOS_OK: Foto[] = [
  { campo: 'lacres.0', nome: 'lacre.jpg' },
  { campo: 'notas.0', nome: 'nf.png' },
  { campo: 'pallets.0', nome: 'p1.jpg' },
  { campo: 'pallets.1', nome: 'p2.jpg' },
  { campo: 'gerais', nome: 'doca.webp' },
]

describe('ordens › recebimento', () => {
  it('recebe o lote agendado: vai para Inspeção, guarda pallets, lacres, notas e fotos', async () => {
    const lote = (await criarOrdem(ordem())).body
    const r = await enviarRecebimento(lote.id, recebimento(), FOTOS_OK)
    assert.equal(r.status, 201)
    const o = r.body
    assert.equal(o.status, 'inspecao')
    assert.ok(o.recebidoEm)
    assert.deepEqual(
      o.etapas.map((e: { etapa: string }) => e.etapa),
      ['agendado', 'inspecao'],
    )
    assert.equal(o.recebimento.inspecao, 'bom')
    assert.equal(o.recebimento.lacres[0].numero, 'LAC-001')
    assert.equal(o.recebimento.lacres[0].fotos.length, 1)
    assert.equal(o.recebimento.notas[0].fotos[0].nome, 'nf.png')
    assert.equal(o.recebimento.fotosGerais.length, 1)
    assert.equal(o.pallets.length, 2)
    assert.equal(o.pallets[0].pesoKg, 250.5)
    assert.equal(o.pallets[0].pesoLiquidoKg, 230.5)
    assert.equal(o.pallets[1].pesoLiquidoKg, 300)
    assert.equal(o.pallets[0].fotos[0].nome, 'p1.jpg')
    assert.equal(o.pallets[0].origem, 'iERP')
    assert.equal(o.historico[0].acao, 'recebido')

    // Foto servida como imagem.
    const foto = await fetch(
      `${base}/ordens/${lote.id}/recebimento/fotos/${o.recebimento.lacres[0].fotos[0].id}`,
    )
    assert.equal(foto.status, 200)
    assert.equal(foto.headers.get('content-type'), 'image/jpeg')

    // Recebido não recebe de novo.
    const denovo = await enviarRecebimento(lote.id, recebimento(), FOTOS_OK)
    assert.equal(denovo.status, 409)
  })

  it('obrigatórios: pallet com peso e foto; lacre/nota com foto; inspeção; data não futura', async () => {
    const lote = (await criarOrdem(ordem())).body
    const semPallet = await enviarRecebimento(lote.id, recebimento({ pallets: [] }), [])
    assert.equal(semPallet.status, 422)
    const semFotoPallet = await enviarRecebimento(
      lote.id,
      recebimento(),
      FOTOS_OK.filter((f) => f.campo !== 'pallets.1'),
    )
    assert.equal(semFotoPallet.status, 422)
    const semFotoLacre = await enviarRecebimento(
      lote.id,
      recebimento(),
      FOTOS_OK.filter((f) => f.campo !== 'lacres.0'),
    )
    assert.equal(semFotoLacre.status, 422)
    const semInspecao = await enviarRecebimento(
      lote.id,
      recebimento({ inspecao: undefined }),
      FOTOS_OK,
    )
    assert.equal(semInspecao.status, 422)
    const futuro = await enviarRecebimento(
      lote.id,
      recebimento({ dataRecebimento: '2999-01-01' }),
      FOTOS_OK,
    )
    assert.equal(futuro.status, 422)
    const taraMaior = await enviarRecebimento(
      lote.id,
      recebimento({ pallets: [{ pesoBruto: 10, tara: 20 }, { pesoBruto: 5 }] }),
      FOTOS_OK,
    )
    assert.equal(taraMaior.status, 422)
    const pdf = await enviarRecebimento(lote.id, recebimento(), [
      ...FOTOS_OK,
      { campo: 'gerais', nome: 'laudo.pdf' },
    ])
    assert.equal(pdf.status, 415)
    // Nada foi gravado: continua agendado.
    assert.equal((await api(`/ordens/${lote.id}`)).body.status, 'agendado')
  })

  it('avaria pede descrição e vira ocorrência; a correção acompanha (e bom cancela)', async () => {
    const lote = (await criarOrdem(ordem())).body
    const semDescricao = await enviarRecebimento(
      lote.id,
      recebimento({ inspecao: 'avaria' }),
      FOTOS_OK,
    )
    assert.equal(semDescricao.status, 422)

    const r = await enviarRecebimento(
      lote.id,
      recebimento({
        inspecao: 'avaria',
        inspecaoDescricao: texto('Pallet 2 com a base quebrada.'),
      }),
      FOTOS_OK,
    )
    assert.equal(r.status, 201)
    const oc = r.body.ocorrencias[0]
    assert.equal(oc.momento, 'recebimento')
    assert.equal(oc.categoria, 'avaria_carga')
    assert.equal(r.body.recebimento.ocorrenciaId, oc.id)

    // Correção: mantém as fotos (por id), muda a descrição → a ocorrência acompanha.
    const atual = r.body
    const manter = (fotos: { id: string }[]) => fotos.map((f) => f.id)
    const correcao = {
      dataRecebimento: hojeSp(),
      inspecao: 'outro',
      inspecaoDescricao: texto('Carga molhada.'),
      lacres: atual.recebimento.lacres.map((l: { id: string; numero: string; fotos: [] }) => ({
        id: l.id,
        numero: l.numero,
        fotosManter: manter(l.fotos),
      })),
      notas: [],
      pallets: atual.pallets.map(
        (p: { id: string; pesoKg: number; taraKg: number | null; fotos: [] }) => ({
          id: p.id,
          pesoBruto: p.pesoKg,
          tara: p.taraKg,
          fotosManter: manter(p.fotos),
        }),
      ),
      fotosGeraisManter: manter(atual.recebimento.fotosGerais),
    }
    const c = await enviarRecebimento(lote.id, correcao, [], 'PUT')
    assert.equal(c.status, 200)
    assert.equal(c.body.recebimento.notas.length, 0)
    assert.equal(c.body.pallets[0].id, atual.pallets[0].id)
    const mesma = c.body.ocorrencias.find((x: { id: string }) => x.id === oc.id)
    assert.equal(mesma.categoria, 'outro')
    assert.equal(mesma.texto.textos['pt-BR'], 'Carga molhada.')
    assert.ok(c.body.historico.some((h: { acao: string }) => h.acao === 'recebimento_editado'))

    const bom = await enviarRecebimento(
      lote.id,
      { ...correcao, inspecao: 'bom', inspecaoDescricao: null },
      [],
      'PUT',
    )
    assert.equal(bom.status, 200)
    const cancelada = bom.body.ocorrencias.find((x: { id: string }) => x.id === oc.id)
    assert.equal(cancelada.status, 'cancelado')
    assert.equal(bom.body.recebimento.ocorrenciaId, null)
  })

  it('correção só enquanto em Inspeção', async () => {
    const lote = (await criarOrdem(ordem())).body
    const naoRecebido = await enviarRecebimento(lote.id, recebimento(), FOTOS_OK, 'PUT')
    assert.equal(naoRecebido.status, 409)
    await enviarRecebimento(lote.id, recebimento(), FOTOS_OK)
    await db.updateTable('ordens').set({ status: 'processo' }).where('id', '=', lote.id).execute()
    const travado = await enviarRecebimento(lote.id, recebimento(), FOTOS_OK, 'PUT')
    assert.equal(travado.status, 409)
  })
})
