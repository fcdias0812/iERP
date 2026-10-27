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
    case 'lot_merged':
      return i18n.t('apiErrors.lotMerged')
    case 'document_type_not_accepted':
      return i18n.t('apiErrors.documentTypeNotAccepted')
    case 'report_not_received':
      return i18n.t('apiErrors.reportNotReceived')
    case 'report_missing_documents':
      return i18n.t('apiErrors.reportMissingDocuments')
    case 'tracker_in_use':
      return i18n.t('apiErrors.trackerInUse')
    case 'tracker_inactive':
      return i18n.t('apiErrors.trackerInactive')
    case 'client_blocked':
      return i18n.t('apiErrors.clientBlocked')
    case 'tracking_by_client':
      return i18n.t('apiErrors.trackingByClient')
    case 'driver_plate_required':
      return i18n.t('apiErrors.driverPlateRequired')
    case 'scope_spreadsheet_required':
      return i18n.t('apiErrors.scopeSpreadsheetRequired')
    case 'seal_required':
      return i18n.t('apiErrors.sealRequired')
    case 'invoice_required':
      return i18n.t('apiErrors.invoiceRequired')
    case 'tare_required':
      return i18n.t('apiErrors.tareRequired')
    case 'photos_required':
      return i18n.t('apiErrors.photosRequired')
    case 'name_in_use':
      return i18n.t('apiErrors.nameInUse')
    case 'fixed_profile':
      return i18n.t('apiErrors.fixedProfile')
    case 'profile_in_use':
      return i18n.t('apiErrors.profileInUse')
    case 'system_in_use':
      return i18n.t('apiErrors.systemInUse')
    case 'external_lot':
      return i18n.t('apiErrors.externalLot')
    case 'external_unavailable':
      return i18n.t('apiErrors.externalUnavailable')
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
    case 'tracker_not_configured':
      return i18n.t('apiErrors.trackerNotConfigured')
    case 'tracker_unavailable':
      return i18n.t('apiErrors.trackerUnavailable')
    case 'tracker_unauthorized':
      return i18n.t('apiErrors.trackerUnauthorized')
    case 'tracker_error':
      return i18n.t('apiErrors.trackerError')
    case 'tracker_not_found':
      return i18n.t('apiErrors.trackerNotFound')
    case 'trip_in_progress':
      return i18n.t('apiErrors.tripInProgress')
    case 'trip_read_only':
      return i18n.t('apiErrors.tripReadOnly')
    case 'trip_not_active':
      return i18n.t('apiErrors.tripNotActive')
    case 'no_emergency':
      return i18n.t('apiErrors.noEmergency')
    case 'map_unavailable':
      return i18n.t('apiErrors.mapUnavailable')
    case 'validation':
      return i18n.t('apiErrors.validation', { detail: error.message })
  }
  if (error.status === 404) return i18n.t('apiErrors.notFound')
  if (error.status === 403) return i18n.t('apiErrors.forbidden')
  if (error.status >= 500) return i18n.t('apiErrors.server')
  return i18n.t('apiErrors.unknown')
}
