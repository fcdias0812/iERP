import * as React from 'react'
import * as Recharts from 'recharts'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'

/*
 * Gráficos (Recharts 3), no padrão do `chart` do shadcn/ui, simplificado:
 * as cores vêm de `config` e viram variáveis `--color-<chave>` no contêiner.
 * Use `var(--chart-1…8)` para séries de categoria; cores de estado
 * (`var(--success)`, `var(--danger)`…) só quando o gráfico diz bom/ruim.
 *
 *   const config = { receita: { label: 'Receita', color: 'var(--chart-1)' } }
 *   <ChartContainer config={config} className="h-64">
 *     <BarChart data={…}><Bar dataKey="receita" fill="var(--color-receita)" /></BarChart>
 *   </ChartContainer>
 */

export type ChartConfig = Record<string, { label: string; color: string }>

const ChartContext = React.createContext<ChartConfig | null>(null)

function useChartConfig() {
  const ctx = React.useContext(ChartContext)
  if (!ctx) throw new Error('useChartConfig deve ser usado dentro de <ChartContainer>')
  return ctx
}

interface ChartContainerProps extends React.ComponentProps<'div'> {
  config: ChartConfig
  children: React.ComponentProps<typeof Recharts.ResponsiveContainer>['children']
  /** Descrição do gráfico para leitores de tela (o que ele mostra). */
  'aria-label': string
}

/** Contêiner responsivo. Dê uma altura (`h-64`, `aspect-video`) para medir no 1º render. */
export function ChartContainer({
  config,
  className,
  children,
  style,
  ...props
}: ChartContainerProps) {
  const vars = Object.fromEntries(
    Object.entries(config).map(([key, c]) => [`--color-${key}`, c.color]),
  ) as React.CSSProperties
  return (
    <ChartContext.Provider value={config}>
      <div
        role="img"
        data-slot="chart"
        style={{ ...vars, ...style }}
        className={cn(
          'w-full type-caption num [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border-strong [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke]]:stroke-border [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke]]:stroke-card [&_.recharts-surface]:outline-hidden',
          className,
        )}
        {...props}
      >
        <Recharts.ResponsiveContainer initialDimension={{ width: 320, height: 200 }}>
          {children}
        </Recharts.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

type ValueFormatter = (value: number) => string

interface TooltipPayloadItem {
  dataKey?: string | number
  name?: string | number
  value?: number | string | (number | string)[]
  color?: string
  payload?: Record<string, unknown>
}

/** Conteúdo do tooltip com o rótulo da série e o valor formatado. */
export function ChartTooltipContent({
  active,
  payload,
  label,
  valueFormatter = (v) => formatNumber(v),
  labelFormatter,
}: {
  active?: boolean
  payload?: readonly TooltipPayloadItem[]
  label?: string | number
  valueFormatter?: ValueFormatter
  labelFormatter?: (label: string) => string
}) {
  const config = useChartConfig()
  if (!active || !payload?.length) return null
  return (
    <div className="grid min-w-36 gap-1.5 rounded-lg border bg-popover px-3 py-2 type-caption text-popover-foreground shadow-popover">
      {label !== undefined && label !== '' && (
        <p className="font-medium">{labelFormatter ? labelFormatter(String(label)) : label}</p>
      )}
      {payload.map((item, i) => {
        const c = config[String(item.dataKey)] ?? config[String(item.name)]
        const value =
          typeof item.value === 'number' ? valueFormatter(item.value) : String(item.value)
        return (
          <div key={i} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: c?.color ?? item.color }}
              aria-hidden
            />
            <span className="text-muted-foreground">{c?.label ?? item.name}</span>
            <span className="ml-auto font-medium text-foreground num">{value}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Legenda com os rótulos do `config`. */
export function ChartLegendContent({
  payload,
}: {
  payload?: readonly { dataKey?: unknown; value?: unknown; color?: string }[]
}) {
  const config = useChartConfig()
  if (!payload?.length) return null
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-3">
      {payload.map((item, i) => {
        // Séries: a chave é o dataKey; pizza/rosca: o nome da fatia vem em `value`.
        const c = config[String(item.dataKey)] ?? config[String(item.value)]
        return (
          <li key={i} className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: c?.color ?? item.color }}
              aria-hidden
            />
            {c?.label ?? String(item.value)}
          </li>
        )
      })}
    </ul>
  )
}
