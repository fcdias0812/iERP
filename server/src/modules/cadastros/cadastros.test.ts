import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import { criarApp } from '../../app.js'
import { criarDb, type Db } from '../../db/database.js'
import { migrarParaUltima } from '../../db/migrate.js'

/* Sistema › Cadastros — HTTP real + SQLite em memória. */

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

const texto = (pt: string) => ({
  origem: 'pt-BR',
  textos: { 'pt-BR': pt, en: `${pt} (en)`, 'zh-TW': `${pt} (zh)` },
  automaticos: ['en', 'zh-TW'],
})

before(async () => {
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  const servidor = criarApp(db).listen(0)
  await new Promise((ok) => servidor.once('listening', ok))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}/api`
  fechar = () => servidor.close()
})

after(async () => {
  fechar()
  await db.destroy()
})

describe('cadastros › materiais', () => {
  it('nasce com a lista inicial de 96 materiais nos 3 idiomas', async () => {
    const r = await api('/materiais')
    assert.equal(r.status, 200)
    assert.equal(r.body.length, 96)
    const cobre = r.body.find(
      (m: { nome: { textos: Record<string, string> } }) => m.nome.textos['pt-BR'] === 'Cobre',
    )
    assert.equal(cobre.nome.textos.en, 'Copper')
    assert.equal(cobre.nome.textos['zh-TW'], '銅')
    assert.equal(cobre.status, 'ativo')
  })

  it('cria, recusa nome repetido, edita, inativa — com histórico', async () => {
    const novo = await api('/materiais', { method: 'POST', body: { nome: texto('Ouro') } })
    assert.equal(novo.status, 201)
    const repetido = await api('/materiais', { method: 'POST', body: { nome: texto('ouro') } })
    assert.equal(repetido.status, 409)
    assert.equal(repetido.body.code, 'name_in_use')
    const ja = await api('/materiais', { method: 'POST', body: { nome: texto('Cobre') } })
    assert.equal(ja.status, 409)

    const editado = await api(`/materiais/${novo.body.id}`, {
      method: 'PUT',
      body: { nome: texto('Ouro 18k') },
    })
    assert.equal(editado.body.nome.textos['pt-BR'], 'Ouro 18k')
    assert.equal(editado.body.historico[0].acao, 'editado')

    const inativo = await api(`/materiais/${novo.body.id}/transicao`, {
      method: 'POST',
      body: { acao: 'inativar' },
    })
    assert.equal(inativo.body.status, 'inativo')
    assert.deepEqual(inativo.body.acoesPermitidas, ['reativar'])
  })
})

describe('cadastros › áreas e recipientes', () => {
  it('área com descrição opcional; nome único', async () => {
    const a = await api('/areas', { method: 'POST', body: { nome: 'DELL', descricao: null } })
    assert.equal(a.status, 201)
    assert.equal(a.body.descricao, null)
    const repetida = await api('/areas', { method: 'POST', body: { nome: 'dell' } })
    assert.equal(repetida.status, 409)
    const semNome = await api('/areas', { method: 'POST', body: { nome: ' ' } })
    assert.equal(semNome.status, 422)
  })

  it('caixote e pallet: código por tipo e ano, material e área ativos, histórico', async () => {
    const materiais = (await api('/materiais')).body
    const cobre = materiais.find(
      (m: { nome: { textos: Record<string, string> } }) => m.nome.textos['pt-BR'] === 'Cobre',
    )
    const area = (
      await api('/areas', {
        method: 'POST',
        body: { nome: 'SHREDDING', descricao: texto('Área de trituração.') },
      })
    ).body
    const ano = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
    }).format(new Date())
    const corpo = (tipo: string, extra: Record<string, unknown> = {}) => ({
      tipo,
      materialId: cobre.id,
      taraKg: 13,
      areaId: area.id,
      posicao: 'A-01',
      ...extra,
    })

    const c1 = await api('/recipientes', { method: 'POST', body: corpo('caixote') })
    assert.equal(c1.status, 201)
    assert.equal(c1.body.codigo, `CXT-${ano}0001`)
    assert.equal(c1.body.materialNome.textos.en, 'Copper')
    assert.equal(c1.body.areaNome, 'SHREDDING')
    const c2 = await api('/recipientes', { method: 'POST', body: corpo('caixote') })
    assert.equal(c2.body.codigo, `CXT-${ano}0002`)
    const p1 = await api('/recipientes', { method: 'POST', body: corpo('pallet') })
    assert.equal(p1.body.codigo, `PLT-${ano}0001`)

    // Lista por tipo; contagem no material e na área.
    assert.equal((await api('/recipientes?tipo=caixote')).body.length, 2)
    assert.equal((await api('/recipientes?tipo=pallet')).body.length, 1)
    const areaDepois = (await api(`/areas/${area.id}`)).body
    assert.equal(areaDepois.recipientes, 3)

    // Edição registra antes → depois.
    const editado = await api(`/recipientes/${c1.body.id}`, {
      method: 'PUT',
      body: corpo('caixote', { posicao: 'B-02', taraKg: 14.5 }),
    })
    const campos = editado.body.historico[0].mudancas.map((m: { campo: string }) => m.campo)
    assert.deepEqual(campos, ['posicao', 'taraKg'])
    const outroTipo = await api(`/recipientes/${c1.body.id}`, {
      method: 'PUT',
      body: corpo('pallet'),
    })
    assert.equal(outroTipo.status, 422)

    // Material inativo não pode ir para um recipiente novo.
    await api(`/materiais/${cobre.id}/transicao`, { method: 'POST', body: { acao: 'inativar' } })
    const comInativo = await api('/recipientes', { method: 'POST', body: corpo('caixote') })
    assert.equal(comInativo.status, 422)
    const semTara = await api('/recipientes', {
      method: 'POST',
      body: corpo('caixote', { taraKg: undefined }),
    })
    assert.equal(semTara.status, 422)
  })
})
