import { createFileRoute } from '@tanstack/react-router'
import { cadastroSearchSchema } from '@/features/cadastros/cadastro-search'
import { MateriaisPage } from '@/features/cadastros/paginas'

export const Route = createFileRoute('/_app/cadastros/materiais')({
  // ?aberto=novo|<id> abre o painel de cadastro/edição.
  validateSearch: cadastroSearchSchema,
  component: MateriaisPage,
})
