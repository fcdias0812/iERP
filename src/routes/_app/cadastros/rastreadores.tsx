import { createFileRoute } from '@tanstack/react-router'
import { cadastroSearchSchema } from '@/features/cadastros/cadastro-search'
import { RastreadoresPage } from '@/features/cadastros/paginas'

export const Route = createFileRoute('/_app/cadastros/rastreadores')({
  // ?aberto=novo|<id> abre o painel de cadastro/edição.
  validateSearch: cadastroSearchSchema,
  component: RastreadoresPage,
})
