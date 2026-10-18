import { useEffect } from 'react'
import { create } from 'zustand'

/**
 * Breadcrumb de telas que não estão no menu (ex.: detalhe de um registro):
 * a tela informa a rota "mãe" (que está no menu) e o rótulo final.
 *   useBreadcrumb({ parent: '/admin/usuarios', label: 'USR-00001' })
 * → Início › Comercial › Pedidos de venda › PV-2026-00418
 */
export interface BreadcrumbTail {
  /** Caminho em que a tela está (preenchido pelo hook). */
  path: string
  parent: string
  label: string
}

interface BreadcrumbState {
  tail: BreadcrumbTail | null
  setTail: (tail: BreadcrumbTail | null) => void
}

export const useBreadcrumbStore = create<BreadcrumbState>()((set) => ({
  tail: null,
  setTail: (tail) => set({ tail }),
}))

export function useBreadcrumb(tail: { parent: string; label: string } | null) {
  const setTail = useBreadcrumbStore((s) => s.setTail)
  const parent = tail?.parent
  const label = tail?.label
  useEffect(() => {
    if (!parent || !label) return
    setTail({ path: window.location.pathname, parent, label })
    return () => setTail(null)
  }, [parent, label, setTail])
}
