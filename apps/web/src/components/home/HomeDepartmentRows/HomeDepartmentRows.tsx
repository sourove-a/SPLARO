'use client'

import { AnimatePresence, motion } from '@/lib/motion/react'
import type { HomepageDepartmentRow } from '@/lib/catalog/homepage-department-rows'
import { HomeDepartmentRow } from './HomeDepartmentRow'

interface HomeDepartmentRowsProps {
  rows: HomepageDepartmentRow[]
}

export function HomeDepartmentRows({ rows }: HomeDepartmentRowsProps) {
  if (!rows.length) return null

  return (
    <div className="home-dept-rows" aria-label="Shop by department">
      <AnimatePresence initial={false} mode="popLayout">
        {rows.map((row, index) => (
          <motion.div
            key={row.slug}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
          >
            <HomeDepartmentRow row={row} priorityFirst={index === 0} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
