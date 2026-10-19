import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, formatPercent } from '@/lib/format'
import { toneStyles } from '@/lib/status/tones'
import { cn } from '@/lib/utils'
import type { AnomaliaPrazo, DashboardOperacao, StatusOrdem } from '@/services/types'

/*
 * Pedidos com anomalia de prazo: lotes em processo atrasados (passaram do SLA) ou em risco
 * (≥ 80% do SLA usado). "Todos em processo" mostra também os que estão no prazo.
 */

type Linha = DashboardOperacao['lotes'][number]

/** Menor "restante" (mais grave) primeiro. */
const ORDEM_INICIAL: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'restante', desc: false }] }
const FLUXO: StatusOrdem[] = ['inspecao', 'processo', 'aguardando_cod']

const umaCasa = (n: number) => formatNumber(n, { maximumFractionDigits: 1 })

function Fluxo({ r }: { r: Linha }) {
  const { t } = useTranslation()
  const atual = FLUXO.indexOf(r.etapa)
  return (
    <ol className="flex flex-wrap gap-1">
      {FLUXO.map((e, i) => (
        <li
          key={e}
          aria-current={i === atual ? 'step' : undefined}
          className={cn(
            'rounded-sm border px-1.5 py-0.5 type-caption',
            i < atual && toneStyles.info.subtle,
            i === atual && (r.anomalias.length ? toneStyles.danger.solid : toneStyles.info.solid),
            i > atual && 'text-muted-foreground',
          )}
        >
          {t(`status.${e}`)}
          {i === atual && r.diasNaEtapa !== null && (
            <span className="num">
              {' · '}
              {t('operacao.dashboard.anomalias.naEtapa', { n: umaCasa(r.diasNaEtapa) })}
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

function Anomalias({ lista }: { lista: AnomaliaPrazo[] }) {
  const { t } = useTranslation()
  return (
    <span className="flex flex-wrap gap-1">
      {lista.map((a) => (
        <span
          key={a.tipo}
          className={cn(
            'rounded-sm border px-1.5 py-0.5 type-caption num',
            a.tipo === 'atrasado' ? toneStyles.danger.subtle : toneStyles.warning.subtle,
          )}
        >
          {a.tipo === 'atrasado'
            ? t('operacao.dashboard.anomalias.atrasado', { n: umaCasa(a.dias) })
            : t('operacao.dashboard.anomalias.risco', { pct: formatPercent(a.uso, 0) })}
        </span>
      ))}
    </span>
  )
}

export function AnomaliasPrazo({ lotes, carregando }: { lotes?: Linha[]; carregando: boolean }) {
  const { t } = useTranslation()
  const [soAnomalias, setSoAnomalias] = useState(true)
  const [query, setQuery] = useState<TableQuery>(ORDEM_INICIAL)
  const todos = useMemo(() => lotes ?? [], [lotes])
  const comAnomalia = useMemo(() => todos.filter((l) => l.anomalias.length > 0), [todos])
  const k = (c: string) => t(`operacao.dashboard.anomalias.cols.${c as 'codigo'}`)

  const colunas = useMemo<DataTableColumn<Linha>[]>(
    () => [
      {
        id: 'codigo',
        header: k('codigo'),
        type: 'unique-text',
        accessor: (r) => r.codigo,
        size: 130,
        mobile: 'title',
        cell: (r) => (
          <Link
            to="/ordens/lotes"
            search={{ q: r.codigo }}
            className="font-mono text-link underline-offset-4 hover:underline"
          >
            {r.codigo}
          </Link>
        ),
      },
      {
        id: 'clienteNome',
        header: k('cliente'),
        type: 'unique-text',
        accessor: (r) => r.clienteNome,
        size: 200,
      },
      {
        id: 'recebidoEm',
        header: k('chegada'),
        type: 'date',
        accessor: (r) => r.recebidoEm,
        size: 130,
      },
      {
        id: 'etapa',
        header: k('fluxo'),
        type: 'status',
        accessor: (r) => r.etapa,
        size: 360,
        options: FLUXO.map((s) => ({ value: s, label: s })),
        cell: (r) => <Fluxo r={r} />,
      },
      {
        id: 'diasDecorridos',
        header: k('diasSla'),
        type: 'number',
        accessor: (r) => r.diasDecorridos,
        size: 180,
        cell: (r) => (
          <span className="num">
            {r.diasDecorridos === null
              ? '—'
              : r.slaDias === null
                ? t('operacao.dashboard.dias', { n: umaCasa(r.diasDecorridos) })
                : t('operacao.dashboard.anomalias.diasDeSla', {
                    dias: umaCasa(r.diasDecorridos),
                    sla: formatNumber(r.slaDias),
                  })}
          </span>
        ),
      },
      {
        id: 'restante',
        header: k('restante'),
        type: 'number',
        accessor: (r) => r.restante,
        size: 130,
        cell: (r) => (
          <span
            className={cn(
              'font-medium num',
              r.restante !== null && r.restante < 0 && toneStyles.danger.text,
            )}
          >
            {r.restante === null ? '—' : t('operacao.dashboard.dias', { n: umaCasa(r.restante) })}
          </span>
        ),
      },
      {
        id: 'anomalias',
        header: k('anomalias'),
        type: 'unique-text',
        accessor: (r) => r.anomalias.map((a) => a.tipo).join(', '),
        sortable: false,
        filterable: false,
        size: 240,
        cell: (r) =>
          r.anomalias.length ? (
            <Anomalias lista={r.anomalias} />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- k depende só de t
    [t],
  )

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <CardTitle>{t('operacao.dashboard.anomalias.titulo')}</CardTitle>
        <ButtonGroup aria-label={t('operacao.dashboard.anomalias.filtro')}>
          <Button
            size="sm"
            variant={soAnomalias ? 'default' : 'secondary'}
            aria-pressed={soAnomalias}
            onClick={() => setSoAnomalias(true)}
          >
            {t('operacao.dashboard.anomalias.soAnomalias')}
            <span className="num">({comAnomalia.length})</span>
          </Button>
          <Button
            size="sm"
            variant={soAnomalias ? 'secondary' : 'default'}
            aria-pressed={!soAnomalias}
            onClick={() => setSoAnomalias(false)}
          >
            {t('operacao.dashboard.anomalias.todos')}
            <span className="num">({todos.length})</span>
          </Button>
        </ButtonGroup>
      </CardHeader>
      <CardContent>
        {carregando ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <DataTable
            id="dashboard-anomalias"
            title={t('operacao.dashboard.anomalias.titulo')}
            columns={colunas}
            getRowId={(r) => r.id}
            data={soAnomalias ? comAnomalia : todos}
            query={query}
            onQueryChange={setQuery}
            exportName="anomalias-de-prazo"
            highlightRow={(r) => r.anomalias.some((a) => a.tipo === 'atrasado')}
            empty={{
              title: soAnomalias
                ? t('operacao.dashboard.anomalias.vazio')
                : t('operacao.dashboard.anomalias.vazioTodos'),
            }}
          />
        )}
      </CardContent>
    </Card>
  )
}
