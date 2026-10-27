import type { ReactNode } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { ListPage } from '@/components/patterns/ListPage'
import { AbaAreas } from './AbaAreas'
import { AbaMateriais } from './AbaMateriais'
import { AbaRastreadores } from './AbaRastreadores'
import { AbaRecipientes } from './AbaRecipientes'

/*
 * Sistema › Cadastros: um item de menu para cada cadastro (pedido do usuário — "igual aos outros
 * módulos, com a seta"). O painel lateral de cadastro/edição abre por `?aberto=novo|<id>`.
 */

type Item = 'materiais' | 'pallets' | 'caixotes' | 'areas' | 'rastreadores'

function Pagina({ item, children }: { item: Item; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <RequirePermission permission={`cadastros.${item}.ver`}>
      <ListPage title={t(`nav.cadastros.${item}`)} description={t(`cadastros.paginas.${item}`)}>
        {children}
      </ListPage>
    </RequirePermission>
  )
}

/** `?aberto=` da tela atual e como mudar (abrir/fechar o painel). */
function usePainel() {
  const navigate = useNavigate()
  const { aberto } = useSearch({ strict: false }) as { aberto?: string }
  const abrir = (id: string | undefined) =>
    void navigate({ to: '.', search: (s: Record<string, unknown>) => ({ ...s, aberto: id }) })
  return { aberto, abrir }
}

export function MateriaisPage() {
  const { aberto, abrir } = usePainel()
  return (
    <Pagina item="materiais">
      <AbaMateriais aberto={aberto} onAbrir={abrir} />
    </Pagina>
  )
}

export function PalletsPage() {
  const { aberto, abrir } = usePainel()
  return (
    <Pagina item="pallets">
      <AbaRecipientes tipo="pallet" aberto={aberto} onAbrir={abrir} />
    </Pagina>
  )
}

export function CaixotesPage() {
  const { aberto, abrir } = usePainel()
  return (
    <Pagina item="caixotes">
      <AbaRecipientes tipo="caixote" aberto={aberto} onAbrir={abrir} />
    </Pagina>
  )
}

export function AreasPage() {
  const { aberto, abrir } = usePainel()
  return (
    <Pagina item="areas">
      <AbaAreas aberto={aberto} onAbrir={abrir} />
    </Pagina>
  )
}

export function RastreadoresPage() {
  const { aberto, abrir } = usePainel()
  return (
    <Pagina item="rastreadores">
      <AbaRastreadores aberto={aberto} onAbrir={abrir} />
    </Pagina>
  )
}
