import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import { criarApp } from '../app.js'
import { criarDb, type Db } from '../db/database.js'
import { migrarParaUltima } from '../db/migrate.js'
import { semear } from '../db/seed.js'

/* Relacionamento: Transportadoras, Motoristas e Veículos — HTTP real + SQLite em memória. */

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

// Documentos válidos (numéricos).
const CNPJ = '11.444.777/0001-61'
const CPF_1 = '529.982.247-25'
const CPF_2 = '111.444.777-35'

describe('transportadoras', () => {
  it('lista com contato principal e quantidade de motoristas', async () => {
    const { body } = await api(`/transportadoras${qs({ ps: '50' })}`)
    assert.equal(body.total, 3)
    const translog = body.rows.find((r: { nome: string }) => r.nome.startsWith('TransLog'))
    assert.equal(translog.contatoEmail, 'operacoes@translog.exemplo.com.br')
    assert.equal(translog.motoristas, 2)
    const semContato = body.rows.find((r: { nome: string }) => r.nome.startsWith('Carga Certa'))
    assert.equal(semContato.contatoEmail, null)
  })

  it('cria sem contatos e com motorista NOVO (que entra em Motoristas)', async () => {
    const r = await api('/transportadoras', {
      method: 'POST',
      body: {
        nome: 'Nova Rota Ltda',
        cnpj: CNPJ,
        contatos: [],
        motoristas: [
          { novo: { nome: 'Edson Alves Ramos', cpf: CPF_1, telefone: '(11) 98888-1111' } },
        ],
      },
    })
    assert.equal(r.status, 201)
    assert.equal(r.body.codigo, 'TRA-00004')
    assert.equal(r.body.motoristas.length, 1)
    assert.equal(r.body.motoristas[0].cpf, '52998224725')
    const m = await api(`/motoristas${qs({ q: 'edson' })}`)
    assert.equal(m.body.rows[0].transportadoraNome, 'Nova Rota Ltda')
  })

  it('CNPJ repetido dá 409; dois principais dá 422', async () => {
    const repetido = await api('/transportadoras', {
      method: 'POST',
      body: { nome: 'Outra', cnpj: '11444777000161', contatos: [] },
    })
    assert.equal(repetido.status, 409)
    assert.equal(repetido.body.code, 'cnpj_in_use')
    const principais = await api('/transportadoras', {
      method: 'POST',
      body: {
        nome: 'Outra',
        cnpj: '12ABC34501DE35',
        contatos: [
          { email: 'a@b.com.br', telefone: '11987654321', principal: true },
          { email: 'c@d.com.br', telefone: '11987654322', principal: true },
        ],
      },
    })
    assert.equal(principais.status, 422)
  })

  it('vincular motorista de outra transportadora move o vínculo; tirar da lista desvincula', async () => {
    const lista = (await api(`/transportadoras${qs({ q: 'rapido sul' })}`)).body.rows
    const rapido = (await api(`/transportadoras/${lista[0].id}`)).body
    const translog = (
      await api(
        `/transportadoras/${(await api(`/transportadoras${qs({ q: 'translog' })}`)).body.rows[0].id}`,
      )
    ).body
    const bruna = translog.motoristas.find((m: { nome: string }) => m.nome.startsWith('Bruna'))

    const editado = await api(`/transportadoras/${rapido.id}`, {
      method: 'PUT',
      body: {
        nome: rapido.nome,
        cnpj: rapido.cnpj,
        contatos: rapido.contatos,
        // Mantém o Antônio e traz a Bruna da TransLog.
        motoristas: [
          ...rapido.motoristas.map((m: { id: string }) => ({ id: m.id })),
          { id: bruna.id },
        ],
      },
    })
    assert.equal(editado.status, 200)
    assert.equal(editado.body.motoristas.length, 2)
    assert.equal(editado.body.historico[0].mudancas.at(-1).campo, 'motoristas')

    const brunaDepois = (await api(`/motoristas/${bruna.id}`)).body
    assert.equal(brunaDepois.transportadoraNome, rapido.nome)
    assert.equal(brunaDepois.historico[0].mudancas[0].campo, 'transportadora')

    // Tira todos: ficam sem transportadora.
    await api(`/transportadoras/${rapido.id}`, {
      method: 'PUT',
      body: { nome: rapido.nome, cnpj: rapido.cnpj, contatos: rapido.contatos, motoristas: [] },
    })
    assert.equal((await api(`/motoristas/${bruna.id}`)).body.transportadoraId, null)
  })

  it('inativa e reativa', async () => {
    const [t] = (await api(`/transportadoras${qs({ q: 'carga certa' })}`)).body.rows
    const r = await api(`/transportadoras/${t.id}/transicao`, {
      method: 'POST',
      body: { acao: 'inativar' },
    })
    assert.equal(r.body.status, 'inativo')
    assert.equal(
      (
        await api(`/transportadoras/${t.id}/transicao`, {
          method: 'POST',
          body: { acao: 'inativar' },
        })
      ).status,
      409,
    )
  })
})

