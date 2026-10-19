import { createFileRoute } from '@tanstack/react-router'
import { cadastroSearchSchema } from '@/features/cadastros/cadastro-search'
import { CaixotesPage } from '@/features/cadastros/paginas'

export const Route = createFileRoute('/_app/cadastros/caixotes')({
  // ?aberto=novo|<id> abre o painel de cadastro/edição.
  validateSearch: cadastroSearchSchema,
  component: CaixotesPage,
})
