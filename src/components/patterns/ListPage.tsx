import type { ReactNode } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { KpiCard } from '@/components/ui/kpi-card'

type KpiProps = React.ComponentProps<typeof KpiCard> & { id: string }

interface ListPageProps {
  title: string
  description?: string
  /** Ações do cabeçalho (o "Novo" normalmente fica na barra do DataTable, com atalho N). */
  actions?: ReactNode
  /** Indicadores opcionais acima da tabela. */
  kpis?: KpiProps[]
  /** O <DataTable />. */
  children: ReactNode
}

/**
 * PADRÃO LISTA: cabeçalho + KPIs opcionais + DataTable.
 * Toda tela de listagem do sistema segue este molde.
 */
export function ListPage({ title, description, actions, kpis, children }: ListPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} actions={actions} />
      {kpis && kpis.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(17rem,100%),1fr))] gap-4">
          {kpis.map(({ id, ...k }) => (
            <li key={id}>
              <KpiCard {...k} />
            </li>
          ))}
        </ul>
      )}
      {children}
    </div>
  )
}
