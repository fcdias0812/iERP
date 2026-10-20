import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Circle, CircleCheck } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KpiCard } from '@/components/ui/kpi-card'
import { TextoTraduzido } from '@/components/ui/localized-text'
import { KeyValueList } from '@/components/ui/metadata'
import { StatusBadge } from '@/components/ui/status-badge'
import { EMPTY, formatDate, formatDateTime, formatNumber } from '@/lib/format'
import { STATUS_MAP } from '@/lib/status/statusMap'
import { cn } from '@/lib/utils'
import { urlFotoPallet, urlFotoRecebimento } from '@/services/ordens'
import type {
  FotoRecebimento,
  ItemRecebimento,
  Ordem,
  PalletLote,
  StatusOrdem,
} from '@/services/types'
import { FotoMiniatura } from './FotoMiniatura'
import { ETAPAS_LOTE } from './origem'
import { CardBalanco } from './BalancoDeMassa'
import { CardProcessamento } from './ProcessamentoExterno'
import { StatusDoLote } from './StatusDoLote'

/*
 * Progresso do lote: etapa atual, pallets recebidos e peso bruto; linha do tempo das etapas
 * (feitas, atual, a fazer); o processamento e o BALANÇO DE MASSA do sistema de fora (Dell →
 * MoonShot); e o recebimento pallet a pallet. Os dados do agendamento ficam
 * na aba Informações.
 * Etapas e pallets vêm de Operação › Recebimento ou da integração com os sistemas de produção.
 */

const ORDEM_PALLETS: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'numero', desc: false }] }

export function AbaProgresso({ o }: { o: Ordem }) {
  const { t } = useTranslation()
  const pesos = o.pallets.map((p) => p.pesoKg).filter((p): p is number => p !== null)
  const pesoBruto = pesos.length ? pesos.reduce((a, b) => a + b, 0) : null

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="lote-resumo">
        <h2 id="lote-resumo" className="sr-only">
          {t('lotes.progresso.resumo')}
        </h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <li>
            <Card className="h-full">
              <CardContent className="flex flex-col gap-2">
                <span className="type-label text-muted-foreground">
                  {t('lotes.progresso.etapaAtual')}
                </span>
                <span>
                  <StatusDoLote lote={o} />
                </span>
                <span className="type-caption text-muted-foreground">
                  {o.etapaDesde
                    ? t('lotes.progresso.desde', { data: formatDate(o.etapaDesde) })
                    : EMPTY}
                </span>
              </CardContent>
            </Card>
          </li>
          <li>
            <KpiCard
              className="h-full"
              label={t('lotes.progresso.palletsRecebidos')}
              value={o.pallets.length ? formatNumber(o.pallets.length) : EMPTY}
            />
          </li>
          <li>
            <KpiCard
              className="h-full"
              label={t('lotes.progresso.pesoBruto')}
              value={pesoBruto === null ? EMPTY : `${formatNumber(pesoBruto)} kg`}
            />
          </li>
        </ul>
      </section>
      <CardProcessamento o={o} />
      <CardBalanco o={o} />

      <LinhaDoTempo o={o} />
      {o.recebimento && <DadosRecebimento o={o} />}
      <Recebimento o={o} />
    </div>
  )
}

/* ---------------------------------------------------------------- linha do tempo */

type EstadoEtapa = 'feita' | 'atual' | 'pendente'

