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
import { criarServicoGeo, variantesEndereco } from '../geo/geo.servico.js'

/* Clientes › Logística (sites/docas), Documentos e Geolocalização — HTTP real + SQLite em memória. */

let db: Db
let base: string
let fechar: () => void
let pasta: string
let clienteId: string
const chamadasGeo: string[] = []

/** Respostas falsas do ViaCEP/Nominatim (os testes não saem para a internet). */
const fetchFalso: typeof fetch = async (entrada) => {
  const url = String(entrada)
  chamadasGeo.push(url)
  if (url.includes('viacep.com.br/ws/01001000'))
    return Response.json({
      cep: '01001-000',
      logradouro: 'Praça da Sé',
      bairro: 'Sé',
      localidade: 'São Paulo',
      uf: 'SP',
      regiao: 'sudeste',
    })
  if (url.includes('viacep.com.br')) return Response.json({ erro: 'true' })
  const q = new URL(url).searchParams.get('q') ?? ''
  if (url.includes('nominatim') && q.startsWith('Pra'))
    return Response.json([{ lat: '-23.55', lon: '-46.63', display_name: 'Praça da Sé, São Paulo' }])
  // Bairro desconhecido do mapa: só acha sem o bairro.
  if (url.includes('nominatim') && q === 'Alameda Rio Negro, Barueri, SP')
    return Response.json([
      { lat: '-23.50', lon: '-46.84', display_name: 'Alameda Rio Negro, Barueri' },
    ])
  if (url.includes('nominatim') && q === 'Vinhedo, SP')
    return Response.json([{ lat: '-23.03', lon: '-46.97', display_name: 'Vinhedo, São Paulo' }])
  return Response.json([])
}

before(async () => {
  pasta = await mkdtemp(path.join(os.tmpdir(), 'ierp-docs-'))
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  await semear(db)
  const servidor = criarApp(db, {
    arquivosDir: pasta,
    geo: criarServicoGeo({ contato: 'teste', fetch: fetchFalso }),
  }).listen(0)
  await new Promise((ok) => servidor.once('listening', ok))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
  fechar = () => servidor.close()
  const lista = (await (await fetch(`${base}/clientes?q=technova`)).json()) as {
    rows: { id: string }[]
  }
  clienteId = lista.rows[0]!.id
})

after(async () => {
  fechar()
  await db.destroy()
  await rm(pasta, { recursive: true, force: true })
})

async function api(caminho: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${base}${caminho}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const texto = await res.text()
  return { status: res.status, body: texto ? JSON.parse(texto) : undefined }
}

const doca = (numero: string, extra: Record<string, unknown> = {}) => ({
  numero,
  alturaMaxCaminhao: 4.2,
  comprimentoMaxCaminhao: 12,
  dockLeveler: true,
  tailLift: false,
  areaLift: null,
  espaco: 30,
  altura: null,
  voltagemShredder: 380,
  pisoProtecaoObrigatorio: false,
  ...extra,
})

const site = (extra: Record<string, unknown> = {}) => ({
  codigo: 'SPO-01',
  regiao: 'sudeste',
  horario: 'seg a sex, 8h às 18h',
  totalGaylords: 20,
  cep: '01001-000',
  endereco: 'Praça da Sé, Sé, São Paulo – SP',
  latitude: -23.55,
  longitude: -46.63,
  shredderProprio: true,
  edgeSite: false,
  docas: [doca('D1')],
  ...extra,
})

