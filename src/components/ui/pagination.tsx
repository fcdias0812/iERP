import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { pageWindow } from '@/lib/pagination'
import { Button } from './button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

interface PaginationProps {
  /** Página atual, começando em 1. */
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizes?: number[]
  className?: string
}

/** Paginação: "1–20 de 348", tamanho da página e navegação. */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = [10, 20, 50, 100],
  className,
}: PaginationProps) {
  const { t } = useTranslation()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  return (
    <nav
      aria-label={t('pagination.label')}
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
    >
      <div className="flex items-center gap-3 type-caption text-muted-foreground">
        <span className="num" aria-live="polite">
          {t('pagination.range', {
            from: formatNumber(from),
            to: formatNumber(to),
            total: formatNumber(total),
          })}
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-2">
            <span>{t('pagination.pageSize')}</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-control-sm w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizes.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('pagination.first')}
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
        >
          <ChevronsLeft aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('pagination.previous')}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <ul className="hidden items-center gap-1 sm:flex">
          {pageWindow(page, pages).map((p, i) =>
            p === 'gap' ? (
              <li key={`gap-${i}`} className="px-1 text-muted-foreground" aria-hidden>
                …
              </li>
            ) : (
              <li key={p}>
                <Button
                  variant={p === page ? 'secondary' : 'ghost'}
                  size="icon-sm"
                  className={cn(
                    'num',
                    p === page &&
                      'border-primary bg-selected text-selected-foreground hover:bg-selected',
                  )}
                  aria-label={t('pagination.page', { page: p })}
                  aria-current={p === page ? 'page' : undefined}
                  onClick={() => onPageChange(p)}
                >
                  {p}
                </Button>
              </li>
            ),
          )}
        </ul>
        <span className="px-2 type-caption text-muted-foreground num sm:hidden">
          {page}/{pages}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('pagination.next')}
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('pagination.last')}
          disabled={page >= pages}
          onClick={() => onPageChange(pages)}
        >
          <ChevronsRight aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
