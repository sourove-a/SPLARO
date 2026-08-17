'use client'

import { DcIcon } from '@/components/dc/DcIcon'

/**
 * Page control for a server-driven list.
 *
 * It reports the true total from the API rather than the number of rows in
 * hand, because those two disagreed everywhere: the API caps a list response at
 * 100, and the screens presented that cap as the size of the catalogue.
 */

export interface DcPagerProps {
  page: number
  /** Rows on the current page. */
  count: number
  /** Rows matching the query across every page, from the API. */
  total: number
  limit: number
  onPage: (page: number) => void
  busy?: boolean
}

export function DcPager({ page, count, total, limit, onPage, busy }: DcPagerProps) {
  const lastPage = Math.max(1, Math.ceil(total / limit))
  const first = total === 0 ? 0 : (page - 1) * limit + 1
  const last = (page - 1) * limit + count

  return (
    <div className="dc-pager">
      <span className="dc-pager__range">
        {total === 0 ? (
          'No matching rows'
        ) : (
          <>
            <b>
              {first.toLocaleString()}–{last.toLocaleString()}
            </b>{' '}
            of {total.toLocaleString()}
          </>
        )}
      </span>
      <div className="dc-pager__controls">
        <button
          type="button"
          className="dc-toolbar__tool"
          disabled={page <= 1 || busy}
          aria-label="Previous page"
          onClick={() => onPage(page - 1)}
        >
          <DcIcon name="icon-chevron-left" size={13} />
        </button>
        <span className="dc-pager__page">
          Page {page} of {lastPage}
        </span>
        <button
          type="button"
          className="dc-toolbar__tool"
          disabled={page >= lastPage || busy}
          aria-label="Next page"
          onClick={() => onPage(page + 1)}
        >
          <DcIcon name="icon-chevron-right" size={13} />
        </button>
      </div>
    </div>
  )
}
