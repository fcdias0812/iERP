/** Números de página com reticências: 1 … 4 5 6 … 20 */
export function pageWindow(page: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const out: (number | 'gap')[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pages - 1, page + 1)
  if (start > 2) out.push('gap')
  for (let p = start; p <= end; p++) out.push(p)
  if (end < pages - 1) out.push('gap')
  out.push(pages)
  return out
}
