import { lazy, Suspense, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { addDays, addMonths, endOfMonth, format, startOfMonth, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Hourglass, MapPinOff, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage } from '@/lib/api-errors'
import {
  formatDate,
  formatDayMonth,
  formatMonthYear,
  formatNumber,
  formatPercent,
  formatTime,
  formatWeekday,
} from '@/lib/format'
import { toneStyles, type StatusTone } from '@/lib/status/tones'
import { cn } from '@/lib/utils'
import { dashboardKeys, obterDashboardOperacao } from '@/services/dashboard'
import type { DashboardOperacao } from '@/services/types'
import { AnomaliasPrazo } from './AnomaliasPrazo'
import { TEM_SATELITE, type FundoMapa } from './mapa-config'
import { SituacaoPorCliente } from './SituacaoPorCliente'

/*
 * Operação › Dashboard: cards, previsão de chegada (7 dias), mapa dos datacenters Microsoft,
 * situação por cliente (SLA), anomalias de prazo e processos de alto valor. Relê a cada 30 s.
 * Sem integração com os sistemas de produção, quase tudo aparece zerado.
 */

const MapaColetas = lazy(() => import('./MapaColetas'))
const RELER_MS = 30_000
const META = 0.95

type Periodo = 'dia' | 'semana' | 'mes'

const dia = (d: Date) => format(d, 'yyyy-MM-dd')
const deDia = (s: string) => new Date(`${s}T12:00:00`)

/** Início e fim do período do mapa (semana de domingo a sábado). */
function intervalo(periodo: Periodo, ref: string) {
  const d = deDia(ref)
  if (periodo === 'dia') return { de: ref, ate: ref }
  if (periodo === 'semana') {
    const ini = startOfWeek(d, { weekStartsOn: 0 })
    return { de: dia(ini), ate: dia(addDays(ini, 6)) }
  }
  return { de: dia(startOfMonth(d)), ate: dia(endOfMonth(d)) }
}

function andar(periodo: Periodo, ref: string, passo: 1 | -1) {
  const d = deDia(ref)
  if (periodo === 'dia') return dia(addDays(d, passo))
  if (periodo === 'semana') return dia(addDays(d, 7 * passo))
  return dia(addMonths(d, passo))
}

export function DashboardOperacaoPage() {
  return (
    <RequirePermission permission="operacao.ver">
      <Dashboard />
    </RequirePermission>
  )
}

function Dashboard() {
  const { t } = useTranslation()
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const [ref, setRef] = useState(() => dia(new Date()))
  const { de, ate } = intervalo(periodo, ref)
  const q = useQuery({
    queryKey: dashboardKeys.operacao(de, ate),
    queryFn: ({ signal }) => obterDashboardOperacao(de, ate, signal),
    refetchInterval: RELER_MS,
    placeholderData: keepPreviousData,
  })
  const d = q.data

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('operacao.dashboard.title')}
        description={
          d
            ? t('operacao.dashboard.atualizado', { hora: formatTime(d.atualizadoEm) })
            : t('operacao.dashboard.description')
        }
        actions={
          <Button variant="secondary" onClick={() => void q.refetch()} loading={q.isFetching}>
            {!q.isFetching && <RefreshCw aria-hidden />}
            {t('operacao.dashboard.atualizar')}
          </Button>
        }
      />
      {q.isError && !d && (
        <Alert tone="danger" title={t('apiErrors.server')}>
          {apiErrorMessage(q.error)}
        </Alert>
      )}
      <Cards d={d} />
      <Forecast d={d} />
      <Mapa
        d={d}
        periodo={periodo}
        de={de}
        ate={ate}
        onPeriodo={(p) => setPeriodo(p)}
        onAndar={(passo) => setRef(andar(periodo, ref, passo))}
        onHoje={() => setRef(dia(new Date()))}
      />
      <SituacaoPorCliente linhas={d?.porCliente} carregando={q.isPending} />
      <AnomaliasPrazo lotes={d?.lotes} carregando={q.isPending} />
      <AltoValor />
    </div>
  )
}

/* ------------------------------------------------------------ cards */

function Indicador({
  titulo,
  valor,
  unidade,
  detalhe,
  tom,
  carregando,
}: {
  titulo: string
  valor: string
  unidade?: string
  detalhe: string
  tom?: StatusTone
  carregando: boolean
}) {
  return (
    <Card className="gap-2 p-4">
      <p className="type-label text-muted-foreground">{titulo}</p>
      {carregando ? (
        <Skeleton className="h-9 w-24" />
      ) : (
        <p className="flex items-baseline gap-1.5">
          <span className={cn('type-display num', tom && toneStyles[tom].text)}>{valor}</span>
          {unidade && <span className="type-body text-muted-foreground">{unidade}</span>}
        </p>
      )}
      <p className="type-caption text-muted-foreground">{detalhe}</p>
    </Card>
  )
}

