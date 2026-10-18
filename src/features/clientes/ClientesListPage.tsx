import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Eye, Pencil } from 'lucide-react'
import { DataTable, useUrlTableQuery, type DataTableColumn } from '@/components/data-table'
import { Can } from '@/components/layout/Can'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { ListPage } from '@/components/patterns/ListPage'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useCan } from '@/hooks/use-can'
import { formatCnpj, formatNumber, formatPhone } from '@/lib/format'
import { listarTodosClientes } from '@/services/clientes'
import type { ClienteResumo } from '@/services/types'
import { STATUS_CLIENTE } from './fluxo'
import { useClientesLista, useClientesResumo } from './use-clientes'

/** Colunas da lista — ids iguais aos campos que a API filtra/ordena. */
function useColunas(): DataTableColumn<ClienteResumo>[] {
  const { t } = useTranslation()
  return useMemo(
    () => [
      {
        id: 'codigo',
        header: t('clientes.cols.codigo'),
        type: 'unique-text',
        accessor: (r) => r.codigo,
        size: 120,
        cell: (r) => <span className="font-mono">{r.codigo}</span>,
      },
      {
        id: 'nome',
        header: t('clientes.cols.nome'),
        type: 'unique-text',
        accessor: (r) => r.nome,
        size: 240,
        mobile: 'title',
        cell: (r) => <span className="font-medium">{r.nome}</span>,
      },
      {
        id: 'cnpj',
        header: t('clientes.cols.cnpj'),
        type: 'unique-text',
        accessor: (r) => r.cnpj,
        size: 180,
        cell: (r) => <span className="font-mono">{formatCnpj(r.cnpj)}</span>,
        exportValue: (r) => formatCnpj(r.cnpj),
      },
      {
        id: 'contatoEmail',
        header: t('clientes.cols.contatoEmail'),
        type: 'unique-text',
        accessor: (r) => r.contatoEmail,
        size: 240,
      },
      {
        id: 'contatoTelefone',
        header: t('clientes.cols.contatoTelefone'),
        type: 'unique-text',
        accessor: (r) => r.contatoTelefone,
        size: 170,
        cell: (r) => <span className="num">{formatPhone(r.contatoTelefone)}</span>,
        exportValue: (r) => formatPhone(r.contatoTelefone),
      },
      {
        id: 'contatos',
        header: t('clientes.cols.contatos'),
        type: 'number',
        accessor: (r) => r.contatos,
        size: 110,
        hidden: true,
      },
      {
        id: 'status',
        header: t('clientes.cols.status'),
        type: 'status',
        accessor: (r) => r.status,
        size: 120,
        mobile: 'badge',
        options: STATUS_CLIENTE.map((s) => ({ value: s, label: s })),
      },
      {
        id: 'criadoEm',
        header: t('clientes.cols.criadoEm'),
        type: 'date',
        accessor: (r) => r.criadoEm,
        size: 140,
        hidden: true,
      },
    ],
    [t],
  )
}

/** Clientes — lista (padrão Lista, DataTable em modo servidor). */
export function ClientesListPage() {
  return (
    <RequirePermission permission="clientes.ver">
      <ClientesList />
    </RequirePermission>
  )
}

function ClientesList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const columns = useColunas()
  const [query, setQuery] = useUrlTableQuery(columns)
  const lista = useClientesLista(query)
  const resumoQ = useClientesResumo()
  const resumo = resumoQ.data
  const canCreate = useCan('clientes.criar')

  const abrir = (r: ClienteResumo) => void navigate({ to: '/clientes/$id', params: { id: r.id } })
  const kpi = (id: 'total' | 'ativos' | 'inativos') => ({
    id,
    label: t(`clientes.kpis.${id}`),
    value: resumo ? formatNumber(resumo[id]) : '—',
    // Sem resumo (erro): mostra "—" em vez de carregar para sempre.
    loading: resumoQ.isPending,
  })

  return (
    <ListPage
      title={t('nav.clientes')}
      description={t('clientes.list.description')}
      kpis={[kpi('total'), kpi('ativos'), kpi('inativos')]}
    >
      <DataTable
        id="clientes"
        title={t('nav.clientes')}
        exportName="clientes"
        columns={columns}
        getRowId={(r) => r.id}
        query={query}
        onQueryChange={setQuery}
        page={lista.data}
        loading={lista.isFetching}
        error={lista.isError && !lista.data}
        onRetry={() => void lista.refetch()}
        fetchAll={() => listarTodosClientes(query)}
        onRowClick={abrir}
        onCreate={canCreate ? () => void navigate({ to: '/clientes/novo' }) : undefined}
        createLabel={t('clientes.new.title')}
        empty={{ title: t('clientes.list.emptyTitle'), description: t('clientes.list.emptyBody') }}
        rowActions={(r) => (
          <>
            <DropdownMenuItem onSelect={() => abrir(r)}>
              <Eye aria-hidden />
              {t('common.open')}
            </DropdownMenuItem>
            <Can permission="clientes.editar">
              <DropdownMenuItem
                onSelect={() => void navigate({ to: '/clientes/$id/editar', params: { id: r.id } })}
              >
                <Pencil aria-hidden />
                {t('common.edit')}
              </DropdownMenuItem>
            </Can>
          </>
        )}
      />
    </ListPage>
  )
}
