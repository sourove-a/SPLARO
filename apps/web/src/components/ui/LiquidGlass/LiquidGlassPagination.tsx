'use client'

import { cn } from '@/lib/utils/cn'
import { LiquidGlassNavButton } from './LiquidGlassNavButton'

interface LiquidGlassPaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

export function LiquidGlassPagination({
  page,
  totalPages,
  onPageChange,
  className,
}: LiquidGlassPaginationProps) {
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <nav className={cn('lg-pagination', className)} aria-label="Pagination">
      <LiquidGlassNavButton
        direction="left"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
      />

      <div className="flex items-center gap-1.5">
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={cn('lg-pagination__btn', p === page && 'lg-pagination__btn--active')}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        ))}
      </div>

      <LiquidGlassNavButton
        direction="right"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
      />
    </nav>
  )
}
