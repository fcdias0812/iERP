import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import { criarApp } from '../../app.js'
import { criarDb, type Db } from '../../db/database.js'
import { migrarParaUltima } from '../../db/migrate.js'
import { semear } from '../../db/seed.js'

/* Administração › Perfis de acesso e Auditoria — HTTP real + SQLite em memória. */

let db: Db
let base: string
let fechar: () => void

async function api(caminho: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${base}${caminho}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const texto = await res.text()
  return { status: res.status, body: texto ? JSON.parse(texto) : undefined }
}

const texto = (pt: string) => ({ origem: 'pt-BR', textos: { 'pt-BR': pt } })

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

describe('perfis de acesso', () => {
  it('os 3 perfis de antes viram registros; Administrador é fixo', async () => {
    const r = await api('/perfis')
    assert.equal(r.status, 200)
    const ids = r.body.map((p: { id: string }) => p.id)
    assert.deepEqual(ids.slice(0, 1), ['admin'])
    assert.ok(ids.includes('operacao') && ids.includes('leitura'))
    const operacao = r.body.find((p: { id: string }) => p.id === 'operacao')
    assert.equal(operacao.permissoes['ordens.lotes'], 'editar')
    assert.equal(operacao.permissoes['admin.usuarios'], undefined)
    const leitura = r.body.find((p: { id: string }) => p.id === 'leitura')
    assert.equal(leitura.permissoes.clientes, 'ver')

    const admin = await api('/perfis/admin')
    assert.equal(admin.body.fixo, true)
    assert.deepEqual(admin.body.acoesPermitidas, [])
    const editar = await api('/perfis/admin', {
      method: 'PUT',
      body: { nome: texto('Chefe'), permissoes: {} },
    })
    assert.equal(editar.status, 409)
    assert.equal(editar.body.code, 'fixed_profile')
  })

  it('cria perfil por página (só páginas conhecidas), edita com histórico por página', async () => {
    const novo = await api('/perfis', {
      method: 'POST',
      body: {
        nome: texto('Recebimento'),
        descricao: null,
        permissoes: {
          'operacao.recebimento': 'editar',
          'operacao.lotes': 'ver',
          'ordens.lotes': null,
          'pagina.inventada': 'editar',
        },
      },
    })
    assert.equal(novo.status, 201)
    assert.deepEqual(novo.body.permissoes, {
      'operacao.lotes': 'ver',
      'operacao.recebimento': 'editar',
    })
    const repetido = await api('/perfis', {
      method: 'POST',
      body: { nome: texto('recebimento'), permissoes: {} },
    })
    assert.equal(repetido.status, 409)
    const nivelInvalido = await api('/perfis', {
      method: 'POST',
      body: { nome: texto('X'), permissoes: { clientes: 'tudo' } },
    })
    assert.equal(nivelInvalido.status, 422)

    const editado = await api(`/perfis/${novo.body.id}`, {
      method: 'PUT',
      body: {
        nome: texto('Recebimento'),
        permissoes: { 'operacao.recebimento': 'ver', clientes: 'ver' },
      },
    })
    const mudancas = editado.body.historico[0].mudancas.map(
      (m: { campo: string; antes: string; depois: string }) => `${m.campo}:${m.antes}>${m.depois}`,
    )
    assert.deepEqual(mudancas.sort(), [
      'pagina:clientes:nenhum>ver',
      'pagina:operacao.lotes:ver>nenhum',
      'pagina:operacao.recebimento:editar>ver',
    ])
  })

  it('usuário só recebe perfil ativo; perfil em uso não é inativado', async () => {
    const perfil = (
      await api('/perfis', { method: 'POST', body: { nome: texto('Temporário'), permissoes: {} } })
    ).body
    const usuario = await api('/usuarios', {
      method: 'POST',
      body: { nome: 'Teste Perfil', email: 'teste.perfil@exemplo.com', perfil: perfil.id },
    })
    assert.equal(usuario.status, 201)
    const inexistente = await api('/usuarios', {
      method: 'POST',
      body: { nome: 'Outro Teste', email: 'outro.perfil@exemplo.com', perfil: 'nao-existe' },
    })
    assert.equal(inexistente.status, 422)

    const emUso = await api(`/perfis/${perfil.id}/transicao`, {
      method: 'POST',
      body: { acao: 'inativar' },
    })
    assert.equal(emUso.status, 409)
    assert.equal(emUso.body.code, 'profile_in_use')

    await api(`/usuarios/${usuario.body.id}/transicao`, {
      method: 'POST',
      body: { acao: 'inativar' },
    })
    const inativo = await api(`/perfis/${perfil.id}/transicao`, {
      method: 'POST',
      body: { acao: 'inativar' },
    })
    assert.equal(inativo.status, 200)
    const comInativo = await api('/usuarios', {
      method: 'POST',
      body: { nome: 'Mais Um', email: 'mais.um@exemplo.com', perfil: perfil.id },
    })
    assert.equal(comInativo.status, 422)
  })
})

describe('auditoria', () => {
  it('junta os históricos de todos os registros, com tipo e nome', async () => {
    const r = await api('/auditoria')
    assert.equal(r.status, 200)
    const tipos = new Set(r.body.map((e: { tipo: string }) => e.tipo))
    assert.ok(tipos.has('perfil'))
    assert.ok(tipos.has('usuario'))
    const perfil = r.body.find(
      (e: { tipo: string; registroRotulo: string }) =>
        e.tipo === 'perfil' && e.registroRotulo === 'Recebimento',
    )
    assert.ok(perfil)
    // Mais recente primeiro.
    const datas = r.body.map((e: { em: string }) => e.em)
    assert.deepEqual([...datas].sort().reverse(), datas)

    const futuro = await api(`/auditoria?desde=${encodeURIComponent('2999-01-01T00:00:00Z')}`)
    assert.deepEqual(futuro.body, [])
  })
})
