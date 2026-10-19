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
    case 'cpf_in_use':
      return i18n.t('apiErrors.cpfInUse')
    case 'no_vehicles':
      return i18n.t('apiErrors.noVehicles')
    case 'scope_required':
      return i18n.t('apiErrors.scopeRequired')
    case 'site_code_in_use':
      return i18n.t('apiErrors.siteCodeInUse')
    case 'file_too_large':
      return i18n.t('apiErrors.fileTooLarge')
    case 'file_type_not_allowed':
      return i18n.t('apiErrors.fileTypeNotAllowed')
    case 'geo_unavailable':
      return i18n.t('apiErrors.geoUnavailable')
    case 'cep_not_found':
      return i18n.t('apiErrors.cepNotFound')
    case 'address_not_found':
      return i18n.t('apiErrors.addressNotFound')
    case 'validation':
      return i18n.t('apiErrors.validation', { detail: error.message })
  }
  if (error.status === 404) return i18n.t('apiErrors.notFound')
  if (error.status === 403) return i18n.t('apiErrors.forbidden')
  if (error.status >= 500) return i18n.t('apiErrors.server')
  return i18n.t('apiErrors.unknown')
}
