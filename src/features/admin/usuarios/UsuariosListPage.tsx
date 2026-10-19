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
import { formatNumber } from '@/lib/format'
import type { UsuarioResumo } from '@/services/types'
import { listarTodosUsuarios } from '@/services/usuarios'
import { usePerfis } from '@/hooks/use-can'
import { textoEm } from '@/lib/localized-text'
import { useUiStore } from '@/stores/ui-store'
import { STATUS_USUARIO } from './fluxo'
import { useUsuariosLista, useUsuariosResumo } from './use-usuarios'
import { UsuarioSheet } from './UsuarioSheet'

/** Colunas da lista — ids iguais aos campos que a API filtra/ordena. */
function useColunas(): DataTableColumn<UsuarioResumo>[] {
  const { t } = useTranslation()
  const perfis = usePerfis()
  const idioma = useUiStore((s) => s.language)
  return useMemo(
    () => [
      {
        id: 'codigo',
        header: t('usuarios.cols.codigo'),
        type: 'unique-text',
        accessor: (r) => r.codigo,
        size: 140,
        cell: (r) => <span className="font-mono">{r.codigo}</span>,
      },
      {
        id: 'nome',
        header: t('usuarios.cols.nome'),
        type: 'unique-text',
        accessor: (r) => r.nome,
        size: 240,
        mobile: 'title',
        cell: (r) => <span className="font-medium">{r.nome}</span>,
      },
      {
        id: 'email',
        header: t('usuarios.cols.email'),
        type: 'unique-text',
        accessor: (r) => r.email,
        size: 280,
      },
      {
        id: 'perfil',
        header: t('usuarios.cols.perfil'),
        type: 'enum',
        accessor: (r) => r.perfil,
        size: 160,
        options: (perfis.data ?? []).map((p) => ({ value: p.id, label: textoEm(p.nome, idioma) })),
      },
      {
        id: 'status',
        header: t('usuarios.cols.status'),
        type: 'status',
        accessor: (r) => r.status,
        size: 150,
        mobile: 'badge',
        options: STATUS_USUARIO.map((s) => ({ value: s, label: s })),
      },
      {
        id: 'ultimoAcesso',
        header: t('usuarios.cols.ultimoAcesso'),
        type: 'date',
        accessor: (r) => r.ultimoAcesso,
        size: 150,
      },
      {
        id: 'criadoEm',
        header: t('usuarios.cols.criadoEm'),
        type: 'date',
        accessor: (r) => r.criadoEm,
        size: 140,
        hidden: true,
      },
    ],
    [t, perfis.data, idioma],
  )
}

/** Admin › Usuários — lista (padrão Lista, DataTable em modo servidor). */
export function UsuariosListPage() {
  return (
    <RequirePermission permission="admin.usuarios.ver">
      <UsuariosList />
    </RequirePermission>
  )
}

function UsuariosList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const columns = useColunas()
  const [query, setQuery] = useUrlTableQuery(columns)
  const lista = useUsuariosLista(query)
  const resumoQ = useUsuariosResumo()
  const resumo = resumoQ.data
  // Sem resumo (erro): mostra "—" em vez de carregar para sempre.
  const kpiLoading = resumoQ.isPending
  const canCreate = useCan('admin.usuarios.criar')
  const { aberto } = useSearch({ from: '/_app/admin/usuarios/' })
  const painel = (id: string | undefined) =>
    void navigate({ to: '.', search: (s) => ({ ...s, aberto: id }) })

  const abrir = (r: UsuarioResumo) =>
    void navigate({ to: '/admin/usuarios/$id', params: { id: r.id } })
  const kpi = (id: 'total' | 'ativos' | 'bloqueados' | 'inativos') => ({
    id,
    label: t(`usuarios.kpis.${id}`),
    value: resumo ? formatNumber(resumo[id]) : '—',
    loading: kpiLoading,
  })

  return (
    <ListPage
      title={t('nav.admin.usuarios')}
      description={t('usuarios.list.description')}
      kpis={[kpi('total'), kpi('ativos'), kpi('bloqueados'), kpi('inativos')]}
    >
      <DataTable
        id="admin-usuarios"
        title={t('nav.admin.usuarios')}
        exportName="usuarios"
        columns={columns}
        getRowId={(r) => r.id}
        query={query}
        onQueryChange={setQuery}
        page={lista.data}
        loading={lista.isFetching}
        error={lista.isError && !lista.data}
        onRetry={() => void lista.refetch()}
        fetchAll={() => listarTodosUsuarios(query)}
        onRowClick={abrir}
        onCreate={canCreate ? () => painel('novo') : undefined}
        createLabel={t('usuarios.new.title')}
        empty={{ title: t('usuarios.list.emptyTitle'), description: t('usuarios.list.emptyBody') }}
        rowActions={(r) => (
          <>
            <DropdownMenuItem onSelect={() => abrir(r)}>
              <Eye aria-hidden />
              {t('common.open')}
            </DropdownMenuItem>
            <Can permission="admin.usuarios.editar">
              <DropdownMenuItem onSelect={() => painel(r.id)}>
                <Pencil aria-hidden />
                {t('common.edit')}
              </DropdownMenuItem>
            </Can>
          </>
        )}
      />
      {aberto && (
        <UsuarioSheet
          key={aberto}
          id={aberto === 'novo' ? undefined : aberto}
          onClose={() => painel(undefined)}
          // Usuário novo: abre o detalhe.
          onSalvo={(u) =>
            aberto === 'novo' && void navigate({ to: '/admin/usuarios/$id', params: { id: u.id } })
          }
        />
      )}
    </ListPage>
  )
}
