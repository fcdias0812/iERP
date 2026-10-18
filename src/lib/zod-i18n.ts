import { z } from 'zod'
import i18n from '@/i18n'

/*
 * Mensagens de validação do Zod em 3 idiomas.
 *
 * O Zod guarda a mensagem como "chave i18n" (ex.: `validation.required` ou
 * `validation.minLength|{"min":3}`) e a tela traduz na hora de exibir
 * (`translateError`). Assim, trocar o idioma traduz também os erros já exibidos.
 *
 * Em regras próprias, passe a chave: `.refine(isValidCpf, 'validation.cpf')`.
 */

function key(k: string, params?: Record<string, unknown>) {
  return params ? `${k}|${JSON.stringify(params)}` : k
}

z.config({
  customError: (issue) => {
    switch (issue.code) {
      case 'invalid_type':
        if (issue.input === undefined || issue.input === null || issue.input === '')
          return key('validation.required')
        return key('validation.invalidType')
      case 'too_small':
        if (issue.origin === 'string')
          return Number(issue.minimum) <= 1 || issue.input === ''
            ? key('validation.required')
            : key('validation.minLength', { min: Number(issue.minimum) })
        if (issue.origin === 'array')
          return key('validation.minItems', { min: Number(issue.minimum) })
        return key('validation.min', { min: Number(issue.minimum) })
      case 'too_big':
        if (issue.origin === 'string')
          return key('validation.maxLength', { max: Number(issue.maximum) })
        if (issue.origin === 'array')
          return key('validation.maxItems', { max: Number(issue.maximum) })
        return key('validation.max', { max: Number(issue.maximum) })
      case 'invalid_format':
        if (issue.input === '') return key('validation.required')
        if (issue.format === 'email') return key('validation.email')
        return key('validation.invalidFormat')
      default:
        return undefined
    }
  },
})

/** Traduz a mensagem de erro guardada pelo Zod (ou texto livre, que passa direto). */
export function translateError(message: string | undefined): string | undefined {
  if (!message) return undefined
  const [k, json] = message.split('|')
  if (!k?.startsWith('validation.')) return message
  const params = json ? (JSON.parse(json) as Record<string, unknown>) : undefined
  return i18n.t(k as 'validation.required', params ?? {})
}

export { z }
