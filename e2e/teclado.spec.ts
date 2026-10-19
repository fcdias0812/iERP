import { expect, test } from '@playwright/test'
import { abrir } from './helpers'

/* Teclado: atalhos, foco visível, modais que prendem o foco e fecham com Esc. */

test('pular para o conteúdo é o primeiro Tab e o foco é visível', async ({ page }) => {
  await abrir(page, '/')
  await page.keyboard.press('Tab')
  const foco = page.locator(':focus')
  await expect(foco).toHaveText(/Pular para o conteúdo/)
  // Foco visível: contorno (outline) ou anel (box-shadow) desenhado.
  const estilo = await foco.evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      outline: s.outlineStyle !== 'none' && s.outlineWidth !== '0px',
      ring: s.boxShadow !== 'none',
    }
  })
  expect(estilo.outline || estilo.ring).toBe(true)
})

test('Ctrl+K abre a busca, encontra usuários pela API e Esc fecha', async ({ page }) => {
  await abrir(page, '/')
  // Clique num texto que não é link (o centro da tela pode cair num card clicável).
  await page.locator('main h1').click()
  await page.keyboard.press('Control+k')
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toBeVisible()
  await page.keyboard.type('USR-0000')
  await expect(dialogo.getByRole('option', { name: /USR-0000/ }).first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialogo).toBeHidden()
})

test('a busca encontra tudo: lotes, caixotes, materiais… e abre o registro', async ({ page }) => {
  await abrir(page, '/')
  await page.locator('main h1').click()
  await page.keyboard.press('Control+k')
  const dialogo = page.getByRole('dialog')
  // Lote (código) → detalhe do lote.
  await page.keyboard.type('LOT-0000')
  await expect(dialogo.getByRole('option', { name: /^Lote LOT-00001/ })).toBeVisible()
  // Caixote pelo código; material no idioma da tela.
  await dialogo.getByRole('combobox').fill('CXT-2026')
  await expect(dialogo.getByRole('option', { name: /^Caixote CXT-20260001 · Cobre/ })).toBeVisible()
  await dialogo.getByRole('combobox').fill('aluminio')
  await expect(dialogo.getByRole('option', { name: /^Material Alumínio/ })).toBeVisible()
  // Perfil de acesso → abre o painel do perfil.
  await dialogo.getByRole('combobox').fill('leitura')
  await dialogo.getByRole('option', { name: /^Perfil de acesso Leitura/ }).click()
  await expect(page).toHaveURL(/\/admin\/perfis\?aberto=leitura/)
  await expect(page.getByRole('dialog')).toContainText('Leitura')
})

test('Ctrl+B recolhe e expande o menu lateral', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await abrir(page, '/')
  const botao = page.getByRole('button', { name: /Recolher menu|Expandir menu/ })
  await expect(botao).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Control+b')
  await expect(botao).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('Control+b')
  await expect(botao).toHaveAttribute('aria-expanded', 'true')
})

test('N na lista abre "Novo usuário"', async ({ page }) => {
  await abrir(page, '/admin/usuarios')
  await page.locator('main h1').click()
  await page.keyboard.press('n')
  await expect(page).toHaveURL(/\/admin\/usuarios\?aberto=novo/)
  await expect(page.getByRole('dialog', { name: /Novo usuário/ })).toBeVisible()
})

test('diálogo de confirmação prende o foco e fecha com Esc', async ({ page }) => {
  await abrir(page, '/admin/usuarios/usr00001')
  await page.getByRole('button', { name: 'Inativar' }).click()
  const dialogo = page.getByRole('alertdialog')
  await expect(dialogo).toBeVisible()
  // Tab várias vezes: o foco não sai do diálogo.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab')
    expect(await dialogo.evaluate((d) => d.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialogo).toBeHidden()
})

test('Ctrl+S salva o formulário do usuário', async ({ page }) => {
  await abrir(page, '/admin/usuarios/usr00001?editar=true')
  const campo = page.getByRole('dialog').getByLabel(/^Nome/)
  await campo.fill('Fulano de Teste')
  await campo.blur()
  await page.keyboard.press('Control+s')
  await expect(page.getByText('Alterações de Fulano de Teste salvas.')).toBeVisible()
})

test('abas e menus têm os papéis ARIA certos', async ({ page }) => {
  await abrir(page, '/admin/usuarios/usr00001')
  await expect(page.getByRole('tablist')).toBeVisible()
  const abas = page.getByRole('tab')
  expect(await abas.count()).toBeGreaterThanOrEqual(2)
  await abas.first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(abas.nth(1)).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: /Menu do usuário/ }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toBeHidden()
})

test('cliente: adicionar contato, tornar principal e salvar com Ctrl+S', async ({ page }) => {
  await abrir(page, '/clientes/cli00001?editar=true')
  const painel = page.getByRole('dialog')
  await painel.getByRole('button', { name: 'Adicionar contato' }).click()
  const lista = painel.getByRole('list', { name: 'Contatos' })
  const ultimo = lista.getByRole('listitem').last()
  await ultimo.getByLabel(/^E-mail/).fill('novo.contato@exemplo.com.br')
  await ultimo.getByLabel(/^Telefone/).fill('11987650000')
  await ultimo.getByRole('button', { name: /Tornar principal/ }).click()
  await expect(lista.getByRole('listitem').first()).toContainText('Principal')
  await page.keyboard.press('Control+s')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/clientes\/cli00001$/)
  await expect(page.getByText('novo.contato@exemplo.com.br').first()).toBeVisible()
})

// Regressão: parar o mouse sobre o link (pré-carregamento da rota) e clicar travava a página
// num laço de render da DataTable enquanto a lista ainda não tinha chegado da API.
test('menu: mouse parado sobre Clientes e clique não travam a página', async ({ page }) => {
  await abrir(page, '/')
  const link = page.locator('aside a[href="/clientes"]').first()
  await link.hover()
  await page.waitForTimeout(800)
  await link.click({ timeout: 5000 })
  await expect(page.locator('main h1')).toHaveText('Clientes')
  await expect(page.locator('main tbody tr').first()).toBeVisible()
})