function LinhaDoTempo({ o }: { o: Ordem }) {
  const { t } = useTranslation()
  const atual = ETAPAS_LOTE.indexOf(o.status)
  const quando = (etapa: StatusOrdem) => o.etapas.findLast((e) => e.etapa === etapa)?.em ?? null
  // A última etapa (concluído) já é o fim: aparece como feita.
  const estado = (i: number): EstadoEtapa =>
    i < atual || (i === atual && i === ETAPAS_LOTE.length - 1)
      ? 'feita'
      : i === atual
        ? 'atual'
        : 'pendente'

  return (
    <Card role="region" aria-labelledby="lote-linha-do-tempo">
      <CardHeader>
        <CardTitle id="lote-linha-do-tempo">{t('lotes.progresso.linhaDoTempo')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ol
          aria-label={t('lotes.progresso.linhaDoTempo')}
          className="grid grid-cols-1 gap-3 md:grid-cols-5 md:gap-2"
        >
          {ETAPAS_LOTE.map((etapa, i) => {
            const e = estado(i)
            const em = quando(etapa)
            const Icone =
              e === 'feita' ? CircleCheck : e === 'atual' ? STATUS_MAP[etapa].icon : Circle
            return (
              <li
                key={etapa}
                aria-current={e === 'atual' ? 'step' : undefined}
                className="relative flex items-start gap-3 md:flex-col md:items-center md:text-center"
              >
                {/* Traço até a próxima etapa (verde quando o caminho já foi feito). */}
                {i < ETAPAS_LOTE.length - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute top-9 left-[0.9375rem] h-[calc(100%-1.75rem)] w-0.5 md:top-[0.9375rem] md:left-[calc(50%+1.25rem)] md:h-0.5 md:w-[calc(100%-2rem)]',
                      i < atual ? 'bg-success' : 'bg-border',
                    )}
                  />
                )}
                <span
                  aria-hidden
                  className={cn(
                    'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4',
                    e === 'feita' && 'bg-success-subtle text-success-subtle-foreground',
                    e === 'atual' && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                    e === 'pendente' &&
                      'border-2 border-dashed border-border-strong bg-card text-muted-foreground',
                  )}
                >
                  <Icone />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={cn(
                      'type-label',
                      e === 'pendente' && 'text-muted-foreground',
                      e === 'atual' && 'font-semibold',
                    )}
                  >
                    {t(`status.${etapa}`)}
                  </span>
                  <span className="type-caption text-muted-foreground">
                    {t(`lotes.progresso.estados.${e}`)}
                    {em && e !== 'pendente' ? ` · ${formatDate(em)}` : ''}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
        <p className="type-caption text-muted-foreground">{t('lotes.progresso.etapasAjuda')}</p>
      </CardContent>
    </Card>
  )
}

/* ---------------------------------------------------------------- recebimento */

const SEM_PALLETS: PalletLote[] = []

function Recebimento({ o }: { o: Ordem }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState<TableQuery>(ORDEM_PALLETS)
  const pessoas = useMemo(
    () => [...new Set(o.pallets.map((p) => p.pesadoPor).filter(Boolean))].sort() as string[],
    [o.pallets],
  )
  const origens = useMemo(() => [...new Set(o.pallets.map((p) => p.origem))].sort(), [o.pallets])

  const colunas = useMemo<DataTableColumn<PalletLote>[]>(() => {
    const kg = (
      id: 'pesoKg' | 'taraKg' | 'pesoLiquidoKg',
      rotulo: 'peso' | 'tara' | 'pesoLiquido',
      valor: (r: PalletLote) => number | null,
    ): DataTableColumn<PalletLote> => ({
      id,
      header: t(`lotes.recebimento.cols.${rotulo}`),
      type: 'number',
      accessor: valor,
      size: 160,
      total: true,
      cell: (r) => {
        const v = valor(r)
        return <span className="num">{v === null ? EMPTY : `${formatNumber(v)} kg`}</span>
      },
    })
    return [
      {
        id: 'numero',
        header: t('lotes.recebimento.cols.numero'),
        type: 'number',
        accessor: (r) => r.numero,
        size: 120,
        mobile: 'title',
      },
      kg('pesoKg', 'peso', (r) => r.pesoKg),
      kg('taraKg', 'tara', (r) => r.taraKg),
      kg('pesoLiquidoKg', 'pesoLiquido', (r) => r.pesoLiquidoKg),
      {
        id: 'conteudo',
        header: t('lotes.recebimento.cols.conteudo'),
        type: 'unique-text',
        accessor: (r) => r.conteudo,
        size: 260,
      },
      {
        id: 'pesadoPor',
        header: t('lotes.recebimento.cols.pesadoPor'),
        type: 'enum',
        accessor: (r) => r.pesadoPor,
        size: 170,
        options: pessoas.map((p) => ({ value: p, label: p })),
      },
      {
        id: 'pesadoEm',
        header: t('lotes.recebimento.cols.pesadoEm'),
        type: 'date',
        accessor: (r) => r.pesadoEm,
        size: 170,
        cell: (r) => <span className="num">{formatDateTime(r.pesadoEm)}</span>,
        exportValue: (r) => formatDateTime(r.pesadoEm),
      },
      {
        id: 'foto',
        header: t('lotes.recebimento.cols.foto'),
        type: 'number',
        accessor: (r) => r.fotos.length + (r.temFoto ? 1 : 0),
        size: 160,
        sortable: false,
        cell: (r) => {
          const titulo = t('lotes.recebimento.fotoTitulo', { numero: r.numero, lote: o.codigo })
          if (!r.fotos.length && !r.temFoto) return EMPTY
          return (
            <span className="flex items-center gap-1">
              {r.temFoto && (
                <FotoMiniatura className="size-9" src={urlFotoPallet(o.id, r.id)} titulo={titulo} />
              )}
              {r.fotos.map((f, i) => (
                <FotoMiniatura
                  key={f.id}
                  className="size-9"
                  src={urlFotoRecebimento(o.id, f.id)}
                  titulo={`${titulo} (${i + 1})`}
                />
              ))}
            </span>
          )
        },
      },
      {
        id: 'origem',
        header: t('lotes.recebimento.cols.origem'),
        type: 'enum',
        accessor: (r) => r.origem,
        size: 140,
        hidden: true,
        options: origens.map((x) => ({ value: x, label: x })),
      },
    ]
  }, [t, o.id, o.codigo, pessoas, origens])

  return (
    <section aria-labelledby="lote-recebimento-titulo" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="lote-recebimento-titulo" className="type-section-title">
          {t('lotes.recebimento.titulo')}
        </h2>
        <p className="type-caption text-muted-foreground">{t('lotes.recebimento.ajuda')}</p>
      </div>
      <DataTable
        id="lote-recebimento"
        title={t('lotes.recebimento.titulo')}
        columns={colunas}
        getRowId={(r) => r.id}
        data={o.pallets.length ? o.pallets : SEM_PALLETS}
        query={query}
        onQueryChange={setQuery}
        exportName={`recebimento-${o.codigo}`}
        empty={{
          title: t('lotes.recebimento.vazioTitle'),
          description: t('lotes.recebimento.vazioBody'),
        }}
      />
    </section>
  )
}

/* ---------------------------------------------------------------- dados do recebimento */

function DadosRecebimento({ o }: { o: Ordem }) {
  const { t } = useTranslation()
  const r = o.recebimento!
  const fotos = (lista: FotoRecebimento[], titulo: string) =>
    lista.length ? (
      <span className="flex flex-wrap gap-1">
        {lista.map((f, i) => (
          <FotoMiniatura
            key={f.id}
            className="size-10"
            src={urlFotoRecebimento(o.id, f.id)}
            titulo={lista.length > 1 ? `${titulo} (${i + 1})` : titulo}
          />
        ))}
      </span>
    ) : null
  const itens = (lista: ItemRecebimento[], rotulo: 'lacre' | 'nota') =>
    lista.length ? (
      <ul className="flex flex-col gap-2">
        {lista.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{x.numero}</span>
            {fotos(x.fotos, t(`lotes.recebimento.fotoDe_${rotulo}`, { numero: x.numero }))}
          </li>
        ))}
      </ul>
    ) : null

  return (
    <Card role="region" aria-labelledby="lote-dados-recebimento">
      <CardHeader>
        <CardTitle id="lote-dados-recebimento">{t('lotes.recebimento.dadosTitulo')}</CardTitle>
      </CardHeader>
      <CardContent>
        <KeyValueList
          columns={3}
          items={[
            {
              label: t('recebimento.campos.dataRecebimento'),
              value: formatDate(r.dataRecebimento),
            },
            {
              label: t('recebimento.campos.inspecao'),
              value: <StatusBadge status={`inspecao_${r.inspecao}`} />,
            },
            {
              label: t('lotes.recebimento.recebidoPor'),
              value: `${r.criadoPor} · ${formatDateTime(r.criadoEm)}`,
            },
            ...(r.inspecaoDescricao
              ? [
                  {
                    label: t('recebimento.campos.descricao'),
                    value: <TextoTraduzido valor={r.inspecaoDescricao} />,
                    full: true,
                  },
                ]
              : []),
            { label: t('recebimento.secoes.lacres'), value: itens(r.lacres, 'lacre') },
            { label: t('recebimento.secoes.notas'), value: itens(r.notas, 'nota') },
            {
              label: t('recebimento.secoes.fotosGerais'),
              value: fotos(r.fotosGerais, t('recebimento.secoes.fotosGerais')),
            },
          ]}
        />
      </CardContent>
    </Card>
  )
}
