import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, formatPercent } from '@/lib/format'
import type { DashboardOperacao, EtapasContagem } from '@/services/types'

/* Situação dos pedidos por cliente · Controle de SLA (tabela do dashboard da operação). */

type Linha = DashboardOperacao['porCliente'][number]

/** Mais atrasados primeiro. */
const ORDEM_INICIAL: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'atrasados', desc: true }] }
const VAZIO: Linha[] = []

/** Cores das etapas na barra (categóricas, iguais na legenda). */
const CORES = { inspecao: 'bg-chart-1', processo: 'bg-chart-2', aguardandoCod: 'bg-chart-3' }
const ETAPAS = ['inspecao', 'processo', 'aguardandoCod'] as const

/** Barra com a proporção de lotes em cada etapa + "a / b / c". */
export function BarraEtapas({ etapas }: { etapas: EtapasContagem }) {
  const { t } = useTranslation()
  const total = etapas.inspecao + etapas.processo + etapas.aguardandoCod
  if (!total) return <span className="text-muted-foreground">—</span>
  const descricao = ETAPAS.map(
    (e) => `${t(`status.${e === 'aguardandoCod' ? 'aguardando_cod' : e}`)} ${etapas[e]}`,
  ).join(', ')
  return (
    <span className="flex items-center gap-2">
      <span
        className="flex h-2.5 min-w-24 flex-1 overflow-hidden rounded-full bg-muted"
        aria-hidden
      >
        {ETAPAS.map((e) =>
          etapas[e] ? (
            <span key={e} className={CORES[e]} style={{ width: `${(etapas[e] / total) * 100}%` }} />
          ) : null,
        )}
      </span>
      <span className="font-mono type-caption text-muted-foreground" aria-hidden>
        {ETAPAS.map((e) => etapas[e]).join(' / ')}
      </span>
      <span className="sr-only">{descricao}</span>
    </span>
  )
}

/** Legenda das cores das etapas. */
export function LegendaEtapas() {
  const { t } = useTranslation()
  return (
    <ul className="flex flex-wrap gap-3 type-caption text-muted-foreground">
      {ETAPAS.map((e) => (
        <li key={e} className="flex items-center gap-1.5">
          <span className={`size-2.5 rounded-full ${CORES[e]}`} aria-hidden />
          {t(`status.${e === 'aguardandoCod' ? 'aguardando_cod' : e}`)}
        </li>
      ))}
    </ul>
  )
}

export function SituacaoPorCliente({
  linhas,
  carregando,
}: {
  linhas?: Linha[]
  carregando: boolean
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState<TableQuery>(ORDEM_INICIAL)
  const k = (c: string) => t(`operacao.dashboard.porCliente.cols.${c as 'cliente'}`)

  const colunas = useMemo<DataTableColumn<Linha>[]>(
    () => [
      {
        id: 'clienteNome',
        header: k('cliente'),
        type: 'unique-text',
        accessor: (r) => r.clienteNome,
        size: 240,
        mobile: 'title',
        cell: (r) => (
          <Link
            to="/clientes/$id"
            params={{ id: r.clienteId }}
            className="font-medium text-link underline-offset-4 hover:underline"
          >
            {r.clienteNome}
          </Link>
        ),
      },
      { id: 'slaDias', header: k('sla'), type: 'number', accessor: (r) => r.slaDias, size: 140 },
      {
        id: 'emProcesso',
        header: k('emProcesso'),
        type: 'number',
        accessor: (r) => r.emProcesso,
        size: 160,
      },
      {
        id: 'etapas',
        header: k('etapas'),
        type: 'unique-text',
        accessor: (r) => ETAPAS.map((e) => r.etapas[e]).join(' / '),
        sortable: false,
        filterable: false,
        size: 300,
        cell: (r) => <BarraEtapas etapas={r.etapas} />,
      },
      {
        id: 'diasDecorridos',
        header: k('diasDecorridos'),
        type: 'number',
        accessor: (r) => r.diasDecorridos,
        size: 230,
        cell: (r) => (
          <span className="num">
            {r.diasDecorridos === null
              ? '—'
              : t('operacao.dashboard.dias', {
                  n: formatNumber(r.diasDecorridos, { maximumFractionDigits: 1 }),
                })}
          </span>
        ),
      },
      {
        id: 'emRisco',
        header: k('emRisco'),
        type: 'number',
        accessor: (r) => r.emRisco,
        size: 130,
      },
      {
        id: 'atrasados',
        header: k('atrasados'),
        type: 'number',
        accessor: (r) => r.atrasados,
        size: 140,
      },
      {
        id: 'slaCumprido30d',
        header: k('slaCumprido'),
        type: 'number',
        accessor: (r) => r.slaCumprido30d,
        size: 230,
        cell: (r) => <span className="num">{formatPercent(r.slaCumprido30d, 0)}</span>,
        exportValue: (r) => formatPercent(r.slaCumprido30d, 0),
      },
      {
        id: 'situacao',
        header: k('situacao'),
        type: 'status',
        accessor: (r) => r.situacao,
        size: 160,
        mobile: 'badge',
        options: ['atrasado', 'no_prazo', 'sem_sla'].map((s) => ({ value: s, label: s })),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- k depende só de t
    [t],
  )

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>{t('operacao.dashboard.porCliente.titulo')}</CardTitle>
          <p className="type-caption text-muted-foreground">
            {t('operacao.dashboard.porCliente.ajuda')}
          </p>
        </div>
        <LegendaEtapas />
      </CardHeader>
      <CardContent>
        {carregando ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <DataTable
            id="dashboard-por-cliente"
            title={t('operacao.dashboard.porCliente.titulo')}
            columns={colunas}
            getRowId={(r) => r.clienteId}
            data={linhas ?? VAZIO}
            query={query}
            onQueryChange={setQuery}
            exportName="situacao-por-cliente"
            empty={{ title: t('operacao.dashboard.porCliente.vazio') }}
          />
        )}
      </CardContent>
    </Card>
  )
}