describe('motoristas', () => {
  it('cria com transportadora NOVA (que entra em Transportadoras)', async () => {
    const r = await api('/motoristas', {
      method: 'POST',
      body: {
        nome: 'Fernanda Costa Melo',
        cpf: CPF_2,
        telefone: '21987654321',
        novaTransportadora: { nome: 'Transportes Litoral Ltda', cnpj: '12.ABC.345/01DE-35' },
      },
    })
    assert.equal(r.status, 201)
    assert.equal(r.body.transportadoraNome, 'Transportes Litoral Ltda')
    const t = await api(`/transportadoras${qs({ q: 'litoral' })}`)
    assert.equal(t.body.rows[0].motoristas, 1)
  })

  it('sem transportadora é permitido; CPF inválido 422; CPF repetido 409', async () => {
    const sem = await api('/motoristas', {
      method: 'POST',
      body: { nome: 'Gustavo Henrique Dias', cpf: '39053344705', telefone: '11912345678' },
    })
    assert.equal(sem.status, 201)
    assert.equal(sem.body.transportadoraId, null)
    assert.equal(
      (
        await api('/motoristas', {
          method: 'POST',
          body: { nome: 'Fulano de Tal', cpf: '12345678900', telefone: '11912345678' },
        })
      ).status,
      422,
    )
    const repetido = await api('/motoristas', {
      method: 'POST',
      body: { nome: 'Outro Nome Qualquer', cpf: '390.533.447-05', telefone: '11912345678' },
    })
    assert.equal(repetido.status, 409)
    assert.equal(repetido.body.code, 'cpf_in_use')
  })

  it('edita a transportadora com antes → depois no histórico; resumo conta sem vínculo', async () => {
    const [m] = (await api(`/motoristas${qs({ q: 'daniela' })}`)).body.rows
    const [t] = (await api(`/transportadoras${qs({ q: 'translog' })}`)).body.rows
    const r = await api(`/motoristas/${m.id}`, {
      method: 'PUT',
      body: { nome: m.nome, cpf: m.cpf, telefone: m.telefone, transportadoraId: t.id },
    })
    assert.equal(r.body.transportadoraNome, t.nome)
    assert.deepEqual(r.body.historico[0].mudancas, [
      { campo: 'transportadora', antes: null, depois: t.nome },
    ])
    const resumo = (await api('/motoristas/resumo')).body
    assert.equal(typeof resumo.semTransportadora, 'number')
  })
})

describe('veiculos', () => {
  it('lista, cria (código VEI) e valida volume mínimo ≤ máximo', async () => {
    const lista = await api(`/veiculos${qs({ f: { tipo: ['truck'] } })}`)
    assert.equal(lista.body.total, 1)
    const r = await api('/veiculos', {
      method: 'POST',
      body: {
        tipo: 'van',
        volumeMinimo: 3,
        volumeMaximo: 6,
        comprimento: 3,
        largura: 1.6,
        capacidadePallets: 3,
        capacidadeToneladas: 1.2,
      },
    })
    assert.equal(r.status, 201)
    assert.equal(r.body.codigo, 'VEI-00004')
    const invalido = await api('/veiculos', {
      method: 'POST',
      body: { tipo: 'van', volumeMinimo: 9, volumeMaximo: 2 },
    })
    assert.equal(invalido.status, 422)
    const tipo = await api('/veiculos', { method: 'POST', body: { tipo: 'outro' } })
    assert.equal(tipo.status, 422)
    const pallets = await api('/veiculos', {
      method: 'POST',
      body: { tipo: 'van', capacidadePallets: 2.5 },
    })
    assert.equal(pallets.status, 422)
  })

  it('edita com histórico e inativa', async () => {
    const [v] = (await api(`/veiculos${qs({ f: { tipo: ['carreta'] } })}`)).body.rows
    const r = await api(`/veiculos/${v.id}`, {
      method: 'PUT',
      body: { ...v, capacidadePallets: 30 },
    })
    assert.deepEqual(r.body.historico[0].mudancas, [
      { campo: 'capacidadePallets', antes: 28, depois: 30 },
    ])
    const i = await api(`/veiculos/${v.id}/transicao`, {
      method: 'POST',
      body: { acao: 'inativar' },
    })
    assert.equal(i.body.status, 'inativo')
  })
})

describe('busca global', () => {
  it('encontra transportadoras e motoristas', async () => {
    const r = await api(`/busca${qs({ q: 'translog' })}`)
    assert.ok(r.body.some((x: { tipo: string }) => x.tipo === 'transportadora'))
    const m = await api(`/busca${qs({ q: 'cláudio' })}`)
    assert.ok(
      m.body.some(
        (x: { tipo: string; rota: string }) =>
          x.tipo === 'motorista' && x.rota.startsWith('/motoristas'),
      ),
    )
  })
})
