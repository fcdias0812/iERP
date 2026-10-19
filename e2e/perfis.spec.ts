import { expect, test, type Page } from '@playwright/test'
import { abrir, violacoes } from './helpers'
import { irSemRecarregar, traducaoSimulada } from './lotes-helpers'

/*
 * Administração › Perfis de acesso e Auditoria (API simulada: Administrador fixo, Operação e
 * Leitura). Perfil novo com nível por página, troca de perfil no menu do usuário (o menu lateral
 * passa a mostrar só as páginas do perfil) e o evento na Auditoria.
 */

/** Nível de uma página no painel do perfil (linha da matriz pelo nome da página). */
async function nivel(page: Page, pagina: string, rotulo: 'Sem acesso' | 'Visualizar' | 'Editar') {
  await page
    .getByRole('dialog')
    .getByRole('radiogroup', { name: pagina, exact: true })
    .getByRole('radio', { name: rotulo })
    .click()
}

test('perfil novo por página; trocar de perfil esconde o que ele não acessa', async ({ page }) => {
  await traducaoSimulada(page)
  await abrir(page, '/admin/perfis')
  await expect(page.locator('main tbody')).toContainText('Administrador')
  await expect(page.locator('main tbody tr', { hasText: 'Administrador' })).toContainText('Fixo')

  await page.getByRole('button', { name: 'Novo perfil' }).click()
  const painel = page.getByRole('dialog')
  await painel.getByLabel(/^Nome/).fill('Recebimento')
  await nivel(page, 'Operação Recebimento', 'Editar')
  await nivel(page, 'Operação Lotes', 'Visualizar')
  await expect(painel).toContainText('Acesso a 2 de 27 páginas · edita 1.')
  expect(await violacoes(page)).toEqual([])
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Perfil Recebimento cadastrado.')).toBeVisible()
  await expect(page.locator('main tbody tr', { hasText: 'Recebimento' })).toContainText('2 de 27')

  // O perfil novo já aparece na escolha do perfil do usuário.
  await irSemRecarregar(page, '/admin/usuarios?aberto=novo')
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: /^Perfil/ })
    .click()
  await expect(page.getByRole('option', { name: 'Recebimento' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()

  // Demonstração: trocar o perfil da sessão no menu do usuário.
  await page.getByRole('button', { name: /Menu do usuário/ }).click()
  await page.getByRole('menuitem', { name: /Perfil de acesso/ }).click()
  await page.getByRole('menuitemradio', { name: 'Recebimento' }).click()
  await page.keyboard.press('Escape')
  const menu = page.locator('aside')
  await expect(menu.getByRole('button', { name: 'Administração' })).toHaveCount(0)
  await expect(menu.getByRole('link', { name: 'Clientes' })).toHaveCount(0)
  await menu.getByRole('button', { name: 'Operação' }).click()
  await expect(menu.getByRole('link', { name: 'Recebimento' })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Lotes' })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Dashboard' })).toHaveCount(0)

  // Página sem acesso: tela 403.
  await irSemRecarregar(page, '/admin/perfis')
  await expect(page.locator('main')).toContainText(/permissão/i)
})

test('Administrador é fixo; perfil em uso não é inativado; Auditoria mostra a mudança', async ({
  page,
}) => {
  await traducaoSimulada(page)
  await abrir(page, '/admin/perfis?aberto=admin')
  const painel = page.getByRole('dialog')
  await expect(painel).toContainText('Perfil fixo')
  await expect(painel.getByRole('button', { name: 'Salvar' })).toHaveCount(0)
  await expect(painel.getByRole('button', { name: 'Inativar' })).toHaveCount(0)
  await expect(
    painel
      .getByRole('radiogroup', { name: 'Relacionamento Clientes', exact: true })
      .getByRole('radio', {
        name: 'Editar',
      }),
  ).toBeChecked()
  await painel.getByRole('button', { name: 'Fechar' }).last().click()

  // Operação: tirar o acesso a Clientes (vira um evento no histórico e na Auditoria).
  await page.locator('main tbody tr', { hasText: 'Operação' }).click()
  await nivel(page, 'Relacionamento Clientes', 'Sem acesso')
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Perfil Operação salvo.')).toBeVisible()

  // Há usuários com o perfil Operação: não dá para inativar.
  await page.locator('main tbody tr', { hasText: 'Operação' }).click()
  await painel.getByRole('button', { name: 'Inativar' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Inativar' }).click()
  await expect(page.getByText(/Há usuários usando este perfil/)).toBeVisible()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click()
  await painel.getByRole('tab', { name: 'Histórico' }).click()
  await expect(painel.locator('tbody')).toContainText('Relacionamento › Clientes')
  await expect(painel.locator('tbody')).toContainText('Sem acesso')
  await painel.getByRole('button', { name: 'Cancelar' }).click()

  await irSemRecarregar(page, '/admin/auditoria')
  const linha = page.locator('main tbody tr', { hasText: 'Relacionamento › Clientes' })
  await expect(linha).toContainText('Perfil de acesso')
  await expect(linha.getByRole('link', { name: 'Operação' })).toBeVisible()
  // Os lotes também entram na Auditoria.
  await expect(page.locator('main tbody')).toContainText('LOT-00001')
  expect(await violacoes(page)).toEqual([])
})
