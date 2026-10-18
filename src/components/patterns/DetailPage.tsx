import type { ReactNode } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export interface DetailTab {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  /** Contador ao lado do rótulo (itens, anexos, comentários). */
  count?: number
  content: ReactNode
}

interface DetailPageProps {
  title: string
  description?: string
  /** Selo de status (StatusBadge). */
  status?: ReactNode
  /** Ações principais à direita (a mais importante por último). */
  actions?: ReactNode
  /** Linha de metadados abaixo do título (código copiável, criado/alterado por…). */
  meta?: ReactNode
  /** Avisos do registro (Alert) entre o cabeçalho e as abas. */
  alerts?: ReactNode
  tabs: DetailTab[]
  /** Aba controlada (ex.: vinda da URL). */
  tab?: string
  onTabChange?: (tab: string) => void
}

/**
 * PADRÃO DETALHE: cabeçalho com status e ações + abas
 * (Dados, Itens, Anexos, Comentários, Histórico).
 */
export function DetailPage({
  title,
  description,
  status,
  actions,
  meta,
  alerts,
  tabs,
  tab,
  onTabChange,
}: DetailPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} status={status} actions={actions}>
        {meta}
      </PageHeader>
      {alerts}
      <Tabs value={tab} defaultValue={tab ? undefined : tabs[0]?.id} onValueChange={onTabChange}>
        <TabsList>
          {tabs.map((t) => {
            const Icon = t.icon
            return (
              <TabsTrigger key={t.id} value={t.id}>
                {Icon && <Icon aria-hidden />}
                {t.label}
                {t.count !== undefined && <Badge>{t.count}</Badge>}
              </TabsTrigger>
            )
          })}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent key={t.id} value={t.id}>
            {t.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
