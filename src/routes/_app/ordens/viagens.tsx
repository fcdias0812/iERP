import { createFileRoute } from '@tanstack/react-router'
import { viagensSearchSchema } from '@/features/viagens/viagens-search'
import { ViagensPage } from '@/features/viagens/ViagensPage'

export const Route = createFileRoute('/_app/ordens/viagens')({
  // ?aba=finalizadas troca a visão; ?viagem=<id> escolhe a viagem; ?chat=<id> abre a conversa.
  validateSearch: viagensSearchSchema,
  component: ViagensPage,
})
