import { createFileRoute } from '@tanstack/react-router'
import { loteSearchSchema } from '@/features/lotes/lote-search'
import { LoteOrdensPage } from '@/features/lotes/rotas'

export const Route = createFileRoute('/_app/ordens/lotes/$id')({
  // ?aba=ocorrencias abre direto numa aba; ?ocorrencia=nova|<id> abre o painel da ocorrência.
  validateSearch: loteSearchSchema,
  component: LoteOrdensPage,
})
