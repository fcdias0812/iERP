import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import { criarApp } from './app.js'
import { criarDb, type Db } from './db/database.js'
import { migrarParaUltima } from './db/migrate.js'

/* Produção: as telas compiladas saem do mesmo servidor da API (SITE_DIR). */

let db: Db
let base: string
let pasta: string
let fechar: () => void

before(async () => {
  pasta = mkdtempSync(path.join(tmpdir(), 'ierp-telas-'))
  mkdirSync(path.join(pasta, 'assets'))
  writeFileSync(path.join(pasta, 'index.html'), '<!doctype html><title>iERP</title>')
  writeFileSync(path.join(pasta, 'version.json'), '{"build":"b1"}')
  writeFileSync(path.join(pasta, 'assets', 'app-abc123.js'), 'console.log(1)')
  db = criarDb(':memory:')
  await migrarParaUltima(db)
  const servidor = criarApp(db, { siteDir: pasta }).listen(0)
  await new Promise((ok) => servidor.once('listening', ok))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}`
  fechar = () => servidor.close()
})

after(async () => {
  fechar()
  await db.destroy()
  rmSync(pasta, { recursive: true, force: true })
})

describe('telas compiladas (SITE_DIR)', () => {
  it('rota da tela devolve o index.html, sem guardar', async () => {
    for (const rota of ['/', '/clientes/123', '/rastreio/abc']) {
      const res = await fetch(base + rota)
      assert.equal(res.status, 200, rota)
      assert.match(await res.text(), /<title>iERP<\/title>/)
      assert.equal(res.headers.get('cache-control'), 'no-cache')
    }
  })

  it('version.json nunca fica guardado; assets com hash ficam por 1 ano', async () => {
    const versao = await fetch(`${base}/version.json`)
    assert.deepEqual(await versao.json(), { build: 'b1' })
    assert.equal(versao.headers.get('cache-control'), 'no-cache')
    const js = await fetch(`${base}/assets/app-abc123.js`)
    assert.equal(js.status, 200)
    assert.match(js.headers.get('cache-control') ?? '', /immutable/)
  })

  it('arquivo que não existe é 404 (não a tela)', async () => {
    assert.equal((await fetch(`${base}/assets/velho.js`)).status, 404)
  })

  it('a API continua respondendo JSON, inclusive rota inexistente', async () => {
    const saude = await fetch(`${base}/api/health`)
    assert.deepEqual(await saude.json(), { ok: true, success: true })
    const nada = await fetch(`${base}/api/nao-existe`)
    assert.equal(nada.status, 404)
    assert.match(nada.headers.get('content-type') ?? '', /json/)
  })
})