function Cards({ d }: { d?: DashboardOperacao }) {
  const { t } = useTranslation()
  const c = d?.cards
  const k = (x: string) => `operacao.dashboard.cards.${x}` as const
  const n = (v: number | undefined) => (v === undefined ? '—' : formatNumber(v))
  const cumprimento = c?.cumprimentoSla30d ?? null
  return (
    <section
      aria-label={t('operacao.dashboard.title')}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
    >
      <Indicador
        titulo={t(k('chegadas.titulo') as 'operacao.dashboard.cards.chegadas.titulo')}
        valor={n(c?.chegadasPrevistas7d)}
        unidade={t('operacao.dashboard.cards.chegadas.unidade')}
        detalhe={t('operacao.dashboard.cards.chegadas.detalhe')}
        carregando={!c}
      />
      <Indicador
        titulo={t('operacao.dashboard.cards.emProcesso.titulo')}
        valor={n(c?.emProcesso.total)}
        unidade={t('operacao.dashboard.cards.emProcesso.unidade')}
        detalhe={t('operacao.dashboard.cards.emProcesso.detalhe', {
          inspecao: n(c?.emProcesso.inspecao),
          processo: n(c?.emProcesso.processo),
          cod: n(c?.emProcesso.aguardandoCod),
        })}
        carregando={!c}
      />
      <Indicador
        titulo={t('operacao.dashboard.cards.vencido.titulo')}
        valor={n(c?.slaVencido)}
        unidade={t('operacao.dashboard.cards.vencido.unidade')}
        detalhe={t('operacao.dashboard.cards.vencido.detalhe')}
        tom={c?.slaVencido ? 'danger' : undefined}
        carregando={!c}
      />
      <Indicador
        titulo={t('operacao.dashboard.cards.risco.titulo')}
        valor={n(c?.slaEmRisco)}
        unidade={t('operacao.dashboard.cards.risco.unidade')}
        detalhe={t('operacao.dashboard.cards.risco.detalhe')}
        tom={c?.slaEmRisco ? 'warning' : undefined}
        carregando={!c}
      />
      <Indicador
        titulo={t('operacao.dashboard.cards.cumprimento.titulo')}
        valor={formatPercent(cumprimento, 0)}
        detalhe={
          cumprimento === null
            ? t('operacao.dashboard.cards.cumprimento.semDado')
            : t('operacao.dashboard.cards.cumprimento.detalhe')
        }
        tom={cumprimento === null ? undefined : cumprimento >= META ? 'success' : 'alert'}
        carregando={!c}
      />
      <Indicador
        titulo={t('operacao.dashboard.cards.cod.titulo')}
        valor={n(c?.codPendente)}
        unidade={t('operacao.dashboard.cards.cod.unidade')}
        detalhe={t('operacao.dashboard.cards.cod.detalhe')}
        carregando={!c}
      />
    </section>
  )
}

/* ------------------------------------------------------------ previsão de chegada */

