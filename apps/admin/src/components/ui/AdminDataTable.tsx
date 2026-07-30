'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export type AdminDataTableColumn<T> = {
  key: string
  header: ReactNode
  className?: string
  headerClassName?: string
  cell: (row: T, index: number) => ReactNode
}

export type AdminDataTableProps<T> = {
  columns: AdminDataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  empty?: ReactNode
  error?: ReactNode
  loading?: boolean
  className?: string
  wrapClassName?: string
  onRowClick?: (row: T, index: number) => void
}

/**
 * Shared live-module data table — sticky head, calm hover, empty/error slots.
 * Callers own data; no fake rows.
 */
export function AdminDataTable<T>({
  columns,
  rows,
  rowKey,
  empty = 'No rows yet.',
  error,
  loading,
  className,
  wrapClassName,
  onRowClick,
}: AdminDataTableProps<T>) {
  if (error) {
    return (
      <div className={cn('admin-data-table-wrap', wrapClassName)}>
        <div className="admin-data-table__error" role="alert">
          {error}
        </div>
      </div>
    )
  }

  if (!loading && rows.length === 0) {
    return (
      <div className={cn('admin-data-table-wrap', wrapClassName)}>
        <div className="admin-data-table__empty">{empty}</div>
      </div>
    )
  }

  return (
    <div className={cn('admin-data-table-wrap', wrapClassName)}>
      <table className={cn('admin-data-table', className)}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.headerClassName}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} aria-hidden>
                  {columns.map((col) => (
                    <td key={col.key}>
                      <span className="inline-block h-3 w-16 animate-pulse rounded bg-zinc-200/80" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row, index) => (
                <tr
                  key={rowKey(row, index)}
                  onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                  className={onRowClick ? 'cursor-pointer' : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={col.className}>
                      {col.cell(row, index)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}
