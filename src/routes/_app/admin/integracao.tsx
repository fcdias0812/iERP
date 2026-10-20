import { createFileRoute } from '@tanstack/react-router'
import { IntegracaoPage } from '@/features/admin/integracao/IntegracaoPage'
import { cadastroSearchSchema } from '@/features/cadastros/cadastro-search'

export const Route = createFileRoute('/_app/admin/integracao')({
  // ?aberto=novo|<id> abre o painel de cadastro/edição.
  validateSearch: cadastroSearchSchema,
  component: IntegracaoPage,
})
