'use client'

import type { HomepageDepartmentRow } from '@/lib/catalog/homepage-department-rows'
import { HomeDepartmentRow } from './HomeDepartmentRow'

interface HomeDepartmentRowsProps {
  rows: HomepageDepartmentRow[]
}

/** No nested scroll-reveal here — parent story / Lenis stay smooth. */
export function HomeDepartmentRows({ rows }: HomeDepartmentRowsProps) {
  if (!rows.length) return null

  return (
    <div className="home-dept-rows" aria-label="Shop by department">
      {rows.map((row, index) => (
        <div key={row.slug} className="home-dept-row-story">
          <HomeDepartmentRow row={row} priorityFirst={index === 0} />
        </div>
      ))}
    </div>
  )
}
