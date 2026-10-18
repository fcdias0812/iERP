import * as React from 'react'
import { Link } from '@tanstack/react-router'

type AppLinkProps = Omit<React.ComponentProps<'a'>, 'href'> & {
  /** Caminho absoluto, como declarado em src/config/navigation.ts (ex.: '/admin/usuarios'). */
  to: string
}

/**
 * Link para rotas declaradas na configuração de navegação (caminho em string).
 * Passa pela rota coringa `/$`: se a tela já tiver rota própria, o roteador
 * escolhe a rota mais específica; se não, abre o "em construção".
 * Em telas com rota tipada, prefira o `<Link to="...">` do TanStack Router.
 */
export function AppLink({ to, ...props }: AppLinkProps) {
  return <Link to="/$" params={{ _splat: to.replace(/^\//, '') }} {...props} />
}
