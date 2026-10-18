import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'

export interface KanbanColumn {
  id: string
  title: string
  /** Limite de cartões (WIP); passar do limite destaca o contador em laranja. */
  limit?: number
}

export interface KanbanCard {
  id: string
  columnId: string
}

interface KanbanProps<T extends KanbanCard> {
  columns: KanbanColumn[]
  cards: T[]
  onChange: (cards: T[]) => void
  renderCard: (card: T) => React.ReactNode
  /** Texto do cartão para os anúncios de leitor de tela. */
  getCardLabel: (card: T) => string
  className?: string
}

/**
 * Quadro kanban com arrastar e soltar (mouse, toque e TECLADO):
 * Tab até o cartão → Espaço pega → setas movem (entre colunas também) → Espaço solta, Esc cancela.
 * Cada movimento é anunciado para leitores de tela.
 */
export function Kanban<T extends KanbanCard>({
  columns,
  cards,
  onChange,
  renderCard,
  getCardLabel,
  className,
}: KanbanProps<T>) {
  const { t } = useTranslation()
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const byId = (id: string | number) => cards.find((c) => c.id === id)
  const columnOf = (id: string | number): string | undefined =>
    columns.some((c) => c.id === id) ? String(id) : byId(id)?.columnId
  const colTitle = (id?: string) => columns.find((c) => c.id === id)?.title ?? ''

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  // Ao passar sobre outra coluna, o cartão muda de coluna já durante o arraste.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const from = columnOf(active.id)
    const to = columnOf(over.id)
    if (!from || !to || from === to) return
    const moved = cards.map((c) => (c.id === active.id ? { ...c, columnId: to } : c))
    const oldIndex = moved.findIndex((c) => c.id === active.id)
    const overIndex = moved.findIndex((c) => c.id === over.id)
    onChange(overIndex >= 0 ? arrayMove(moved, oldIndex, overIndex) : moved)
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = cards.findIndex((c) => c.id === active.id)
    const newIndex = cards.findIndex((c) => c.id === over.id)
    if (oldIndex >= 0 && newIndex >= 0) onChange(arrayMove(cards, oldIndex, newIndex))
  }

  const label = (id: string | number) => {
    const c = byId(id)
    return c ? getCardLabel(c) : ''
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t('kanban.picked', { card: label(active.id), column: colTitle(columnOf(active.id)) }),
    onDragOver: ({ active, over }) =>
      over
        ? t('kanban.over', { card: label(active.id), column: colTitle(columnOf(over.id)) })
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t('kanban.dropped', { card: label(active.id), column: colTitle(columnOf(over.id)) })
        : t('kanban.cancelled'),
    onDragCancel: () => t('kanban.cancelled'),
  }

  const active = activeId ? byId(activeId) : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t('kanban.instructions') },
      }}
    >
      {/* `relative`: textos sr-only (absolutos) não escapam da área com rolagem. */}
      <div className={cn('relative flex gap-3 overflow-x-auto pb-2', className)}>
        {columns.map((col) => (
          <Column
            key={col.id}
            column={col}
            cards={cards.filter((c) => c.columnId === col.id)}
            renderCard={renderCard}
            getCardLabel={getCardLabel}
          />
        ))}
      </div>
      <DragOverlay>
        {active ? (
          <div className="rotate-1 rounded-lg border bg-elevated p-3 shadow-modal">
            {renderCard(active)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function Column<T extends KanbanCard>({
  column,
  cards,
  renderCard,
  getCardLabel,
}: {
  column: KanbanColumn
  cards: T[]
  renderCard: (card: T) => React.ReactNode
  getCardLabel: (card: T) => string
}) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const over = column.limit !== undefined && cards.length > column.limit
  const headingId = React.useId()

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'flex w-72 shrink-0 flex-col gap-2 rounded-lg border bg-muted p-2 transition-colors duration-150',
        isOver && 'border-primary',
      )}
    >
      <header className="flex items-center justify-between gap-2 px-1 pt-1">
        <h3 id={headingId} className="type-label">
          {column.title}
        </h3>
        <span
          className={cn(
            'relative rounded-sm px-1.5 type-caption num',
            over ? 'bg-alert-subtle text-alert-subtle-foreground' : 'text-muted-foreground',
          )}
        >
          {formatNumber(cards.length)}
          {column.limit !== undefined && `/${column.limit}`}
          {over && <span className="sr-only"> — {t('kanban.overLimit')}</span>}
        </span>
      </header>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-16 flex-col gap-2">
          {cards.map((card) => (
            <SortableCard key={card.id} id={card.id} label={getCardLabel(card)}>
              {renderCard(card)}
            </SortableCard>
          ))}
          {cards.length === 0 && (
            <li className="rounded-md border border-dashed border-border-strong px-3 py-6 text-center type-caption text-muted-foreground">
              {t('kanban.empty')}
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  )
}

function SortableCard({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex items-start gap-1 rounded-lg border bg-card p-3 shadow-card',
        isDragging && 'opacity-40',
      )}
    >
      <button
        type="button"
        aria-label={label}
        className="-ml-1 flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-sm text-muted-foreground hover:bg-accent active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  )
}
