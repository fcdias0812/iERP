import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'

export interface SettingsSection {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  content: ReactNode
}

interface SettingsLayoutProps {
  title: string
  description?: string
  sections: SettingsSection[]
  active: string
  onActiveChange: (id: string) => void
}

/**
 * PADRÃO CONFIGURAÇÕES: menu de seções à esquerda, formulário à direita.
 * No celular o menu vira uma faixa rolável no topo.
 */
export function SettingsLayout({
  title,
  description,
  sections,
  active,
  onActiveChange,
}: SettingsLayoutProps) {
  const current = sections.find((s) => s.id === active) ?? sections[0]
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label={title}>
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {sections.map((s) => {
              const Icon = s.icon
              const selected = s.id === current?.id
              return (
                <li key={s.id} className="shrink-0">
                  <button
                    type="button"
                    aria-current={selected ? 'page' : undefined}
                    onClick={() => onActiveChange(s.id)}
                    className={cn(
                      'flex h-control w-full cursor-pointer items-center gap-2 rounded-md px-3 text-left type-body whitespace-nowrap transition-colors duration-150',
                      selected
                        ? 'bg-selected font-medium text-selected-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
                    {s.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
        <section aria-label={current?.label} className="min-w-0">
          {current?.content}
        </section>
      </div>
    </div>
  )
}
