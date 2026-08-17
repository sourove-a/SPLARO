import type { ReactNode } from 'react'

/**
 * A list table that scrolls inside its card rather than widening the page.
 *
 * `minWidth` is the one number a caller still has to choose: it is what decides
 * when the table starts scrolling instead of crushing its columns, and only the
 * screen knows how many columns it has.
 *
 * Column alignment is declared per cell with `is-num` (right, tabular figures)
 * or `is-mono`, so a money column lines up on the decimal without the screen
 * restating the font.
 */

export interface DcTableProps {
  children: ReactNode
  /** Width below which the table scrolls horizontally instead of squashing. */
  minWidth?: number
  /** Keep the header visible while a long body scrolls. */
  sticky?: boolean
}

export function DcTable({ children, minWidth = 620, sticky }: DcTableProps) {
  return (
    <div className="dc-scroll-x">
      <table className={sticky ? 'dc-table dc-table--sticky' : 'dc-table'} style={{ minWidth }}>
        {children}
      </table>
    </div>
  )
}
