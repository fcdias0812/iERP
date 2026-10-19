import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { DataTable, useUrlTableQuery } from '@/components/data-table'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { ListPage } from '@/components/patterns/ListPage'
import { useCan } from '@/hooks/use-can'
import { useLotes } from '@/features/ordens/use-ordens'
import { listarTodasOrdens } from '@/services/ordens'
import type { OrdemResumo } from '@/services/types'
import { useColunasLotes } from './colunas-lotes'
import type { OrigemLote } from './origem'

/*
 * Lista dos lotes — a mesma em Ordens › Lotes e em Operação › Lotes (o mesmo lote visto de dois
 * módulos). Clique/Enter na linha abre o detalhe do lote dentro do módulo de origem.
 */

export function LotesListPage({ origem }: { origem: OrigemLote }) {
  return (
    <RequirePermission permission={`${origem}.ver`}>
      <Lotes origem={origem} />
    </RequirePermission>
  )
}

function Lotes({ origem }: { origem: OrigemLote }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const columns = useColunasLotes()
  const [query, setQuery] = useUrlTableQuery(columns)
  const lista = useLotes(query)
  const podeAgendar = useCan('ordens.criar')
  const abrir = (r: OrdemResumo) =>
    void (origem === 'ordens'
      ? navigate({ to: '/ordens/lotes/$id', params: { id: r.id } })
      : navigate({ to: '/operacao/lotes/$id', params: { id: r.id } }))

  return (
    <ListPage title={t(`nav.${origem}.lotes`)} description={t('ordens.lotes.description')}>
      <DataTable
        id={`${origem}-lotes`}
        title={t(`nav.${origem}.lotes`)}
        exportName="lotes"
        columns={columns}
        getRowId={(r) => r.id}
        query={query}
        onQueryChange={setQuery}
        page={lista.data}
        loading={lista.isFetching}
        error={lista.isError && !lista.data}
        onRetry={() => void lista.refetch()}
        fetchAll={() => listarTodasOrdens(query)}
        onRowClick={abrir}
        onCreate={podeAgendar ? () => void navigate({ to: '/ordens/agendamento' }) : undefined}
        createLabel={t('ordens.lotes.novo')}
        empty={{ title: t('ordens.lotes.emptyTitle'), description: t('ordens.lotes.emptyBody') }}
      />
    </ListPage>
  )
}
