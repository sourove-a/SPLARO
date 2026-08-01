'use client'

import type { CSSProperties, ReactNode } from 'react'

import { FONT, MONO } from '@/components/dc/tokens'

const card: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
  padding: '14px 16px',
  minWidth: 0,
}

export type DcKpiTone = 'default' | 'success' | 'warning' | 'danger'

export interface DcKpiItem {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: DcKpiTone
}

const TONE_FG: Record<DcKpiTone, string> = {
  default: 'var(--ink)',
  success: 'var(--ok)',
  warning: 'var(--warn)',
  danger: 'var(--bad)',
}

/** Native DC KPI strip — replaces AdminHandoffBlocks KpiGrid on live DC paths. */
export function DcKpiStrip({ items, columns = 4 }: { items: DcKpiItem[]; columns?: 2 | 4 }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 12,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
      className="dc-kpi-strip"
    >
      {items.map((item) => {
        const tone = item.tone ?? 'default'
        return (
          <div key={String(item.label)} style={card}>
            <p
              style={{
                margin: 0,
                font: `600 10.5px/1 ${FONT}`,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
              }}
            >
              {item.label}
            </p>
            <p
              style={{
                margin: '8px 0 0',
                font: `700 20px/1.15 ${MONO}`,
                color: TONE_FG[tone],
              }}
            >
              {item.value}
            </p>
            {item.sub != null ? (
              <p style={{ margin: '6px 0 0', font: `500 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>
                {item.sub}
              </p>
            ) : null}
          </div>
        )
      })}
      <style>{`
        @media (max-width: 900px) {
          .dc-kpi-strip { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 520px) {
          .dc-kpi-strip { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
