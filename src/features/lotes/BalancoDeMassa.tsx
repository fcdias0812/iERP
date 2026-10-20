import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { EMPTY, formatDateTime, formatNumber, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  BalancoDeMassa as Balanco,
  CommodityBalanco,
  ContainerBalanco,
  Ordem,
} from '@/services/types'

/*
 * Balanço de massa do lote (pedido do usuário, 20/10/2026), na aba Progresso logo abaixo do
 * quadro do processamento: o que entrou (bruto − embalagem), o que saiu contado (peças lidas +
 * scrap triado) e a diferença contra a tolerância; depois o peso por commodity e os bigbags
 * onde o lote foi lançado. A conta é do servidor (`server/src/modules/integracao/balanco.ts`).
 */

const kg = (v: number | null) => (v === null ? EMPTY : `${formatNumber(v)} kg`)

const POR_PESO: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'pesoKg', desc: true }] }
const POR_CODIGO: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'codigo', desc: false }] }
const SEM_COMMODITIES: CommodityBalanco[] = []
const SEM_CONTAINERS: ContainerBalanco[] = []

export function CardBalanco({ o }: { o: Ordem }) {
  const { t } = useTranslation()
  const b = o.balanco
  if (!b) return null
  const sistema = t(`integracao.sistemas.${b.sistema}`, { defaultValue: b.sistema })
  const tolerancia =
    b.toleranciaPercent === null ? EMPTY : formatPercent(b.toleranciaPercent / 100, 1)

  return (
    <Card role="region" aria-labelledby="lote-balanco">
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <CardTitle id="lote-balanco">{t('lotes.balanco.titulo')}</CardTitle>
          <p className="type-caption text-muted-foreground">
            {t('lotes.balanco.origem', {
              sistema,
              quando: formatDateTime(b.recebidoEm),
              tolerancia,
            })}
          </p>
        </div>
        <StatusBadge status={`balanco_${b.situacao}`} />
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="type-body text-muted-foreground">
          {t(`lotes.balanco.situacoes.${b.situacao}`, { tolerancia })}
        </p>
        <Conta b={b} />
        {(b.pecasSemPeso > 0 || b.foraDaLista > 0) && (
          <p className="type-caption text-muted-foreground">
            {t('lotes.balanco.explicam', {
              semPeso: formatNumber(b.pecasSemPeso),
              foraDaLista: formatNumber(b.foraDaLista),
            })}
          </p>
        )}
        <Commodities o={o} b={b} />
        <Containers o={o} b={b} />
      </CardContent>
    </Card>
  )
}

/* ---------------------------------------------------------------- a conta */

