import type { CSSProperties, ReactNode } from 'react'

/**
 * The panel's card, and the header row that sits on top of one.
 *
 * These exist so a screen cannot invent its own card again — the padding,
 * radius and header rhythm live in `dc-primitives.css` and are not passed in.
 * `style` stays available for the genuinely per-screen things (a flex basis, a
 * grid span), not for respacing the box.
 */

export interface DcCardProps {
  children: ReactNode
  /** Clip content to the card radius — use when a table meets the bottom edge. */
  clip?: boolean
  /** Apply the standard inner padding. Omit when the child is a table or head. */
  pad?: boolean
  className?: string
  style?: CSSProperties | undefined
}

export function DcCard({ children, clip, pad, className, style }: DcCardProps) {
  const classes = ['dc-card', clip ? 'dc-card--clip' : '', pad ? 'dc-card--pad' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={classes} style={style}>
      {children}
    </div>
  )
}

export interface DcCardHeadProps {
  title: ReactNode
  /** Right-aligned count, timestamp or status line. */
  meta?: ReactNode
  /** Buttons. They keep their own order; the head does not reorder them. */
  children?: ReactNode
}

export function DcCardHead({ title, meta, children }: DcCardHeadProps) {
  return (
    <div className="dc-card__head">
      <span className="dc-card__title">{title}</span>
      {meta ? <span className="dc-card__meta">{meta}</span> : null}
      {children}
    </div>
  )
}
