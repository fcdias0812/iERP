import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import { criarApp } from '../../app.js'
import { criarDb, type Db } from '../../db/database.js'
import { migrarParaUltima } from '../../db/migrate.js'
import { semear } from '../../db/seed.js'

/* API de clientes de ponta a ponta (HTTP real + SQLite em memória). */

let db: Db
let base: string
let fechar: () => void

before(async () => {
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  await semear(db)
  const servidor = criarApp(db).listen(0)
  await new Promise((ok) => servidor.once('listening', ok))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
  fechar = () => servidor.close()
})

after(async () => {
  fechar()
  await db.destroy()
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

const qs = (p: Record<string, unknown>) =>
  '?' +
  new URLSearchParams(
    Object.entries(p).map(([k, v]): [string, string] => [
      k,
      typeof v === 'string' ? v : JSON.stringify(v),
    ]),
  ).toString()

// CNPJs válidos: numérico e alfanumérico (exemplo da Receita).
const CNPJ_NUMERICO = '11.444.777/0001-61'
const CNPJ_ALFA = '12.ABC.345/01DE-35'

const novo = (cnpj: string, extra: Record<string, unknown> = {}) => ({
  nome: 'Cliente de Teste Ltda',
  cnpj,
  contatos: [
    { nome: 'Ana', email: 'Ana@Teste.com.br', telefone: '(11) 98765-4321', principal: true },
    { email: 'compras@teste.com.br', telefone: '1132345678', principal: false },
  ],
  ...extra,
})

describe('clientes', () => {
  it('lista com o contato principal, ordenada por nome', async () => {
    const { status, body } = await api(`/clientes${qs({ ps: '50' })}`)
    assert.equal(status, 200)
    assert.equal(body.total, 8)
    const nomes = body.rows.map((r: { nome: string }) => r.nome)
    assert.deepEqual(
      nomes,
      [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    )
    const alfa = body.rows.find((r: { nome: string }) => r.nome.startsWith('Alfa'))
    assert.equal(alfa.contatoEmail, 'juliana.rocha@alfatelecom.exemplo.com.br')
    assert.equal(alfa.contatos, 3)
    assert.equal(body.facets.status.inativo, 1)
  })

  it('filtra CNPJ e telefone digitados com pontuação e busca por contato', async () => {
    const lista = await api(`/clientes${qs({ ps: '50' })}`)
    const technova = lista.body.rows.find((r: { nome: string }) => r.nome.startsWith('TechNova'))
    const cnpjFormatado = `${technova.cnpj.slice(0, 2)}.${technova.cnpj.slice(2, 5)}`
    const porCnpj = await api(`/clientes${qs({ f: { cnpj: cnpjFormatado } })}`)
    assert.equal(porCnpj.body.rows[0].id, technova.id)

    const porTelefone = await api(`/clientes${qs({ f: { contatoTelefone: '(11) 98765' } })}`)
    assert.equal(porTelefone.body.total, 1)

    // A busca geral também encontra contatos que não são o principal.
    const porContato = await api(`/clientes${qs({ q: 'logistica@alfatelecom' })}`)
    assert.equal(porContato.body.total, 1)
  })

  it('cria com CNPJ alfanumérico, limpa máscaras e impede CNPJ repetido', async () => {
    const criado = await api('/clientes', { method: 'POST', body: novo(CNPJ_ALFA) })
    assert.equal(criado.status, 201)
    assert.equal(criado.body.codigo, 'CLI-00009')
    assert.equal(criado.body.cnpj, '12ABC34501DE35')
    assert.equal(criado.body.contatos[0].email, 'ana@teste.com.br')
    assert.equal(criado.body.contatos[0].telefone, '11987654321')
    assert.equal(criado.body.contatos[0].principal, true)
    assert.equal(criado.body.contatos[1].nome, null)
    assert.deepEqual(criado.body.acoesPermitidas, ['inativar'])

    const repetido = await api('/clientes', { method: 'POST', body: novo('12abc34501de35') })
    assert.equal(repetido.status, 409)
    assert.equal(repetido.body.code, 'cnpj_in_use')
  })

  it('valida CNPJ, telefone e o contato principal', async () => {
    const cnpj = await api('/clientes', { method: 'POST', body: novo('11.444.777/0001-62') })
    assert.equal(cnpj.status, 422)

    const telefone = await api('/clientes', {
      method: 'POST',
      body: novo(CNPJ_NUMERICO, {
        contatos: [{ email: 'a@b.com.br', telefone: '1234', principal: true }],
      }),
    })
    assert.equal(telefone.status, 422)

    const doisPrincipais = await api('/clientes', {
      method: 'POST',
      body: novo(CNPJ_NUMERICO, {
        contatos: [
          { email: 'a@b.com.br', telefone: '11987654321', principal: true },
          { email: 'c@d.com.br', telefone: '11987654322', principal: true },
        ],
      }),
    })
    assert.equal(doisPrincipais.status, 422)

    const semContato = await api('/clientes', {
      method: 'POST',
      body: novo(CNPJ_NUMERICO, { contatos: [] }),
    })
    assert.equal(semContato.status, 422)
  })

  it('edita contatos e registra antes → depois no histórico', async () => {
    const criado = await api('/clientes', { method: 'POST', body: novo(CNPJ_NUMERICO) })
    const editado = await api(`/clientes/${criado.body.id}`, {
      method: 'PUT',
      body: {
        nome: 'Cliente Renomeado Ltda',
        cnpj: CNPJ_NUMERICO,
        contatos: [{ email: 'compras@teste.com.br', telefone: '1132345678', principal: true }],
      },
    })
    assert.equal(editado.status, 200)
    assert.equal(editado.body.contatos.length, 1)
    const evento = editado.body.historico[0]
    assert.equal(evento.acao, 'editado')
    assert.deepEqual(
      evento.mudancas.map((m: { campo: string }) => m.campo),
      ['nome', 'contatos'],
    )
    // Lista reflete o novo contato principal.
    const lista = await api(`/clientes${qs({ q: 'renomeado' })}`)
    assert.equal(lista.body.rows[0].contatoEmail, 'compras@teste.com.br')
  })

  it('inativa e reativa; transição inválida dá 409', async () => {
    const { body: lista } = await api(`/clientes${qs({ q: 'verde recicla' })}`)
    const id = lista.rows[0].id
    const inativo = await api(`/clientes/${id}/transicao`, {
      method: 'POST',
      body: { acao: 'inativar' },
    })
    assert.equal(inativo.body.status, 'inativo')
    const invalida = await api(`/clientes/${id}/transicao`, {
      method: 'POST',
      body: { acao: 'inativar' },
    })
    assert.equal(invalida.status, 409)
    const ativo = await api(`/clientes/${id}/transicao`, {
      method: 'POST',
      body: { acao: 'reativar' },
    })
    assert.equal(ativo.body.status, 'ativo')
  })

  it('resumo, 404 e busca global', async () => {
    const resumo = await api('/clientes/resumo')
    assert.equal(resumo.body.total, resumo.body.ativos + resumo.body.inativos)
    assert.equal((await api('/clientes/nao-existe')).status, 404)
    const busca = await api(`/busca${qs({ q: 'technova' })}`)
    assert.equal(busca.body[0].tipo, 'cliente')
    assert.equal(busca.body[0].rota, `/clientes/${busca.body[0].id}`)
  })
})
