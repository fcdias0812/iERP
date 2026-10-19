import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { sql } from 'kysely'
import { regiaoDaUf, regiaoDoTexto } from '../../shared/regioes.js'
import { criarDb, type Db } from '../database.js'
import { migrarParaUltima } from '../migrate.js'
import { semear } from '../seed.js'
import { down, up } from './2026-10-19-09-regiao-do-site.js'

/* Região do site: texto livre de antes → código da região (migration 2026-10-19-09). */

let db: Db

before(async () => {
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  await semear(db)
})

after(async () => {
  await db.destroy()
})

describe('região do site', () => {
  it('nome da região ou UF → código', () => {
    assert.equal(regiaoDoTexto('Sudeste'), 'sudeste')
    assert.equal(regiaoDoTexto('Centro-Oeste'), 'centro_oeste')
    assert.equal(regiaoDoTexto('centro oeste'), 'centro_oeste')
    assert.equal(regiaoDoTexto('São Paulo'), null)
    assert.equal(regiaoDaUf('sp'), 'sudeste')
    assert.equal(regiaoDaUf('AM'), 'norte')
    assert.equal(regiaoDaUf('XX'), null)
  })

  it('converte o texto gravado: região, UF do endereço ou vazio — e desfaz', async () => {
    const cru = db.withoutPlugins()
    const { rows } = await sql<{ id: string }>`select id from clientes limit 1`.execute(cru)
    const cliente = rows[0]!.id
    const agora = new Date().toISOString()
    const sites = [
      ['s1', 'Nordeste', null],
      ['s2', 'São Paulo', 'Praça da Sé, Sé, São Paulo – SP'],
      ['s3', 'Qualquer', 'Rua sem UF'],
    ] as const
    for (const [id, regiao, endereco] of sites)
      await sql`insert into clientes_sites (id, cliente_id, codigo, regiao, endereco, criado_em,
        criado_por, alterado_em, alterado_por)
        values (${id}, ${cliente}, ${id}, ${regiao}, ${endereco}, ${agora}, 'teste', ${agora}, 'teste')`.execute(
        cru,
      )

    await up(cru as never)
    const lerRegioes = async () =>
      (
        await sql<{ id: string; regiao: string | null }>`select id, regiao from clientes_sites
          where id in ('s1', 's2', 's3') order by id`.execute(cru)
      ).rows.map((r) => r.regiao)
    assert.deepEqual(await lerRegioes(), ['nordeste', 'sudeste', null])

    await down(cru as never)
    assert.deepEqual(await lerRegioes(), ['Nordeste', 'Sudeste', null])
  })
})
