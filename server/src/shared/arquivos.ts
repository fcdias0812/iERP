import path from 'node:path'

/*
 * Arquivos enviados (documentos do cliente, anexos da OS): extensões aceitas, tamanho máximo e
 * nome seguro. O arquivo em disco usa o id (sem extensão) — nunca é executado nem servido como
 * página; o download é sempre como anexo.
 */

/** Tamanho máximo por arquivo. */
export const MAX_BYTES = 25 * 1024 * 1024

/** Extensões aceitas → tipo do conteúdo no download. */
export const EXTENSOES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
  xml: 'application/xml',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  zip: 'application/zip',
}

export const extensaoDe = (nome: string) => path.extname(nome).slice(1).toLowerCase()

/** Nome original seguro para exibir/baixar (sem pastas nem caracteres de controle). */
export const nomeSeguro = (nome: string) =>
  path
    .basename(nome.replace(/\\/g, '/'))
    // eslint-disable-next-line no-control-regex -- remover caracteres de controle é o objetivo
    .replace(/[\u0000-\u001f\u007f"]/g, '')
    .slice(0, 200) || 'arquivo'
