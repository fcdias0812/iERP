import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import { criarApp } from '../../app.js'
import { criarDb, type Db } from '../../db/database.js'
import { migrarParaUltima } from '../../db/migrate.js'
import { semear } from '../../db/seed.js'

/* API de usuários de ponta a ponta (HTTP real + SQLite em memória). */

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

describe('usuarios', () => {
  it('lista paginada, ordenada por nome por padrão, com contagens dos filtros', async () => {
    const { status, body } = await api(`/usuarios${qs({ ps: '5' })}`)
    assert.equal(status, 200)
    assert.equal(body.total, 12)
    assert.equal(body.rows.length, 5)
    const nomes = body.rows.map((r: { nome: string }) => r.nome)
    assert.deepEqual(
      nomes,
      [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    )
    assert.equal(body.facets.status.ativo, 10)
  })

  it('busca sem acento e filtro por status', async () => {
    const busca = await api(`/usuarios${qs({ q: 'joao' })}`)
    assert.equal(busca.body.total, 1)
    assert.equal(busca.body.rows[0].nome, 'João Ribeiro')

    // Curingas do LIKE são texto comum.
    const curinga = await api(`/usuarios${qs({ q: '%' })}`)
    assert.equal(curinga.body.total, 0)

    const bloqueados = await api(`/usuarios${qs({ f: { status: ['bloqueado'] } })}`)
    assert.equal(bloqueados.body.total, 1)
    // A contagem do próprio filtro ignora o filtro (mostra as outras opções).
    assert.equal(bloqueados.body.facets.status.ativo, 10)
  })

  it('ordena status pelo fluxo e deixa vazios no fim', async () => {
    const { body } = await api(`/usuarios${qs({ s: '-status', ps: '50' })}`)
    assert.deepEqual(
      body.rows.slice(0, 2).map((r: { status: string }) => r.status),
      ['inativo', 'bloqueado'],
    )
    const porAcesso = await api(`/usuarios${qs({ s: 'ultimoAcesso', ps: '50' })}`)
    const ultimo = porAcesso.body.rows.at(-1)
    assert.equal(ultimo.ultimoAcesso, null)
  })

  it('cria, impede e-mail repetido e registra histórico na edição', async () => {
    const criado = await api('/usuarios', {
      method: 'POST',
      body: { nome: '  Ana Teste ', email: 'Ana.Teste@Exemplo.com.br', perfil: 'leitura' },
    })
    assert.equal(criado.status, 201)
    assert.equal(criado.body.codigo, 'USR-00013')
    assert.equal(criado.body.nome, 'Ana Teste')
    assert.equal(criado.body.email, 'ana.teste@exemplo.com.br')
    assert.equal(criado.body.status, 'ativo')
    assert.deepEqual(criado.body.acoesPermitidas, ['bloquear', 'inativar'])

    const repetido = await api('/usuarios', {
      method: 'POST',
      body: { nome: 'Outra Ana', email: 'ANA.TESTE@exemplo.com.br', perfil: 'leitura' },
    })
    assert.equal(repetido.status, 409)
    assert.equal(repetido.body.code, 'email_in_use')

    const editado = await api(`/usuarios/${criado.body.id}`, {
      method: 'PUT',
      body: { nome: 'Ana Teste', email: 'ana.teste@exemplo.com.br', perfil: 'operacao' },
    })
    assert.equal(editado.status, 200)
    assert.equal(editado.body.perfil, 'operacao')
    assert.equal(editado.body.historico[0].acao, 'editado')
    assert.deepEqual(editado.body.historico[0].mudancas, [
      { campo: 'perfil', antes: 'leitura', depois: 'operacao' },
    ])
  })

  it('valida os dados', async () => {
    const r = await api('/usuarios', {
      method: 'POST',
      body: { nome: 'A', email: 'x', perfil: 'x' },
    })
    assert.equal(r.status, 422)
    assert.equal(r.body.code, 'validation')
  })

  it('fluxo de status: bloquear exige motivo; transição inválida dá 409', async () => {
    const { body: lista } = await api(`/usuarios${qs({ q: 'rafael' })}`)
    const id = lista.rows[0].id

    const semMotivo = await api(`/usuarios/${id}/transicao`, {
      method: 'POST',
      body: { acao: 'bloquear' },
    })
    assert.equal(semMotivo.status, 422)

    const bloqueado = await api(`/usuarios/${id}/transicao`, {
      method: 'POST',
      body: { acao: 'bloquear', motivo: 'Teste' },
    })
    assert.equal(bloqueado.body.status, 'bloqueado')
    assert.equal(bloqueado.body.historico[0].nota, 'Teste')

    const invalida = await api(`/usuarios/${id}/transicao`, {
      method: 'POST',
      body: { acao: 'reativar' },
    })
    assert.equal(invalida.status, 409)
    assert.equal(invalida.body.code, 'invalid_transition')
  })

  it('404 para usuário inexistente', async () => {
    const r = await api('/usuarios/nao-existe')
    assert.equal(r.status, 404)
    assert.equal(r.body.code, 'not_found')
  })

  it('busca global (Ctrl+K)', async () => {
    const r = await api(`/busca${qs({ q: 'albuquerque' })}`)
    assert.equal(r.body[0].tipo, 'usuario')
    assert.ok(r.body[0].id)
  })
})
