import { describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { translateError, z } from './zod-i18n'

const firstMessage = (schema: z.ZodType, value: unknown) => {
  const r = schema.safeParse(value)
  return r.success ? undefined : translateError(r.error.issues[0]?.message)
}

describe('mensagens do Zod traduzidas', () => {
  it('obrigatório, tamanho mínimo e e-mail (pt-BR)', async () => {
    await i18n.changeLanguage('pt-BR')
    expect(firstMessage(z.string().trim().min(3), '')).toBe('Campo obrigatório.')
    expect(firstMessage(z.string().min(3), 'ab')).toBe('Use pelo menos 3 caracteres.')
    expect(firstMessage(z.email(), 'x@')).toBe('Informe um e-mail válido.')
    expect(firstMessage(z.email(), '')).toBe('Campo obrigatório.')
    expect(firstMessage(z.number(), undefined)).toBe('Campo obrigatório.')
  })

  it('regra própria com chave e troca de idioma', async () => {
    const cpf = z.string().refine(() => false, 'validation.cpf')
    await i18n.changeLanguage('en')
    expect(firstMessage(cpf, '1')).toBe('Invalid CPF.')
    await i18n.changeLanguage('pt-BR')
    expect(firstMessage(cpf, '1')).toBe('CPF inválido.')
  })

  it('texto livre passa direto', () => {
    expect(translateError('Mensagem pronta')).toBe('Mensagem pronta')
  })
})
