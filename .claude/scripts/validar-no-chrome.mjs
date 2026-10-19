// Abre telas do iERP no Google Chrome instalado (via Playwright), tira prints e lista erros.
//
// Uso (com os servidores `api` e `web` rodando):
//   node .claude/scripts/validar-no-chrome.mjs                     # rotas padrão
//   node .claude/scripts/validar-no-chrome.mjs ordens/lotes clientes  # rotas sem a barra inicial
//                                                                  # (o Git Bash converte "/rota")
// Variáveis: BASE (padrão http://localhost:5173), CHROME (caminho do chrome.exe; sem ele, usa o
// Chromium do Playwright). Prints em .claude/scripts/prints/ (fora do git).
//
// Para validar um FLUXO (preencher e salvar), copie este arquivo e escreva os passos com
// page.getByRole / getByLabel — como nos testes de e2e/. Lembre de apagar do banco de
// desenvolvimento o que o fluxo criar (veja FLUXO-DE-TRABALHO.md §4).
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const PRINTS = path.join(aqui, 'prints')
mkdirSync(PRINTS, { recursive: true })

const BASE = process.env.BASE ?? 'http://localhost:5173'
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const rotas = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      '',
      'clientes',
      'transportadoras',
      'veiculos',
      'motoristas',
      'ordens/lotes',
      'ordens/agendamento',
    ]

const browser = await chromium.launch({
  executablePath: existsSync(CHROME) ? CHROME : undefined,
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const erros = []
page.on('console', (m) => m.type() === 'error' && erros.push(`[console] ${m.text().slice(0, 300)}`))
page.on('pageerror', (e) => erros.push(`[pageerror] ${e.message}`))
page.on('response', (r) => {
  if (r.url().includes('/api/') && r.status() >= 400) erros.push(`[http ${r.status()}] ${r.url()}`)
})

for (const rota of rotas) {
  const url = `${BASE}/${rota.replace(/^\/+/, '')}`
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const info = await page.evaluate(() => ({
    h1: document.querySelector('main h1')?.textContent ?? null,
    linhas: document.querySelectorAll('main tbody tr').length,
  }))
  const arquivo = path.join(PRINTS, `${(rota || 'inicio').replace(/[^\w-]+/g, '_')}.png`)
  await page.screenshot({ path: arquivo, fullPage: true })
  console.log(`${url} → h1="${info.h1}" linhas=${info.linhas} print=${arquivo}`)
}

console.log(erros.length ? erros.join('\n') : 'Sem erros no console nem respostas HTTP >= 400.')
await browser.close()
