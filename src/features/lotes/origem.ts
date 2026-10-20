import type { StatusOrdem } from '@/services/types'

/*
 * Arquivo leve de propósito: as rotas importam daqui para validar a URL (o que a rota usa fora
 * do componente vai para o pacote principal).
 */

/** Módulo de onde o lote foi aberto: o mesmo lote aparece em Ordens › Lotes e Operação › Lotes. */
export type OrigemLote = 'ordens' | 'operacao'

/** Etapas do lote, na ordem do fluxo (= server/src/modules/ordens/ordens.ts). */
export const ETAPAS_LOTE: StatusOrdem[] = [
  'agendado',
  'inspecao',
  'processo',
  'aguardando_cod',
  'concluido',
]

/** Todos os status do lote: as etapas e, fora do fluxo, cancelado (lote de outro sistema). */
export const STATUS_LOTE: StatusOrdem[] = [...ETAPAS_LOTE, 'cancelado']

/** Abas do detalhe do lote (`?aba=` na URL). */
export const ABAS_LOTE = [
  'informacoes',
  'progresso',
  'ocorrencias',
  'documentos',
  'historico',
] as const
export type AbaLote = (typeof ABAS_LOTE)[number]
