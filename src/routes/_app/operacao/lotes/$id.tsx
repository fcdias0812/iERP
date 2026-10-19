import { createFileRoute } from '@tanstack/react-router'
import { loteSearchSchema } from '@/features/lotes/lote-search'
import { LoteOperacaoPage } from '@/features/lotes/rotas'

export const Route = createFileRoute('/_app/operacao/lotes/$id')({
  // ?aba=ocorrencias abre direto numa aba; ?ocorrencia=nova|<id> abre o painel da ocorrência.
  validateSearch: loteSearchSchema,
  component: LoteOperacaoPage,
})
