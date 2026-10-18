import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Area, AreaChart } from 'recharts'
import { cn } from '@/lib/utils'
import { formatPercent } from '@/lib/format'
import { ChartContainer } from './chart'
import { Skeleton } from './skeleton'

interface KpiCardProps {
  label: string
  /** Valor já formatado (use src/lib/format.ts). */
  value: string
  /** Variação em fração (0.12 = +12%). */
  change?: number
  /** O que é bom: subir (receita) ou descer (prazo, custo). Define o tom da variação. */
  goodWhen?: 'up' | 'down'
  /** Texto de comparação, ex.: "vs. mês anterior". */
  changeLabel?: string
  /** Série para o mini gráfico. */
  trend?: number[]
  loading?: boolean
  className?: string
}

/**
 * Card de indicador: valor grande (`type-display num`), variação com seta e tom
 * (verde = bom, laranja = ruim, cinza = estável) e mini gráfico.
 */
export function KpiCard({
  label,
  value,
  change,
  goodWhen = 'up',
  changeLabel,
  trend,
  loading,
  className,
}: KpiCardProps) {
  const { t } = useTranslation()
  const id = React.useId().replace(/:/g, '')

  if (loading) {
    return (
      <div
        className={cn('flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-card', className)}
        aria-busy
      >
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-24" />
      </div>
    )
  }

  const direction =
    change === undefined || Math.abs(change) < 0.0005 ? 'flat' : change > 0 ? 'up' : 'down'
  const good = direction !== 'flat' && direction === goodWhen
  const toneClass =
    direction === 'flat'
      ? 'text-inactive-subtle-foreground'
      : good
        ? 'text-success-subtle-foreground'
        : 'text-alert-subtle-foreground'
  const Arrow =
    direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : ArrowRight
  const trendColor =
    direction === 'flat' ? 'var(--chart-5)' : good ? 'var(--success)' : 'var(--alert)'

  return (
    <div className={cn('flex flex-col gap-1 rounded-lg border bg-card p-4 shadow-card', className)}>
      <p className="type-label text-muted-foreground">{label}</p>
      {/* flex-wrap: em telas estreitas o mini gráfico desce para a linha de baixo. */}
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 type-display break-words num">{value}</p>
        {trend && trend.length > 1 && (
          <ChartContainer
            config={{ v: { label, color: trendColor } }}
            className="h-10 w-24 shrink-0"
            aria-label={t('kpi.trend', { label })}
          >
            <AreaChart
              data={trend.map((v, i) => ({ i, v }))}
              margin={{ top: 2, bottom: 2, left: 0, right: 0 }}
            >
              <defs>
                <linearGradient id={`kpi-${id}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--color-v)" stopOpacity={0.25} />
                  <stop offset="1" stopColor="var(--color-v)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                dataKey="v"
                type="monotone"
                stroke="var(--color-v)"
                strokeWidth={2}
                fill={`url(#kpi-${id})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </div>
      {change !== undefined && (
        <p className="flex flex-wrap items-center gap-1 type-caption">
          <span className={cn('inline-flex items-center gap-0.5 font-medium', toneClass)}>
            <Arrow className="size-3.5" aria-hidden />
            <span className="num">
              {direction === 'up' ? '+' : ''}
              {formatPercent(change)}
            </span>
            <span className="sr-only">
              {direction === 'flat' ? t('kpi.flat') : good ? t('kpi.good') : t('kpi.bad')}
            </span>
          </span>
          {changeLabel && <span className="text-muted-foreground">{changeLabel}</span>}
        </p>
      )}
    </div>
  )
}
