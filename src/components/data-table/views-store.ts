import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ColumnsState, TableQuery } from './types'

/*
 * Visões salvas (filtros + ordenação + colunas) e o último layout de colunas de
 * cada tabela. Hoje no navegador (Zustand persist, chave `reteck-table-views`).
 * Com a API real, troque a implementação mantendo a mesma interface.
 */

export interface SavedView {
  id: string
  name: string
  /** Consulta sem a página. */
  query: Omit<TableQuery, 'page'>
  columns: ColumnsState
}

interface ViewsState {
  views: Record<string, SavedView[]>
  defaults: Record<string, string | undefined>
  layouts: Record<string, ColumnsState | undefined>
  saveView: (tableId: string, view: SavedView) => void
  deleteView: (tableId: string, viewId: string) => void
  setDefault: (tableId: string, viewId: string | undefined) => void
  saveLayout: (tableId: string, layout: ColumnsState) => void
}

export const useViewsStore = create<ViewsState>()(
  persist(
    (set) => ({
      views: {},
      defaults: {},
      layouts: {},
      saveView: (tableId, view) =>
        set((s) => ({
          views: {
            ...s.views,
            [tableId]: [...(s.views[tableId] ?? []).filter((v) => v.id !== view.id), view],
          },
        })),
      deleteView: (tableId, viewId) =>
        set((s) => ({
          views: { ...s.views, [tableId]: (s.views[tableId] ?? []).filter((v) => v.id !== viewId) },
          defaults:
            s.defaults[tableId] === viewId ? { ...s.defaults, [tableId]: undefined } : s.defaults,
        })),
      setDefault: (tableId, viewId) =>
        set((s) => ({ defaults: { ...s.defaults, [tableId]: viewId } })),
      saveLayout: (tableId, layout) =>
        set((s) => ({ layouts: { ...s.layouts, [tableId]: layout } })),
    }),
    { name: 'reteck-table-views', version: 1 },
  ),
)
