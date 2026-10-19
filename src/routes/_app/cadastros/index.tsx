import { createFileRoute, redirect } from '@tanstack/react-router'

/* /cadastros sem item: abre o primeiro (Materiais). */
export const Route = createFileRoute('/_app/cadastros/')({
  beforeLoad: () => {
    throw redirect({ to: '/cadastros/materiais' })
  },
})
