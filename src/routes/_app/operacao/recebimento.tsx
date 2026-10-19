import { createFileRoute } from '@tanstack/react-router'
import { recebimentoSearchSchema } from '@/features/lotes/recebimento-search'
import { RecebimentoPage } from '@/features/lotes/rotas'

export const Route = createFileRoute('/_app/operacao/recebimento')({
  // ?visao=recebidos troca a lista; ?aberto=novo|<id> abre o painel de recebimento.
  validateSearch: recebimentoSearchSchema,
  component: RecebimentoPage,
})
