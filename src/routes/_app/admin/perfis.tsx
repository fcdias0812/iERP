import { createFileRoute } from '@tanstack/react-router'
import { cadastroSearchSchema } from '@/features/cadastros/cadastro-search'
import { PerfisPage } from '@/features/admin/perfis/PerfisPage'

export const Route = createFileRoute('/_app/admin/perfis')({
  // ?aberto=novo|<id> abre o painel de cadastro/edição.
  validateSearch: cadastroSearchSchema,
  component: PerfisPage,
})