describe('clientes › logística', () => {
  it('cria site com contato NOVO como responsável (vira contato do cliente)', async () => {
    const r = await api(`/clientes/${clienteId}/sites`, {
      method: 'POST',
      body: site({
        novoContato: {
          nome: 'Gerente do Site',
          email: 'Site@TechNova.com.br',
          telefone: '(11) 98888-7777',
        },
      }),
    })
    assert.equal(r.status, 201)
    assert.equal(r.body.codigo, 'SPO-01')
    assert.equal(r.body.cep, '01001000')
    assert.equal(r.body.responsavel.email, 'site@technova.com.br')
    assert.equal(r.body.docas[0].voltagemShredder, 380)

    const cliente = await api(`/clientes/${clienteId}`)
    assert.ok(
      cliente.body.contatos.some((k: { email: string }) => k.email === 'site@technova.com.br'),
    )
    assert.equal(cliente.body.historico[0].acao, 'site_criado')
  })

  it('impede código repetido no mesmo cliente e docas com o mesmo número', async () => {
    const repetido = await api(`/clientes/${clienteId}/sites`, {
      method: 'POST',
      body: site({ codigo: 'spo-01' }),
    })
    assert.equal(repetido.status, 409)
    assert.equal(repetido.body.code, 'site_code_in_use')

    const docas = await api(`/clientes/${clienteId}/sites`, {
      method: 'POST',
      body: site({ codigo: 'SPO-02', docas: [doca('D1'), doca('d1')] }),
    })
    assert.equal(docas.status, 422)
  })

  it('valida coordenadas juntas e responsável de outro cliente', async () => {
    const coord = await api(`/clientes/${clienteId}/sites`, {
      method: 'POST',
      body: site({ codigo: 'X1', latitude: -23, longitude: null }),
    })
    assert.equal(coord.status, 422)
    const outro = await api(`/clientes/${clienteId}/sites`, {
      method: 'POST',
      body: site({ codigo: 'X2', contatoId: 'contato-de-outro-cliente' }),
    })
    assert.equal(outro.status, 422)
  })

  it('região é a lista das 5 regiões do Brasil (código); vazio = sem região', async () => {
    const invalida = await api(`/clientes/${clienteId}/sites`, {
      method: 'POST',
      body: site({ codigo: 'R1', regiao: 'São Paulo' }),
    })
    assert.equal(invalida.status, 422)
    const vazia = await api(`/clientes/${clienteId}/sites`, {
      method: 'POST',
      body: site({ codigo: 'R2', regiao: '' }),
    })
    assert.equal(vazia.status, 201)
    assert.equal(vazia.body.regiao, null)
    const centro = await api(`/clientes/${clienteId}/sites/${vazia.body.id}`, {
      method: 'PUT',
      body: site({ codigo: 'R2', regiao: 'centro_oeste' }),
    })
    assert.equal(centro.body.regiao, 'centro_oeste')
    await api(`/clientes/${clienteId}/sites/${vazia.body.id}`, { method: 'DELETE' })
  })

  it('edita site e docas com antes → depois no histórico; responsável sobrevive à edição de contatos', async () => {
    const [atual] = (await api(`/clientes/${clienteId}/sites`)).body
    const editado = await api(`/clientes/${clienteId}/sites/${atual.id}`, {
      method: 'PUT',
      body: site({
        regiao: 'sul',
        contatoId: atual.responsavel.id,
        docas: [doca('D1'), doca('D2', { tailLift: true })],
      }),
    })
    assert.equal(editado.status, 200)
    assert.equal(editado.body.docas.length, 2)
    const evento = (await api(`/clientes/${clienteId}`)).body.historico[0]
    assert.equal(evento.acao, 'site_editado')
    assert.deepEqual(
      evento.mudancas.map((m: { campo: string }) => m.campo),
      ['regiao', 'docas'],
    )

    // Editar o cliente reenviando os contatos (com id) mantém o responsável do site.
    const cliente = (await api(`/clientes/${clienteId}`)).body
    await api(`/clientes/${clienteId}`, {
      method: 'PUT',
      body: { nome: `${cliente.nome} `, cnpj: cliente.cnpj, contatos: cliente.contatos },
    })
    const [depois] = (await api(`/clientes/${clienteId}/sites`)).body
    assert.equal(depois.responsavel?.id, atual.responsavel.id)

    // Tirar o contato da lista deixa o site sem responsável (não apaga o site).
    const semResponsavel = cliente.contatos.filter(
      (k: { id: string }) => k.id !== atual.responsavel.id,
    )
    await api(`/clientes/${clienteId}`, {
      method: 'PUT',
      body: { nome: cliente.nome, cnpj: cliente.cnpj, contatos: semResponsavel },
    })
    const [semResp] = (await api(`/clientes/${clienteId}/sites`)).body
    assert.equal(semResp.responsavel, null)
  })

  it('remove site e registra no histórico', async () => {
    const [atual] = (await api(`/clientes/${clienteId}/sites`)).body
    const r = await api(`/clientes/${clienteId}/sites/${atual.id}`, { method: 'DELETE' })
    assert.equal(r.status, 204)
    assert.deepEqual((await api(`/clientes/${clienteId}/sites`)).body, [])
    assert.equal((await api(`/clientes/${clienteId}`)).body.historico[0].acao, 'site_removido')
  })
})

