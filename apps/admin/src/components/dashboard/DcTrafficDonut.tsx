'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { FONT, MONO, formatTaka } from '@/components/dc/tokens'
import type { SourceSlice } from '@/lib/dashboard/chart-data'

/**
 * The only recharts chart on this screen.
 *
 * Arc geometry and a hit-tested tooltip are the parts that are genuinely
 * tedious to hand-roll; bars and funnels are rectangles, so those stay as
 * plain SVG and keep recharts out of the dashboard's first paint. This file is
 * loaded through next/dynamic for that reason.
 */

const SLICE_COLORS = [
  'var(--violet)',
  'var(--ok)',
  'var(--warn)',
  'var(--info, var(--violet))',
  'var(--ink-3)',
]

export function DcTrafficDonut({ slices }: { slices: SourceSlice[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ width: 132, height: 132, flex: 'none' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="orders"
              nameKey="source"
              innerRadius={38}
              outerRadius={62}
              paddingAngle={2}
              stroke="var(--surface)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((slice, index) => (
                <Cell key={slice.source} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 10,
                font: `600 11.5px/1.4 ${FONT}`,
                color: 'var(--ink)',
              }}
              formatter={(value: number, name: string) => [`${value} orders`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul style={{ flex: 1, minWidth: 150, margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 7 }}>
        {slices.map((slice, index) => (
          <li key={slice.source} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              aria-hidden
              style={{
                width: 9,
                height: 9,
                borderRadius: 3,
                flex: 'none',
                background: SLICE_COLORS[index % SLICE_COLORS.length],
              }}
            />
            <span
              style={{
                flex: 1,
                minWidth: 0,
                font: `600 12px/1.3 ${FONT}`,
                color: 'var(--ink)',
                textTransform: 'capitalize',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {slice.source}
            </span>
            <span style={{ font: `600 11px/1 ${MONO}`, color: 'var(--ink-2)' }}>
              {Math.round(slice.share * 100)}%
            </span>
            <span style={{ font: `500 10.5px/1 ${MONO}`, color: 'var(--ink-3)', minWidth: 58, textAlign: 'right' }}>
              {formatTaka(slice.revenue)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
