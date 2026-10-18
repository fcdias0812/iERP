import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TreeNode {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  children?: TreeNode[]
  /** Informação à direita (ex.: quantidade). */
  meta?: React.ReactNode
}

interface TreeProps {
  nodes: TreeNode[]
  /** Rótulo acessível da árvore. */
  label: string
  selectedId?: string
  onSelect?: (node: TreeNode) => void
  defaultExpanded?: string[]
  className?: string
}

interface Flat {
  node: TreeNode
  level: number
  parentId?: string
}

/**
 * Árvore (categorias, endereçamento, centros de custo) com padrão WAI-ARIA "tree":
 * ↑/↓ movem, → abre/entra, ← fecha/volta ao pai, Home/End, Enter/Espaço seleciona.
 */
export function Tree({
  nodes,
  label,
  selectedId,
  onSelect,
  defaultExpanded = [],
  className,
}: TreeProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set(defaultExpanded))
  const [focusId, setFocusId] = React.useState<string | undefined>(selectedId ?? nodes[0]?.id)
  const refs = React.useRef(new Map<string, HTMLLIElement>())

  // Itens visíveis na ordem da tela (para navegar pelo teclado).
  const visible: Flat[] = []
  const walk = (list: TreeNode[], level: number, parentId?: string) => {
    for (const node of list) {
      visible.push({ node, level, parentId })
      if (node.children && expanded.has(node.id)) walk(node.children, level + 1, node.id)
    }
  }
  walk(nodes, 1)

  const toggle = (id: string, open?: boolean) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (open ?? !next.has(id)) next.add(id)
      else next.delete(id)
      return next
    })

  const focus = (id: string | undefined) => {
    if (!id) return
    setFocusId(id)
    refs.current.get(id)?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent, flat: Flat) => {
    const i = visible.findIndex((v) => v.node.id === flat.node.id)
    const hasKids = Boolean(flat.node.children?.length)
    const isOpen = expanded.has(flat.node.id)
    switch (e.key) {
      case 'ArrowDown':
        focus(visible[i + 1]?.node.id)
        break
      case 'ArrowUp':
        focus(visible[i - 1]?.node.id)
        break
      case 'ArrowRight':
        if (hasKids && !isOpen) toggle(flat.node.id, true)
        else if (hasKids) focus(flat.node.children?.[0]?.id)
        break
      case 'ArrowLeft':
        if (hasKids && isOpen) toggle(flat.node.id, false)
        else focus(flat.parentId)
        break
      case 'Home':
        focus(visible[0]?.node.id)
        break
      case 'End':
        focus(visible[visible.length - 1]?.node.id)
        break
      case 'Enter':
      case ' ':
        onSelect?.(flat.node)
        if (hasKids && e.key === 'Enter') toggle(flat.node.id)
        break
      default:
        return
    }
    e.preventDefault()
    e.stopPropagation()
  }

  const render = (list: TreeNode[], level: number, parentId?: string): React.ReactNode =>
    list.map((node) => {
      const hasKids = Boolean(node.children?.length)
      const isOpen = expanded.has(node.id)
      const selected = node.id === selectedId
      const Icon = node.icon
      const flat = { node, level, parentId }
      return (
        <li
          key={node.id}
          ref={(el) => {
            if (el) refs.current.set(node.id, el)
            else refs.current.delete(node.id)
          }}
          role="treeitem"
          aria-level={level}
          aria-expanded={hasKids ? isOpen : undefined}
          aria-selected={selected}
          tabIndex={node.id === focusId ? 0 : -1}
          onKeyDown={(e) => onKeyDown(e, flat)}
          onFocus={(e) => {
            if (e.target === e.currentTarget) setFocusId(node.id)
          }}
          className="rounded-md outline-none focus-visible:[&>div]:outline-2 focus-visible:[&>div]:-outline-offset-2 focus-visible:[&>div]:outline-ring"
        >
          <div
            onClick={() => {
              setFocusId(node.id)
              onSelect?.(node)
              if (hasKids) toggle(node.id)
            }}
            style={{ paddingLeft: `calc(${level - 1} * 1.25rem + 0.25rem)` }}
            className={cn(
              'flex h-control-sm cursor-pointer items-center gap-1.5 rounded-md pr-2 type-body transition-colors duration-150',
              selected ? 'bg-selected font-medium text-selected-foreground' : 'hover:bg-accent',
            )}
          >
            <span className="flex size-4 shrink-0 items-center justify-center">
              {hasKids && (
                <ChevronRight
                  className={cn(
                    'size-4 text-muted-foreground transition-transform duration-150',
                    isOpen && 'rotate-90',
                  )}
                  aria-hidden
                />
              )}
            </span>
            {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
            <span className="truncate">{node.label}</span>
            {node.meta && (
              <span className="ml-auto type-caption text-muted-foreground num">{node.meta}</span>
            )}
          </div>
          {hasKids && isOpen && <ul role="group">{render(node.children!, level + 1, node.id)}</ul>}
        </li>
      )
    })

  return (
    <ul role="tree" aria-label={label} className={cn('flex flex-col', className)}>
      {render(nodes, 1)}
    </ul>
  )
}
