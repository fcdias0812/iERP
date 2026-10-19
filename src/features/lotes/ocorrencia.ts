import { z } from '@/lib/zod-i18n'
import type { CategoriaOcorrencia, MomentoOcorrencia } from '@/services/types'

/*
 * Ocorrências do lote — mesmas regras do servidor (server/src/modules/ordens/ordens.lote.ts):
 * momento, categoria e texto obrigatórios; até 10 fotos (JPG, PNG, WEBP) de até 25 MB.
 */

export const MOMENTOS: MomentoOcorrencia[] = ['coleta', 'trajeto', 'recebimento']

export const CATEGORIAS: CategoriaOcorrencia[] = [
  'atraso',
  'avaria_carga',
  'divergencia_quantidade',
  'embalagem_inadequada',
  'problema_veiculo',
  'acesso_negado',
  'material_nao_identificado',
  'outro',
]

export const EXTENSOES_FOTO = ['jpg', 'jpeg', 'png', 'webp'] as const
export const MAX_FOTOS = 10
export const MAX_BYTES_FOTO = 25 * 1024 * 1024
export const MAX_TEXTO = 2000

export const ocorrenciaSchema = z.object({
  momento: z.enum(['coleta', 'trajeto', 'recebimento'], { error: 'validation.required' }),
  categoria: z.enum(
    [
      'atraso',
      'avaria_carga',
      'divergencia_quantidade',
      'embalagem_inadequada',
      'problema_veiculo',
      'acesso_negado',
      'material_nao_identificado',
      'outro',
    ],
    { error: 'validation.required' },
  ),
  texto: z.string().trim().min(1, 'validation.required').max(MAX_TEXTO),
})

export type OcorrenciaForm = z.input<typeof ocorrenciaSchema>