function Forecast({ d }: { d?: DashboardOperacao }) {
  const { t } = useTranslation()
  const volumes = (l: DashboardOperacao['forecast'][number]['lotes'][number]) => {
    const partes = (['racks', 'pallets', 'gaylords', 'boxes'] as const)
      .filter((x) => l[x] > 0)
      .map((x) => t(`operacao.dashboard.forecast.${x}`, { n: formatNumber(l[x]) }))
    return partes.length ? partes.join(' · ') : t('operacao.dashboard.forecast.semVolume')
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('operacao.dashboard.forecast.titulo')}</CardTitle>
      </CardHeader>
      <CardContent>
        {!d ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {d.forecast.map((f) => {
              const hoje = f.dia === d.hoje
              const fimDeSemana = [0, 6].includes(deDia(f.dia).getDay())
              return (
                <li
                  key={f.dia}
                  aria-label={t('operacao.dashboard.forecast.diaRotulo', {
                    dia: formatDate(f.dia),
                    n: f.lotes.length,
                  })}
                  className={cn(
                    'flex min-h-40 flex-col gap-2 rounded-lg border p-2',
                    hoje ? 'border-primary bg-selected' : fimDeSemana ? 'bg-muted' : 'bg-card',
                  )}
                >
                  <p className="border-b pb-1 text-center">
                    <span className="block type-caption text-muted-foreground">
                      {hoje ? t('operacao.dashboard.forecast.hoje') : formatWeekday(f.dia)}
                    </span>
                    <span className="type-label num">{formatDayMonth(f.dia)}</span>
                  </p>
                  {f.lotes.length === 0 ? (
                    <p className="pt-2 text-center type-caption text-muted-foreground">
                      {t('operacao.dashboard.forecast.vazio')}
                    </p>
                  ) : (
                    f.lotes.map((l) => (
                      <Link
                        key={l.id}
                        to="/ordens/lotes"
                        search={{ q: l.codigo }}
                        className="flex flex-col rounded-md border bg-card p-2 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <span className="truncate type-label">{l.clienteNome}</span>
                        <span className="truncate type-caption text-muted-foreground">
                          <span className="font-mono">{l.siteCodigo}</span> ·{' '}
                          <span className="font-mono">{l.codigo}</span>
                        </span>
                        <span className="type-caption num">{volumes(l)}</span>
                      </Link>
                    ))
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------ mapa */

function Mapa({
  d,
  periodo,
  de,
  ate,
  onPeriodo,
  onAndar,
  onHoje,
}: {
  d?: DashboardOperacao
  periodo: Periodo
  de: string
  ate: string
  onPeriodo: (p: Periodo) => void
  onAndar: (passo: 1 | -1) => void
  onHoje: () => void
}) {
  const { t } = useTranslation()
  const [fundo, setFundo] = useState<FundoMapa>('limpo')
  const pontos = useMemo(() => d?.mapa.pontos ?? [], [d?.mapa.pontos])
  const total = pontos.reduce((s, p) => s + p.coletas, 0)
  const rotuloPeriodo =
    periodo === 'dia'
      ? formatDate(de)
      : periodo === 'semana'
        ? `${formatDayMonth(de)} – ${formatDayMonth(ate)}`
        : formatMonthYear(de)
  const fundos: FundoMapa[] = TEM_SATELITE ? ['limpo', 'cinza', 'satelite'] : ['limpo', 'cinza']

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <CardTitle>
          {t('operacao.dashboard.mapa.titulo')} ·{' '}
          <span className="text-muted-foreground">
            {total
              ? t('operacao.dashboard.mapa.coletas', { n: formatNumber(total) })
              : t('operacao.dashboard.mapa.nenhumaColeta')}
          </span>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonGroup aria-label={t('operacao.dashboard.mapa.periodo')}>
            {(['dia', 'semana', 'mes'] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={periodo === p ? 'default' : 'secondary'}
                aria-pressed={periodo === p}
                onClick={() => onPeriodo(p)}
              >
                {t(`operacao.dashboard.mapa.periodos.${p}`)}
              </Button>
            ))}
          </ButtonGroup>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t('operacao.dashboard.mapa.anterior')}
            onClick={() => onAndar(-1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span className="min-w-28 text-center type-label num" aria-live="polite">
            {rotuloPeriodo}
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t('operacao.dashboard.mapa.proximo')}
            onClick={() => onAndar(1)}
          >
            <ChevronRight aria-hidden />
          </Button>
          <Button size="sm" variant="secondary" onClick={onHoje}>
            {t('operacao.dashboard.mapa.hoje')}
          </Button>
          <ButtonGroup aria-label={t('operacao.dashboard.mapa.fundo')}>
            {fundos.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={fundo === f ? 'default' : 'secondary'}
                aria-pressed={fundo === f}
                onClick={() => setFundo(f)}
              >
                {t(`operacao.dashboard.mapa.fundos.${f}`)}
              </Button>
            ))}
          </ButtonGroup>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {d && !d.mapa.clienteEncontrado && (
          <Alert tone="info" title={t('operacao.dashboard.mapa.semCliente')} />
        )}
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <MapaColetas pontos={pontos} fundo={fundo} rotulo={t('operacao.dashboard.mapa.rotulo')} />
        </Suspense>
        {pontos.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label={t('operacao.dashboard.mapa.titulo')}>
            {pontos.map((p) => (
              <li key={p.siteId} className="rounded-md border px-2 py-1 type-caption num">
                {t('operacao.dashboard.mapa.coletasSite', {
                  site: p.siteCodigo,
                  n: formatNumber(p.coletas),
                })}
              </li>
            ))}
          </ul>
        ) : (
          d?.mapa.clienteEncontrado && (
            <p className="type-caption text-muted-foreground">
              {t('operacao.dashboard.mapa.semPontos')}
            </p>
          )
        )}
        {d && d.mapa.semLocalizacao.length > 0 && (
          <p className="flex items-center gap-2 type-caption text-muted-foreground">
            <MapPinOff className="size-4 shrink-0" aria-hidden />
            {t('operacao.dashboard.mapa.semLocalizacao', {
              sites: d.mapa.semLocalizacao.map((s) => s.siteCodigo).join(', '),
            })}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------ processos de alto valor */

function AltoValor() {
  const { t } = useTranslation()
  const blocos = [
    { id: 'harvesting', aguardando: 'aguardandoChamados' },
    { id: 'refurbish', aguardando: 'aguardandoItad' },
    { id: 'valueRecovery', aguardando: 'aguardandoItad' },
  ] as const
  return (
    <section aria-labelledby="alto-valor-titulo" className="flex flex-col gap-3">
      <h2 id="alto-valor-titulo" className="type-section-title">
        {t('operacao.dashboard.altoValor.titulo')}
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {blocos.map((b) => (
          <Card key={b.id}>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle>{t(`operacao.dashboard.altoValor.${b.id}.titulo`)}</CardTitle>
              <p className="type-caption text-muted-foreground">
                {t(`operacao.dashboard.altoValor.${b.id}.sub`)}
              </p>
            </CardHeader>
            <CardContent>
              <EmptyState
                size="sm"
                icon={<Hourglass />}
                title={t(`operacao.dashboard.altoValor.${b.aguardando}.titulo`)}
                description={t(`operacao.dashboard.altoValor.${b.aguardando}.corpo`)}
                className="rounded-lg border border-dashed"
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