describe('clientes › documentos', () => {
  const enviar = (nome: string, conteudo: string | Uint8Array, tipo = 'contrato') => {
    const form = new FormData()
    form.set('tipo', tipo)
    form.set('arquivo', new Blob([conteudo]), nome)
    return fetch(`${base}/clientes/${clienteId}/documentos`, { method: 'POST', body: form })
  }

  it('envia, lista, baixa e remove (nome com acento preservado)', async () => {
    const r = await enviar('Contrato de Serviço.pdf', '%PDF-1.4 teste')
    assert.equal(r.status, 201)
    const doc = (await r.json()) as { id: string; nome: string; extensao: string; tipo: string }
    assert.equal(doc.nome, 'Contrato de Serviço.pdf')
    assert.equal(doc.extensao, 'pdf')
    assert.equal(doc.tipo, 'contrato')

    const lista = await api(`/clientes/${clienteId}/documentos`)
    assert.equal(lista.body.length, 1)

    const download = await fetch(`${base}/clientes/${clienteId}/documentos/${doc.id}/arquivo`)
    assert.equal(download.headers.get('content-type'), 'application/pdf')
    assert.match(download.headers.get('content-disposition') ?? '', /attachment/)
    assert.equal(await download.text(), '%PDF-1.4 teste')

    const hist = (await api(`/clientes/${clienteId}`)).body.historico[0]
    assert.equal(hist.acao, 'documento_adicionado')

    assert.equal(
      (await api(`/clientes/${clienteId}/documentos/${doc.id}`, { method: 'DELETE' })).status,
      204,
    )
    assert.deepEqual((await api(`/clientes/${clienteId}/documentos`)).body, [])
  })

  it('recusa extensão não permitida, tipo inválido e arquivo grande demais', async () => {
    assert.equal((await enviar('script.exe', 'MZ')).status, 415)
    assert.equal((await enviar('nota.pdf', 'x', 'nao-existe')).status, 422)
    const grande = new Uint8Array(25 * 1024 * 1024 + 1)
    assert.equal((await enviar('grande.pdf', grande)).status, 413)
  })
})

describe('clientes › visão geral e geolocalização', () => {
  it('resumo de lotes informa que a integração não está ligada', async () => {
    const r = await api(`/clientes/${clienteId}/lotes/resumo`)
    assert.equal(r.body.conectado, false)
    assert.deepEqual(r.body.ultimos, [])
  })

  it('CEP → endereço (com região) e endereço → coordenadas, com cache', async () => {
    const cep = await api('/geo/cep/01001-000')
    // O ViaCEP devolve "Sudeste"; a API devolve o código da região.
    assert.equal(cep.body.regiao, 'sudeste')
    assert.equal(cep.body.endereco, 'Praça da Sé, Sé, São Paulo – SP')
    assert.equal((await api('/geo/cep/99999999')).status, 404)

    const antes = chamadasGeo.length
    const coord = await api('/geo/endereco?q=Praça da Sé, São Paulo')
    assert.equal(coord.body.latitude, -23.55)
    await api('/geo/endereco?q=praça da sé,  são paulo')
    assert.equal(chamadasGeo.length, antes + 1, 'a segunda consulta igual vem do cache')
    assert.equal((await api('/geo/endereco?q=Lugar Que Não Existe')).status, 404)
  })

  it('endereço: tenta sem o bairro e, por fim, só a cidade (aproximado)', async () => {
    assert.deepEqual(
      variantesEndereco('Alameda Rio Negro, Alphaville Centro/Alphaville., Barueri – SP'),
      [
        { q: 'Alameda Rio Negro, Alphaville Centro/Alphaville, Barueri, SP', precisao: 'endereco' },
        { q: 'Alameda Rio Negro, Barueri, SP', precisao: 'endereco' },
        { q: 'Barueri, SP', precisao: 'cidade' },
      ],
    )
    const semBairro = await api(
      `/geo/endereco?${new URLSearchParams({ q: 'Alameda Rio Negro, Alphaville Centro/Alphaville., Barueri – SP' })}`,
    )
    assert.equal(semBairro.body.latitude, -23.5)
    assert.equal(semBairro.body.precisao, 'endereco')
    const cidade = await api(
      `/geo/endereco?${new URLSearchParams({ q: 'Rua Inexistente, Centro, Vinhedo – SP' })}`,
    )
    assert.equal(cidade.body.precisao, 'cidade')
  })
})
