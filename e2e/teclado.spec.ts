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
  await expect(page).toHaveURL(/\/admin\/usuarios\/novo/)
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
  await abrir(page, '/admin/usuarios/usr00001/editar')
  const campo = page.getByLabel(/^Nome/)
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
