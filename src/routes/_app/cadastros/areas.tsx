import { createFileRoute } from '@tanstack/react-router'
import { cadastroSearchSchema } from '@/features/cadastros/cadastro-search'
import { AreasPage } from '@/features/cadastros/paginas'

export const Route = createFileRoute('/_app/cadastros/areas')({
  // ?aberto=novo|<id> abre o painel de cadastro/edição.
  validateSearch: cadastroSearchSchema,
  component: AreasPage,
})
