import { useMemo } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Eye, Pencil } from 'lucide-react'
import { DataTable, useUrlTableQuery, type DataTableColumn } from '@/components/data-table'
import { Can } from '@/components/layout/Can'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { ListPage } from '@/components/patterns/ListPage'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useCan } from '@/hooks/use-can'
import { formatCnpj, formatNumber, formatPhone } from '@/lib/format'
import { listarTodosTransportadoras } from '@/services/transportadoras'
import type { TransportadoraResumo } from '@/services/types'
import { TransportadoraSheet } from './TransportadoraSheet'
import { transportadorasHooks } from './use-transportadoras'

const STATUS = ['ativo', 'inativo']

function useColunas(): DataTableColumn<TransportadoraResumo>[] {
  const { t } = useTranslation()
  return useMemo(
    () => [
      {
        id: 'codigo',
        header: t('transportadoras.cols.codigo'),
        type: 'unique-text',
        accessor: (r) => r.codigo,
        size: 120,
        cell: (r) => <span className="font-mono">{r.codigo}</span>,
      },
      {
        id: 'nome',
        header: t('transportadoras.cols.nome'),
        type: 'unique-text',
        accessor: (r) => r.nome,
        size: 240,
        mobile: 'title',
        cell: (r) => <span className="font-medium">{r.nome}</span>,
      },
      {
        id: 'cnpj',
        header: t('transportadoras.cols.cnpj'),
        type: 'unique-text',
        accessor: (r) => r.cnpj,
        size: 180,
        cell: (r) => <span className="font-mono">{formatCnpj(r.cnpj)}</span>,
        exportValue: (r) => formatCnpj(r.cnpj),
      },
      {
        id: 'contatoEmail',
        header: t('transportadoras.cols.contatoEmail'),
        type: 'unique-text',
        accessor: (r) => r.contatoEmail,
        size: 240,
      },
      {
        id: 'contatoTelefone',
        header: t('transportadoras.cols.contatoTelefone'),
        type: 'unique-text',
        accessor: (r) => r.contatoTelefone,
        size: 170,
        cell: (r) => <span className="num">{formatPhone(r.contatoTelefone)}</span>,
        exportValue: (r) => formatPhone(r.contatoTelefone),
      },
      {
        id: 'motoristas',
        header: t('transportadoras.cols.motoristas'),
        type: 'number',
        accessor: (r) => r.motoristas,
        size: 130,
      },
      {
        id: 'status',
        header: t('transportadoras.cols.status'),
        type: 'status',
        accessor: (r) => r.status,
        size: 120,
        mobile: 'badge',
        options: STATUS.map((s) => ({ value: s, label: s })),
      },
      {
        id: 'criadoEm',
        header: t('transportadoras.cols.criadoEm'),
        type: 'date',
        accessor: (r) => r.criadoEm,
        size: 140,
        hidden: true,
      },
    ],
    [t],
  )
}

/** Relacionamento › Transportadoras — lista (padrão Lista, DataTable em modo servidor). */
export function TransportadorasListPage() {
  return (
    <RequirePermission permission="transportadoras.ver">
      <TransportadorasList />
    </RequirePermission>
  )
}

function TransportadorasList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const columns = useColunas()
  const [query, setQuery] = useUrlTableQuery(columns)
  const lista = transportadorasHooks.useLista(query)
  const resumoQ = transportadorasHooks.useResumo()
  const canCreate = useCan('transportadoras.criar')
  const { aberto } = useSearch({ from: '/_app/transportadoras/' })
  const painel = (id: string | undefined) =>
    void navigate({ to: '.', search: (s) => ({ ...s, aberto: id }) })

  const abrir = (r: TransportadoraResumo) =>
    void navigate({ to: '/transportadoras/$id', params: { id: r.id } })
  const kpi = (id: 'total' | 'ativos' | 'inativos') => ({
    id,
    label: t(`transportadoras.kpis.${id}`),
    value: resumoQ.data ? formatNumber(resumoQ.data[id]) : '—',
    loading: resumoQ.isPending,
  })

  return (
    <ListPage
      title={t('nav.transportadoras')}
      description={t('transportadoras.list.description')}
      kpis={[kpi('total'), kpi('ativos'), kpi('inativos')]}
    >
      <DataTable
        id="transportadoras"
        title={t('nav.transportadoras')}
        exportName="transportadoras"
        columns={columns}
        getRowId={(r) => r.id}
        query={query}
        onQueryChange={setQuery}
        page={lista.data}
        loading={lista.isFetching}
        error={lista.isError && !lista.data}
        onRetry={() => void lista.refetch()}
        fetchAll={() => listarTodosTransportadoras(query)}
        onRowClick={abrir}
        onCreate={canCreate ? () => painel('novo') : undefined}
        createLabel={t('transportadoras.new.title')}
        empty={{
          title: t('transportadoras.list.emptyTitle'),
          description: t('transportadoras.list.emptyBody'),
        }}
        rowActions={(r) => (
          <>
            <DropdownMenuItem onSelect={() => abrir(r)}>
              <Eye aria-hidden />
              {t('common.open')}
            </DropdownMenuItem>
            <Can permission="transportadoras.editar">
              <DropdownMenuItem onSelect={() => painel(r.id)}>
                <Pencil aria-hidden />
                {t('common.edit')}
              </DropdownMenuItem>
            </Can>
          </>
        )}
      />
      {aberto && (
        <TransportadoraSheet
          key={aberto}
          id={aberto === 'novo' ? undefined : aberto}
          onClose={() => painel(undefined)}
          // Transportadora nova: abre o detalhe.
          onSalvo={(tr) =>
            aberto === 'novo' &&
            void navigate({ to: '/transportadoras/$id', params: { id: tr.id } })
          }
        />
      )}
    </ListPage>
  )
}
