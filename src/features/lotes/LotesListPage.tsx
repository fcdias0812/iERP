import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { DataTable, useUrlTableQuery, type DataTableColumn } from '@/components/data-table'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { ListPage } from '@/components/patterns/ListPage'
import { useCan } from '@/hooks/use-can'
import { SERVICOS } from '@/features/ordens/agendamento-schema'
import { useLotes } from '@/features/ordens/use-ordens'
import { listarTodasOrdens } from '@/services/ordens'
import type { OrdemResumo } from '@/services/types'
import { ETAPAS_LOTE, type OrigemLote } from './origem'

/*
 * Lista dos lotes — a mesma em Ordens › Lotes e em Operação › Lotes (o mesmo lote visto de dois
 * módulos). Clique/Enter na linha abre o detalhe do lote dentro do módulo de origem.
 */

/** Número romano de cada serviço (I a V), como no formulário. */
const ROMANOS: Record<(typeof SERVICOS)[number], string> = {
  psm: 'I',
  onsiteShredding: 'II',
  recycleOnly: 'III',
  valueRecoveryRacks: 'IV',
  valueRecoveryItad: 'V',
}

function useColunas(): DataTableColumn<OrdemResumo>[] {
  const { t } = useTranslation()
  return useMemo(() => {
    const texto = (
      id: keyof OrdemResumo,
      rotulo: string,
      size: number,
      extra: Partial<DataTableColumn<OrdemResumo>> = {},
    ): DataTableColumn<OrdemResumo> => ({
      id,
      header: t(`ordens.lotes.cols.${rotulo as 'site'}`),
      type: 'unique-text',
      accessor: (r) => r[id],
      size,
      ...extra,
    })
    const data = (
      id: 'dataColeta' | 'coletaPrevista' | 'dataChegada' | 'criadoEm',
      hidden = false,
    ) => ({
      id,
      header: t(`ordens.lotes.cols.${id}`),
      type: 'date' as const,
      accessor: (r: OrdemResumo) => r[id],
      size: 150,
      hidden,
    })
    return [
      texto('codigo', 'codigo', 130, {
        mobile: 'title',
        cell: (r) => <span className="font-mono">{r.codigo}</span>,
      }),
      texto('clienteNome', 'cliente', 220, {
        cell: (r) => <span className="font-medium">{r.clienteNome}</span>,
      }),
      texto('siteCodigo', 'site', 120, {
        cell: (r) => <span className="font-mono">{r.siteCodigo}</span>,
      }),
      texto('docaNumero', 'doca', 100, {
        cell: (r) => <span className="font-mono">{r.docaNumero}</span>,
      }),
      texto('referenciaCliente', 'referencia', 160, {
        cell: (r) => <span className="font-mono">{r.referenciaCliente ?? '—'}</span>,
      }),
      texto('transportadoraNome', 'transportadora', 200),
      data('dataColeta'),
      data('coletaPrevista'),
      data('dataChegada'),
      {
        id: 'servicos',
        header: t('ordens.lotes.cols.servicos'),
        type: 'unique-text',
        accessor: (r) =>
          SERVICOS.filter((s) => r.servicos[s])
            .map((s) => ROMANOS[s])
            .join(' · '),
        sortable: false,
        filterable: false,
        size: 140,
        exportValue: (r) =>
          SERVICOS.filter((s) => r.servicos[s])
            .map((s) => t(`ordens.agendamento.servicos.${s}`))
            .join('; '),
      },
      {
        id: 'totalVolumes',
        header: t('ordens.lotes.cols.totalVolumes'),
        type: 'number',
        accessor: (r) => r.totalVolumes,
        size: 120,
      },
      {
        id: 'rastrear',
        header: t('ordens.lotes.cols.rastrear'),
        type: 'boolean',
        accessor: (r) => r.rastrear,
        size: 130,
      },
      {
        id: 'status',
        header: t('ordens.lotes.cols.status'),
        type: 'status',
        accessor: (r) => r.status,
        size: 140,
        mobile: 'badge',
        options: ETAPAS_LOTE.map((e) => ({ value: e, label: e })),
      },
      data('criadoEm', true),
    ]
  }, [t])
}

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
  const columns = useColunas()
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
