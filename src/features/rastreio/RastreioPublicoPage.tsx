import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Circle, CircleCheck, CircleDot, Link2Off, PackageSearch, Search } from 'lucide-react'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { StatusPage } from '@/components/patterns/StatusPages'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { EMPTY, formatDate, formatDateTime, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { obterRastreioPublico } from '@/services/clientes'
import { ApiError } from '@/services/http'
import type { LotePublico, StatusOrdem } from '@/services/types'
import { useUiStore, type Language } from '@/stores/ui-store'

/*
 * Página PÚBLICA de acompanhamento dos lotes de um cliente (/rastreio/:codigo — sem login; o
 * link é gerado na Visão geral do cliente). Pedido do usuário, 22/10/2026: "algo enxuto e de
 * rápida leitura. Nada grande" — um cartão por lote com a situação, as etapas, as datas e o
 * recebimento (pallets, peso bruto, lacres); 3 idiomas, começando pelo do navegador.
 */

const ETAPAS: StatusOrdem[] = ['agendado', 'inspecao', 'processo', 'aguardando_cod', 'concluido']
const IDIOMAS: Language[] = ['pt-BR', 'en', 'zh-TW']
type Filtro = 'andamento' | 'concluidos' | 'todos'

/** Primeira visita (sem preferência guardada): o idioma do navegador. */
function idiomaDoNavegador(): Language | null {
  try {
    if (localStorage.getItem('reteck-ui')) return null
  } catch {
    return null
  }
  const l = navigator.language.toLowerCase()
  return l.startsWith('zh') ? 'zh-TW' : l.startsWith('en') ? 'en' : null
}

export function RastreioPublicoPage() {
  const { token } = useParams({ from: '/rastreio/$token' })
  const { t } = useTranslation()
  const { language, setLanguage } = useUiStore()
  const [filtro, setFiltro] = useState<Filtro>('andamento')
  const [busca, setBusca] = useState('')
  const consulta = useQuery({
    queryKey: ['rastreio-publico', token],
    queryFn: ({ signal }) => obterRastreioPublico(token, signal),
    retry: (n, e) => !(e instanceof ApiError && e.isNotFound) && n < 2,
    refetchInterval: 5 * 60_000,
  })

  useEffect(() => {
    const l = idiomaDoNavegador()
    if (l) setLanguage(l)
  }, [setLanguage])

  const lotes = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (consulta.data?.lotes ?? []).filter(
      (l) =>
        (filtro === 'todos' || (filtro === 'concluidos') === (l.status === 'concluido')) &&
        (!termo ||
          l.codigo.toLowerCase().includes(termo) ||
          (l.referenciaCliente ?? '').toLowerCase().includes(termo)),
    )
  }, [consulta.data, filtro, busca])

  const invalido = consulta.error instanceof ApiError && consulta.error.isNotFound

  return (
    <div className="relative min-h-dvh bg-background">
      <div className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" aria-hidden />
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <BrandLogo variant="full" className="h-9" />
          <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
            <SelectTrigger aria-label={t('preferences.language')} className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IDIOMAS.map((l) => (
                <SelectItem key={l} value={l}>
                  {t(`languages.${l}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
        {invalido ? (
          <StatusPage
            className="py-16"
            icon={<Link2Off />}
            title={t('rastreioPublico.invalidoTitulo')}
            description={t('rastreioPublico.invalidoTexto')}
          />
        ) : consulta.isError ? (
          <Alert
            tone="danger"
            title={t('rastreioPublico.erro')}
            action={
              <Button variant="secondary" size="sm" onClick={() => void consulta.refetch()}>
                {t('common.tryAgain')}
              </Button>
            }
          />
        ) : consulta.isPending ? (
          <div className="flex flex-col gap-3" aria-busy>
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h1 className="type-page-title">{consulta.data.cliente}</h1>
              <p className="type-body text-muted-foreground">
                {t('rastreioPublico.titulo')} ·{' '}
                {t('rastreioPublico.atualizado', { data: formatDateTime(consulta.data.geradoEm) })}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div
                role="group"
                aria-label={t('rastreioPublico.mostrar')}
                className="inline-flex rounded-md border bg-card p-0.5"
              >
                {(['andamento', 'concluidos', 'todos'] as const).map((f) => (
                  <Button
                    key={f}
                    size="sm"
                    variant={filtro === f ? 'default' : 'ghost'}
                    aria-pressed={filtro === f}
                    onClick={() => setFiltro(f)}
                  >
                    {t(`rastreioPublico.filtros.${f}`)}
                  </Button>
                ))}
              </div>
              <div className="relative min-w-0 basis-full sm:max-w-xs sm:flex-1 sm:basis-auto">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  aria-label={t('rastreioPublico.buscar')}
                  placeholder={t('rastreioPublico.buscar')}
                  className="pl-9"
                />
              </div>
              <p className="type-caption text-muted-foreground num" aria-live="polite">
                {t('rastreioPublico.quantos', { n: lotes.length })}
              </p>
            </div>

            {lotes.length ? (
              <ul className="flex flex-col gap-3">
                {lotes.map((l) => (
                  <li key={l.codigo}>
                    <CartaoLote l={l} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<PackageSearch />}
                title={
                  consulta.data.lotes.length
                    ? t('rastreioPublico.vazioFiltro')
                    : t('rastreioPublico.vazio')
                }
              />
            )}
          </>
        )}
      </main>
      <footer className="pb-6 text-center type-caption text-muted-foreground">
        {t('rastreioPublico.rodape', { year: new Date().getFullYear() })}
      </footer>
    </div>
  )
}

function CartaoLote({ l }: { l: LotePublico }) {
  const { t } = useTranslation()
  const quando = new Map(l.etapas.map((e) => [e.etapa, e.em]))
  const atual = ETAPAS.indexOf(l.status)
  const fatos: { rotulo: string; valor: string }[] = [
    {
      rotulo: l.dataColeta ? t('rastreioPublico.coleta') : t('rastreioPublico.coletaPrevista'),
      valor: formatDate(l.dataColeta ?? l.coletaPrevista),
    },
    ...(l.recebidoEm
      ? [{ rotulo: t('rastreioPublico.chegada'), valor: formatDate(l.recebidoEm) }]
      : []),
    ...(l.pallets
      ? [{ rotulo: t('rastreioPublico.pallets'), valor: formatNumber(l.pallets) }]
      : []),
    ...(l.pesoBrutoKg !== null
      ? [{ rotulo: t('rastreioPublico.peso'), valor: `${formatNumber(l.pesoBrutoKg)} kg` }]
      : []),
    ...(l.lacres.length
      ? [{ rotulo: t('rastreioPublico.lacres'), valor: l.lacres.join(', ') }]
      : []),
  ]
  const p = l.processamento
  return (
    <article
      aria-label={l.codigo}
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-card"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-mono type-card-title">{l.codigo}</h2>
        {l.referenciaCliente && (
          <span className="type-caption text-muted-foreground">
            {t('rastreioPublico.referencia')}{' '}
            <span className="font-mono">{l.referenciaCliente}</span>
          </span>
        )}
        <StatusBadge status={l.status} className="ml-auto" />
      </div>

      {/* Etapas: feitas (verde), atual (azul) e por vir (cinza), com a data de cada uma. */}
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {ETAPAS.map((e, i) => {
          const feita = i < atual || l.status === 'concluido'
          const agora = i === atual && l.status !== 'concluido'
          const Icone = feita ? CircleCheck : agora ? CircleDot : Circle
          return (
            <li
              key={e}
              aria-current={agora ? 'step' : undefined}
              className="flex items-start gap-1.5"
            >
              <Icone
                aria-hidden
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  feita ? 'text-success' : agora ? 'text-info' : 'text-muted-foreground',
                )}
              />
              <span className="flex min-w-0 flex-col">
                <span className={cn('type-caption', agora && 'font-medium')}>
                  {t(`rastreioPublico.etapas.${e as 'agendado'}`)}
                </span>
                <span className="type-caption text-muted-foreground num">
                  {quando.has(e) ? formatDate(quando.get(e)) : EMPTY}
                </span>
              </span>
            </li>
          )
        })}
      </ol>

      {p && (
        <p className="type-body">
          {p.indice && p.total
            ? t('rastreioPublico.processamento', { i: p.indice, n: p.total, fase: p.etapa })
            : p.etapa}
        </p>
      )}

      <dl className="flex flex-wrap gap-x-6 gap-y-1">
        {fatos.map((f) => (
          <div key={f.rotulo} className="flex gap-1.5">
            <dt className="type-caption text-muted-foreground">{f.rotulo}</dt>
            <dd className="type-caption num">{f.valor}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}
