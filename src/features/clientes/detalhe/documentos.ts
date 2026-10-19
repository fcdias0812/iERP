import type { TipoDocumento } from '@/services/types'

/* Regras de Clientes › Documentos (o servidor confere as mesmas). */

/** Tipos de documento (o servidor confere a mesma lista). */
export const TIPOS_DOCUMENTO: TipoDocumento[] = ['contrato', 'fiscal', 'licenca', 'outro']

/** Extensões aceitas (o servidor confere a mesma lista). */
export const EXTENSOES_DOCUMENTO = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'txt',
  'xml',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'zip',
]

/** Tamanho máximo por arquivo (o servidor confere o mesmo limite). */
export const MAX_BYTES_DOCUMENTO = 25 * 1024 * 1024
