import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleAlert, CircleCheck, Clock } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { EmptyState } from '@/components/ui/empty-state'
import { formatMonthShort, formatNumber, formatPercent } from '@/lib/format'
import type { PainelCliente } from '@/services/types'

/*
 * Os gráficos do painel do cliente (aba Visão geral, 27/10/2026). Cores de categoria
 * `chart-1…8`; verde/vermelho só no prazo (bom/ruim). Cada gráfico tem a descrição em texto
 * para leitores de tela.
 */

const kg = (v: number) => `${formatNumber(v, { maximumFractionDigits: 1 })} kg`
/** Os 7 maiores materiais e o resto em "Outros" (a pizza fica legível). */
const MAX_FATIAS = 7

function Grafico({
  titulo,
  descricao,
  vazio,
  className,
  children,
}: {
  titulo: string
  descricao?: string
  vazio: string | null
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>{titulo}</CardTitle>
          {descricao && <CardDescription>{descricao}</CardDescription>}
        </div>
      </CardHeader>
      <CardContent>{vazio ? <EmptyState size="sm" title={vazio} /> : children}</CardContent>
    </Card>
  )
}

/** Lotes do período pela etapa em que estão. */
export function GraficoEtapas({ p }: { p: PainelCliente }) {
  const { t } = useTranslation()
  const dados = p.etapas.map((e) => ({ nome: t(`status.${e.etapa}`), lotes: e.lotes }))
  const config: ChartConfig = {
    lotes: { label: t('clientes.painel.lotes'), color: 'var(--chart-1)' },
  }
  return (
    <Grafico
      titulo={t('clientes.painel.etapasTitulo')}
      descricao={t('clientes.painel.etapasDescricao')}
      vazio={p.numeros.lotes ? null : t('clientes.painel.semLotesPeriodo')}
    >
      <ChartContainer
        config={config}
        className="h-64"
        aria-label={t('clientes.painel.aria.etapas', {
          lista: dados.map((d) => `${d.nome}: ${formatNumber(d.lotes)}`).join(', '),
        })}
      >
        <BarChart data={dados} margin={{ left: -16, right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="nome" tickLine={false} axisLine={false} interval={0} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey="lotes" fill="var(--color-lotes)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </Grafico>
  )
}

/** Mês a mês: kg recebidos (barras) e lotes coletados (linha). */
export function GraficoMeses({ p }: { p: PainelCliente }) {
  const { t } = useTranslation()
  const dados = p.porMes.map((m) => ({ ...m, rotulo: formatMonthShort(`${m.mes}-15`) }))
  const vazio = dados.every((m) => !m.kg && !m.lotes)
  const config: ChartConfig = {
    kg: { label: t('clientes.painel.kgRecebidos'), color: 'var(--chart-1)' },
    lotes: { label: t('clientes.painel.lotesColetados'), color: 'var(--chart-3)' },
  }
  return (
    <Grafico
      titulo={t('clientes.painel.mesesTitulo')}
      descricao={t('clientes.painel.mesesDescricao')}
      vazio={vazio ? t('clientes.painel.semLotesPeriodo') : null}
    >
      <ChartContainer
        config={config}
        className="h-64"
        aria-label={t('clientes.painel.aria.meses', {
          lista: dados
            .filter((m) => m.kg || m.lotes)
            .map(
              (m) =>
                `${m.rotulo}: ${kg(m.kg)}, ${t('clientes.painel.nLotes', { n: formatNumber(m.lotes) })}`,
            )
            .join('; '),
        })}
      >
        <ComposedChart data={dados} margin={{ left: -8, right: -8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="rotulo" tickLine={false} axisLine={false} minTickGap={8} />
          <YAxis
            yAxisId="kg"
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatNumber(v, { notation: 'compact' })}
          />
          <YAxis
            yAxisId="lotes"
            orientation="right"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={
              <ChartTooltipContent
                valueFormatter={(v) => formatNumber(v, { maximumFractionDigits: 1 })}
              />
            }
          />
          <Legend content={<ChartLegendContent />} />
          <Bar yAxisId="kg" dataKey="kg" fill="var(--color-kg)" radius={[4, 4, 0, 0]} />
          <Line
            yAxisId="lotes"
            dataKey="lotes"
            type="monotone"
            stroke="var(--color-lotes)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ChartContainer>
    </Grafico>
  )
}

/** Material apurado no balanço de massa (kg). */
export function GraficoMateriais({ p }: { p: PainelCliente }) {
  const { t } = useTranslation()
  const maiores = p.materiais.slice(0, MAX_FATIAS)
  const resto = p.materiais.slice(MAX_FATIAS).reduce((a, m) => a + m.kg, 0)
  const fatias = [
    ...maiores.map((m) => ({ rotulo: m.rotulo, kg: m.kg })),
    ...(resto ? [{ rotulo: t('clientes.painel.outros'), kg: resto }] : []),
  ].map((m, i) => ({ ...m, chave: `m${i}`, fill: `var(--chart-${i + 1})` }))
  const config: ChartConfig = Object.fromEntries(
    fatias.map((f) => [f.chave, { label: f.rotulo, color: f.fill }]),
  )
  return (
    <Grafico
      titulo={t('clientes.painel.materiaisTitulo')}
      descricao={t('clientes.painel.materiaisDescricao')}
      vazio={fatias.length ? null : t('clientes.painel.semMateriais')}
    >
      <ChartContainer
        config={config}
        className="h-72"
        aria-label={t('clientes.painel.aria.materiais', {
          lista: fatias.map((f) => `${f.rotulo}: ${kg(f.kg)}`).join(', '),
        })}
      >
        <PieChart>
          <Tooltip content={<ChartTooltipContent valueFormatter={kg} />} />
          <Pie
            data={fatias}
            dataKey="kg"
            nameKey="chave"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={1}
          />
          <Legend content={<ChartLegendContent />} />
        </PieChart>
      </ChartContainer>
    </Grafico>
  )
}

/** Ocorrências do período por tipo. */
export function GraficoOcorrencias({ p }: { p: PainelCliente }) {
  const { t } = useTranslation()
  const dados = p.ocorrencias.map((o) => ({
    nome: t(`lotes.ocorrencias.categorias.${o.categoria}`),
    total: o.total,
  }))
  const config: ChartConfig = {
    total: { label: t('clientes.painel.ocorrencias'), color: 'var(--chart-4)' },
  }
  return (
    <Grafico
      titulo={t('clientes.painel.ocorrenciasTitulo')}
      vazio={dados.length ? null : t('clientes.painel.semOcorrencias')}
    >
      <ChartContainer
        config={config}
        style={{ height: Math.max(120, dados.length * 40 + 24) }}
        aria-label={t('clientes.painel.aria.ocorrencias', {
          lista: dados.map((d) => `${d.nome}: ${formatNumber(d.total)}`).join(', '),
        })}
      >
        <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="nome" width={150} tickLine={false} axisLine={false} />
          <Tooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey="total" fill="var(--color-total)" radius={[0, 4, 4, 0]} barSize={20} />
        </BarChart>
      </ChartContainer>
    </Grafico>
  )
}

/** Prazo (SLA do cliente): concluídos no prazo × fora, tempo médio e atrasados agora. */
export function CartaoPrazo({ p }: { p: PainelCliente }) {
  const { t } = useTranslation()
  const { prazo } = p
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>{t('clientes.painel.prazoTitulo')}</CardTitle>
          <CardDescription>
            {prazo.slaDias
              ? t('clientes.painel.prazoDescricao', { n: formatNumber(prazo.slaDias) })
              : t('clientes.painel.semSla')}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="type-display num">{formatPercent(prazo.cumprimento)}</p>
          <p className="type-caption text-muted-foreground">{t('clientes.painel.cumprimento')}</p>
        </div>
        <ul className="flex flex-col gap-2 type-body">
          <li className="flex items-center gap-2">
            <CircleCheck aria-hidden className="size-4 text-success" />
            {t('clientes.painel.noPrazo')}
            <span className="ml-auto font-medium num">{formatNumber(prazo.noPrazo)}</span>
          </li>
          <li className="flex items-center gap-2">
            <CircleAlert aria-hidden className="size-4 text-danger" />
            {t('clientes.painel.foraDoPrazo')}
            <span className="ml-auto font-medium num">{formatNumber(prazo.foraDoPrazo)}</span>
          </li>
          <li className="flex items-center gap-2">
            <Clock aria-hidden className="size-4 text-muted-foreground" />
            {t('clientes.painel.tempoMedio')}
            <span className="ml-auto font-medium num">
              {prazo.tempoMedioDias === null
                ? '—'
                : t('clientes.painel.dias', {
                    n: formatNumber(prazo.tempoMedioDias, { maximumFractionDigits: 1 }),
                  })}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <CircleAlert
              aria-hidden
              className={
                prazo.atrasadosAgora ? 'size-4 text-alert' : 'size-4 text-muted-foreground'
              }
            />
            {t('clientes.painel.atrasadosAgora')}
            <span className="ml-auto font-medium num">{formatNumber(prazo.atrasadosAgora)}</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  )
}
