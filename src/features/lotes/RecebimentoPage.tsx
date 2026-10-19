import { useMemo } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ExternalLink, PackageCheck, Pencil } from 'lucide-react'
import { DataTable, useUrlTableQuery } from '@/components/data-table'
import type { TableQuery } from '@/components/data-table/types'
import { Can } from '@/components/layout/Can'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { ListPage } from '@/components/patterns/ListPage'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useLotes } from '@/features/ordens/use-ordens'
import { useCan } from '@/hooks/use-can'
import { listarTodasOrdens } from '@/services/ordens'
import type { OrdemResumo, StatusOrdem } from '@/services/types'
import { useColunasLotes } from './colunas-lotes'
import type { VisaoRecebimento } from './recebimento-search'
import { RecebimentoSheet } from './RecebimentoSheet'

/*
 * Operação › Recebimento (pedido do usuário, 19/10/2026): "A receber" = lotes agendados (clique
 * abre o painel de recebimento); "Recebidos" = lotes que já chegaram (clique abre o lote).
 * "Receber lote" abre o painel para escolher o lote. Painel na URL: `?aberto=novo|<id>`.
 */

const A_RECEBER: StatusOrdem[] = ['agendado']
const RECEBIDOS: StatusOrdem[] = ['inspecao', 'processo', 'aguardando_cod', 'concluido']

export function RecebimentoPage() {
  return (
    <RequirePermission permission="operacao.recebimento.ver">
      <Recebimento />
    </RequirePermission>
  )
}

function Recebimento() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { visao = 'a-receber', aberto } = useSearch({ from: '/_app/operacao/recebimento' })
  const todas = useColunasLotes()
  const recebidos = visao === 'recebidos'
  // "Recebidos" mostra a data de recebimento e ordena por ela (mais recentes primeiro).
  const columns = useMemo(
    () =>
      todas.map((c) =>
        c.id === 'recebidoEm'
          ? { ...c, hidden: !recebidos }
          : c.id === 'status' && !recebidos
            ? { ...c, hidden: true }
            : c,
      ),
    [todas, recebidos],
  )
  const [query, setQuery] = useUrlTableQuery(columns)
  const consulta = useMemo<TableQuery>(
    () => ({
      ...query,
      sort: query.sort.length
        ? query.sort
        : [{ id: recebidos ? 'recebidoEm' : 'dataColeta', desc: recebidos }],
      filters: [
        ...query.filters.filter((f) => f.id !== 'status' || recebidos),
        { id: 'status', kind: 'in', values: recebidos ? RECEBIDOS : A_RECEBER },
      ],
    }),
    [query, recebidos],
  )
  const lista = useLotes(consulta)
  const podeReceber = useCan('operacao.recebimento.editar')

  const painel = (valor: string | undefined) =>
    void navigate({
      to: '/operacao/recebimento',
      search: (s) => ({ ...s, aberto: valor }),
    })
  const abrirLote = (r: OrdemResumo) =>
    void navigate({
      to: '/operacao/lotes/$id',
      params: { id: r.id },
      search: { aba: 'progresso' },
    })
  const trocarVisao = (v: VisaoRecebimento) =>
    void navigate({
      to: '/operacao/recebimento',
      search: { visao: v === 'a-receber' ? undefined : v },
    })

  return (
    <ListPage
      title={t('nav.operacao.recebimento')}
      description={t('recebimento.paginaDescricao')}
      actions={
        <Can permission="operacao.recebimento.editar" fallback="disable">
          <Button onClick={() => painel('novo')}>
            <PackageCheck aria-hidden />
            {t('recebimento.receberLote')}
          </Button>
        </Can>
      }
    >
      <ButtonGroup aria-label={t('recebimento.visao')}>
        {(['a-receber', 'recebidos'] as const).map((v) => (
          <Button
            key={v}
            size="sm"
            variant={visao === v ? 'default' : 'secondary'}
            aria-pressed={visao === v}
            onClick={() => trocarVisao(v)}
          >
            {t(`recebimento.visoes.${v}`)}
          </Button>
        ))}
      </ButtonGroup>
      <DataTable
        id={`recebimento-${visao}`}
        title={t(`recebimento.visoes.${visao}`)}
        exportName={`recebimento-${visao}`}
        columns={columns}
        getRowId={(r) => r.id}
        query={query}
        onQueryChange={setQuery}
        page={lista.data}
        loading={lista.isFetching}
        error={lista.isError && !lista.data}
        onRetry={() => void lista.refetch()}
        fetchAll={() => listarTodasOrdens(consulta)}
        onRowClick={(r) => (recebidos || !podeReceber ? abrirLote(r) : painel(r.id))}
        rowActions={(r) => (
          <>
            {r.status === 'agendado' && (
              <Can permission="operacao.recebimento.editar">
                <DropdownMenuItem onSelect={() => painel(r.id)}>
                  <PackageCheck aria-hidden />
                  {t('recebimento.receberLote')}
                </DropdownMenuItem>
              </Can>
            )}
            {r.status === 'inspecao' && (
              <Can permission="operacao.recebimento.editar">
                <DropdownMenuItem onSelect={() => painel(r.id)}>
                  <Pencil aria-hidden />
                  {t('recebimento.corrigir')}
                </DropdownMenuItem>
              </Can>
            )}
            <DropdownMenuItem onSelect={() => abrirLote(r)}>
              <ExternalLink aria-hidden />
              {t('recebimento.abrirLote')}
            </DropdownMenuItem>
          </>
        )}
        empty={{
          title: t(`recebimento.vazio.${visao}`),
          description: t('recebimento.vazioBody'),
        }}
      />

      {aberto && (
        <RecebimentoSheet
          key={aberto}
          loteId={aberto === 'novo' ? null : aberto}
          permissao="operacao.recebimento.editar"
          onClose={() => painel(undefined)}
        />
      )}
    </ListPage>
  )
}
