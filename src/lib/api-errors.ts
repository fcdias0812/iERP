import i18n from '@/i18n'
import { ApiError } from '@/services/http'

/**
 * Mensagem amigável (no idioma atual) para um erro da API. Códigos conhecidos
 * têm texto próprio; os demais usam o status HTTP.
 */
export function apiErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return i18n.t('apiErrors.unknown')
  switch (error.code) {
    case 'network':
      return i18n.t('apiErrors.network')
    case 'invalid_transition':
      return i18n.t('apiErrors.invalidTransition')
    case 'email_in_use':
      return i18n.t('apiErrors.emailInUse')
    case 'cnpj_in_use':
      return i18n.t('apiErrors.cnpjInUse')
    case 'validation':
      return i18n.t('apiErrors.validation', { detail: error.message })
  }
  if (error.status === 404) return i18n.t('apiErrors.notFound')
  if (error.status === 403) return i18n.t('apiErrors.forbidden')
  if (error.status >= 500) return i18n.t('apiErrors.server')
  return i18n.t('apiErrors.unknown')
}
