import { expect, test } from '@playwright/test'
import { abrir, violacoes } from './helpers'

/* Novidades da barra do topo: avisa a versão nova, mostra as atualizações e apaga o aviso. */

test('Novidades: aviso da versão nova, lista das atualizações e o aviso some depois de ver', async ({
  page,
}) => {
  await abrir(page, '/')
  await page.getByRole('button', { name: 'Novidades (versão nova)' }).click()
  const janela = page.getByRole('dialog', { name: 'Novidades' })
  await expect(janela.getByRole('heading', { name: /Versão 2\.4/ })).toBeVisible()
  await expect(janela.getByRole('heading', { name: /Versão 2\.0/ })).toBeVisible()
  await expect(janela).toContainText('Vários caminhões no mesmo lote')
  expect(await violacoes(page)).toEqual([])
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Novidades', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Novidades (versão nova)' })).toHaveCount(0)
})

test('versão nova publicada: pop-up para reiniciar; quem continua vê o "?" em Novidades', async ({
  page,
}) => {
  // O servidor passa a responder um build diferente do desta página (API simulada).
  await page.addInitScript(() => sessionStorage.setItem('ierp-mock-build', 'versao-nova-teste'))
  await abrir(page, '/')
  const aviso = page.getByRole('alertdialog', { name: 'Há atualizações para aplicar' })
  await expect(aviso).toContainText('salve o que estiver fazendo')
  expect(await violacoes(page)).toEqual([])
  await aviso.getByRole('button', { name: 'Continuar o que estou fazendo' }).click()
  await expect(aviso).toHaveCount(0)

  const botao = page.getByRole('button', { name: /há uma versão nova, reinicie/ })
  await botao.click()
  const janela = page.getByRole('dialog', { name: 'Novidades' })
  await expect(janela).toContainText('Reinicie para ver as mudanças')
  await janela.getByRole('button', { name: 'Reiniciar agora' }).click()
  // Recarregou (e, como o servidor ainda responde outro build, o aviso volta).
  await expect(
    page.getByRole('alertdialog', { name: 'Há atualizações para aplicar' }),
  ).toBeVisible()
})
