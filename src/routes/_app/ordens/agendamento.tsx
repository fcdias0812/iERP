import { createFileRoute } from '@tanstack/react-router'
import { AgendamentoPage } from '@/features/ordens/AgendamentoPage'

/* Único cadastro com página própria (decisão do usuário): formulário longo + pré-cálculo. */
export const Route = createFileRoute('/_app/ordens/agendamento')({
  component: AgendamentoPage,
})