function Conta({ b }: { b: Balanco }) {
  const { t } = useTranslation()
  const tom =
    b.situacao === 'fechado'
      ? 'bg-success-subtle text-success-subtle-foreground'
      : b.situacao === 'fora'
        ? 'bg-alert-subtle text-alert-subtle-foreground'
        : ''
  const itens: {
    id: 'entrada' | 'lido' | 'scrap' | 'diferenca'
    valor: string
    detalhe: string
    destaque?: string
  }[] = [
    {
      id: 'entrada',
      valor: kg(b.liquidoKg),
      detalhe: t('lotes.balanco.entradaDetalhe', {
        bruto: kg(b.brutoKg),
        embalagem: kg(b.embalagemKg),
      }),
    },
    {
      id: 'lido',
      valor: kg(b.lidoKg),
      detalhe: t('lotes.balanco.lidoDetalhe', { pecas: formatNumber(b.pecasLidas) }),
    },
    {
      id: 'scrap',
      valor: kg(b.scrapTriadoKg),
      detalhe:
        b.scrapRecebidoKg === null
          ? t('lotes.balanco.semScrap')
          : t('lotes.balanco.scrapDetalhe', { recebido: kg(b.scrapRecebidoKg) }),
    },
    {
      id: 'diferenca',
      valor: kg(b.diferencaKg),
      detalhe:
        b.diferencaPercent === null
          ? EMPTY
          : t('lotes.balanco.diferencaDetalhe', {
              percentual: formatPercent(b.diferencaPercent / 100, 1),
            }),
      destaque: tom,
    },
  ]

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {itens.map((i) => (
        <div
          key={i.id}
          className={cn('flex flex-col gap-1 rounded-md border p-3', i.destaque || 'bg-card')}
        >
          <dt className={cn('type-label', i.destaque ? 'text-current' : 'text-muted-foreground')}>
            {t(`lotes.balanco.campos.${i.id}`)}
          </dt>
          <dd className="type-section-title num">{i.valor}</dd>
          <dd className={cn('type-caption', i.destaque ? 'text-current' : 'text-muted-foreground')}>
            {i.detalhe}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* ---------------------------------------------------------------- commodities */

function Commodities({ o, b }: { o: Ordem; b: Balanco }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState<TableQuery>(POR_PESO)
  const total = b.commodities.reduce((s, c) => s + c.pesoKg, 0)
  const colunas = useMemo<DataTableColumn<CommodityBalanco>[]>(
    () => [
      {
        id: 'rotulo',
        header: t('lotes.balanco.cols.commodity'),
        type: 'unique-text',
        accessor: (r) => r.rotulo,
        size: 260,
        mobile: 'title',
      },
      {
        id: 'codigo',
        header: t('lotes.balanco.cols.codigo'),
        type: 'unique-text',
        accessor: (r) => r.codigo,
        size: 160,
        cell: (r) => <span className="font-mono">{r.codigo}</span>,
      },
      {
        id: 'pesoKg',
        header: t('lotes.balanco.cols.peso'),
        type: 'number',
        accessor: (r) => r.pesoKg,
        size: 160,
        total: true,
        cell: (r) => <span className="num">{kg(r.pesoKg)}</span>,
      },
      {
        id: 'participacao',
        header: t('lotes.balanco.cols.participacao'),
        type: 'number',
        accessor: (r) => (total ? r.pesoKg / total : null),
        size: 150,
        cell: (r) => (
          <span className="num">{total ? formatPercent(r.pesoKg / total, 1) : EMPTY}</span>
        ),
        exportValue: (r) => (total ? formatPercent(r.pesoKg / total, 1) : null),
      },
    ],
    [t, total],
  )
  return (
    <section aria-labelledby="lote-balanco-commodities" className="flex flex-col gap-2">
      <h3 id="lote-balanco-commodities" className="type-label">
        {t('lotes.balanco.commodities')}
      </h3>
      <DataTable
        id="lote-balanco-commodities"
        title={t('lotes.balanco.commodities')}
        columns={colunas}
        getRowId={(r) => r.codigo}
        data={b.commodities.length ? b.commodities : SEM_COMMODITIES}
        query={query}
        onQueryChange={setQuery}
        exportName={`balanco-commodities-${o.codigo}`}
        empty={{
          title: t('lotes.balanco.commoditiesVazioTitle'),
          description: t('lotes.balanco.commoditiesVazioBody'),
        }}
      />
    </section>
  )
}

/* ---------------------------------------------------------------- containers */

function Containers({ o, b }: { o: Ordem; b: Balanco }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState<TableQuery>(POR_CODIGO)
  const categorias = useMemo(
    () =>
      [
        ...new Set(b.containers.map((c) => c.categoriaRotulo ?? c.categoria).filter(Boolean)),
      ].sort() as string[],
    [b.containers],
  )
  const colunas = useMemo<DataTableColumn<ContainerBalanco>[]>(
    () => [
      {
        id: 'codigo',
        header: t('lotes.balanco.cols.container'),
        type: 'unique-text',
        accessor: (r) => r.codigo,
        size: 150,
        mobile: 'title',
        cell: (r) => <span className="font-mono">{r.codigo}</span>,
      },
      {
        id: 'categoria',
        header: t('lotes.balanco.cols.commodity'),
        type: 'enum',
        accessor: (r) => r.categoriaRotulo ?? r.categoria,
        size: 220,
        options: categorias.map((c) => ({ value: c, label: c })),
      },
      {
        id: 'situacao',
        header: t('lotes.balanco.cols.situacao'),
        type: 'status',
        accessor: (r) => `container_${r.situacao}`,
        size: 150,
        mobile: 'badge',
        options: ['aberto', 'fechado', 'embarcado'].map((s) => ({
          value: `container_${s}`,
          label: `container_${s}`,
        })),
      },
      {
        id: 'desteLoteKg',
        header: t('lotes.balanco.cols.desteLote'),
        type: 'number',
        accessor: (r) => r.desteLoteKg,
        size: 160,
        total: true,
        cell: (r) => <span className="num">{kg(r.desteLoteKg)}</span>,
      },
      {
        id: 'brutoKg',
        header: t('lotes.balanco.cols.bruto'),
        type: 'number',
        accessor: (r) => r.brutoKg,
        size: 150,
        cell: (r) => <span className="num">{kg(r.brutoKg)}</span>,
      },
      {
        id: 'destino',
        header: t('lotes.balanco.cols.destino'),
        type: 'unique-text',
        accessor: (r) => r.destino,
        size: 200,
      },
      {
        id: 'fechadoEm',
        header: t('lotes.balanco.cols.fechadoEm'),
        type: 'date',
        accessor: (r) => r.fechadoEm,
        size: 170,
        cell: (r) => <span className="num">{formatDateTime(r.fechadoEm)}</span>,
        exportValue: (r) => formatDateTime(r.fechadoEm),
      },
      {
        id: 'embarcadoEm',
        header: t('lotes.balanco.cols.embarcadoEm'),
        type: 'date',
        accessor: (r) => r.embarcadoEm,
        size: 170,
        hidden: true,
        cell: (r) => <span className="num">{formatDateTime(r.embarcadoEm)}</span>,
        exportValue: (r) => formatDateTime(r.embarcadoEm),
      },
    ],
    [t, categorias],
  )
  return (
    <section aria-labelledby="lote-balanco-containers" className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h3 id="lote-balanco-containers" className="type-label">
          {t('lotes.balanco.containers')}
        </h3>
        <p className="type-caption text-muted-foreground">{t('lotes.balanco.containersAjuda')}</p>
      </div>
      <DataTable
        id="lote-balanco-containers"
        title={t('lotes.balanco.containers')}
        columns={colunas}
        getRowId={(r) => r.codigo}
        data={b.containers.length ? b.containers : SEM_CONTAINERS}
        query={query}
        onQueryChange={setQuery}
        exportName={`balanco-containers-${o.codigo}`}
        empty={{
          title: t('lotes.balanco.containersVazioTitle'),
          description: t('lotes.balanco.containersVazioBody'),
        }}
      />
    </section>
  )
}
