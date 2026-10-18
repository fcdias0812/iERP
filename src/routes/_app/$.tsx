import { createFileRoute } from '@tanstack/react-router'
import { UnderConstructionPage } from '@/features/placeholder/UnderConstructionPage'

/**
 * Rota coringa: tela "em construção" para itens do menu que ainda não têm rota própria
 * (ou 404, se o caminho nem está no menu). Uma rota própria (ex.:
 * src/routes/_app/admin/usuarios/) tem prioridade sobre esta.
 */
export const Route = createFileRoute('/_app/$')({
  component: UnderConstructionPage,
})
