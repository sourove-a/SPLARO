'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { FONT, MONO, formatTaka } from '@/components/dc/tokens'
import {
  barHeights,
  bucketOrdersByHour,
  buildFunnel,
  buildSourceSlices,
  hourLabel,
  peakHour,
  seriesIsEmpty,
} from '@/lib/dashboard/chart-data'

/**
 * Dashboard charts.
 *
 * Bars, funnel and heat strip are plain SVG: they are rectangles, and hand
 * drawing them keeps recharts out of the dashboard bundle. Only the donut —
 * arc maths plus a hit-tested tooltip — is worth a library, and it is pulled
 * in on demand below.
 *
 * Every panel states what it has instead of drawing a convincing flat line
 * over no data: an empty window says so, and says what would fill it.
 */

const TrafficDonut = dynamic(
  () => import('./DcTrafficDonut').then((m) => m.DcTrafficDonut),
  {
    ssr: false,
    loading: () => <div className="dc-skeleton" style={{ height: 132, borderRadius: 12 }} />,
  },
)

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
  minWidth: 0,
  overflow: 'hidden',
} as const

function ChartCard({
  title,
  hint,
  right,
  children,
}: {
  title: string
  hint?: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div style={card}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          padding: '12px 15px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <span style={{ flex: 1, minWidth: 120 }}>
          <span style={{ display: 'block', font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>{title}</span>
          {hint ? (
            <span style={{ display: 'block', marginTop: 2, font: `400 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
              {hint}
            </span>
          ) : null}
        </span>
        {right}
      </div>
      <div style={{ padding: '13px 15px 15px' }}>{children}</div>
    </div>
  )
}

function EmptyNote({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 0' }}>
      <DcIcon name={icon} size={15} color="var(--ink-3)" />
      <span style={{ font: `400 12px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>{text}</span>
    </div>
  )
}

/** Daily order count. Zero days keep a stub bar so gaps stay legible. */
export function OrdersBarChart({
  points,
  loading,
}: {
  points: Array<{ label: string; orders: number }>
  loading: boolean
}) {
  const total = points.reduce((sum, p) => sum + p.orders, 0)
  const heights = useMemo(() => barHeights(points.map((p) => p.orders), 100), [points])
  const empty = seriesIsEmpty(points)

  return (
    <ChartCard
      title={`Orders · last ${points.length} days`}
      hint="One bar per day"
      right={<span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink-2)' }}>{total} total</span>}
    >
      {loading ? (
        <div className="dc-skeleton" style={{ height: 104, borderRadius: 10 }} />
      ) : empty ? (
        <EmptyNote icon="icon-inbox" text="No orders in this window yet — the first order will draw the first bar." />
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 104 }}>
          {points.map((point, index) => (
            <span
              key={`${point.label}-${index}`}
              title={`${point.label} · ${point.orders} order${point.orders === 1 ? '' : 's'}`}
              style={{
                flex: 1,
                minWidth: 0,
                height: `${heights[index] ?? 2}%`,
                borderRadius: '4px 4px 2px 2px',
                background: point.orders > 0 ? 'var(--violet)' : 'var(--surface-3)',
                transition: 'height var(--dc-motion, 200ms) ease',
              }}
            />
          ))}
        </div>
      )}
    </ChartCard>
  )
}

/** Visitors → cart → checkout → order, measured off the funnel endpoint. */
export function ConversionFunnelChart({
  steps,
  loading,
}: {
  steps: Array<{ label: string; count: number }>
  loading: boolean
}) {
  const rows = useMemo(() => buildFunnel(steps), [steps])
  const empty = rows.length === 0 || rows.every((r) => r.count === 0)

  return (
    <ChartCard title="Conversion funnel" hint="Where the drop-off happens">
      {loading ? (
        <div className="dc-skeleton" style={{ height: 120, borderRadius: 10 }} />
      ) : empty ? (
        <EmptyNote icon="icon-filter" text="No sessions recorded for this window yet." />
      ) : (
        <div style={{ display: 'grid', gap: 9 }}>
          {rows.map((row, index) => (
            <div key={row.label} style={{ display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ flex: 1, font: `600 12px/1.3 ${FONT}`, color: 'var(--ink)' }}>{row.label}</span>
                <span style={{ font: `700 12px/1 ${MONO}`, color: 'var(--ink)' }}>{row.count}</span>
                {index > 0 ? (
                  <span
                    style={{
                      font: `600 10.5px/1 ${MONO}`,
                      color: row.fromPrev >= 0.5 ? 'var(--ok)' : row.fromPrev > 0 ? 'var(--warn)' : 'var(--bad)',
                      minWidth: 38,
                      textAlign: 'right',
                    }}
                  >
                    {Math.round(row.fromPrev * 100)}%
                  </span>
                ) : (
                  <span style={{ minWidth: 38 }} />
                )}
              </div>
              <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.max(row.ofTop * 100, row.count > 0 ? 3 : 0)}%`,
                    borderRadius: 99,
                    background: index === rows.length - 1 ? 'var(--ok)' : 'var(--violet)',
                    transition: 'width var(--dc-motion-slow, 300ms) ease',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  )
}

/** Orders by hour of day, Dhaka time — a strip, not a full heatmap grid. */
export function PeakHoursChart({
  createdAtList,
  loading,
  sampleNote,
}: {
  createdAtList: string[]
  loading: boolean
  sampleNote: string
}) {
  const buckets = useMemo(() => bucketOrdersByHour(createdAtList), [createdAtList])
  const peak = useMemo(() => peakHour(buckets), [buckets])

  return (
    <ChartCard
      title="Peak hours"
      hint={sampleNote}
      right={
        peak ? (
          <span style={{ font: `600 11.5px/1 ${MONO}`, color: 'var(--ink-2)' }}>{hourLabel(peak.hour)}</span>
        ) : null
      }
    >
      {loading ? (
        <div className="dc-skeleton" style={{ height: 74, borderRadius: 10 }} />
      ) : !peak ? (
        <EmptyNote icon="icon-clock" text="No orders to place on a clock yet." />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 62 }}>
            {buckets.map((bucket) => (
              <span
                key={bucket.hour}
                title={`${hourLabel(bucket.hour)} · ${bucket.orders} order${bucket.orders === 1 ? '' : 's'}`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: `${Math.max(6, bucket.intensity * 100)}%`,
                  borderRadius: 3,
                  background:
                    bucket.orders === 0
                      ? 'var(--surface-3)'
                      : `color-mix(in srgb, var(--violet) ${Math.round(30 + bucket.intensity * 70)}%, var(--surface-3))`,
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            {['00', '06', '12', '18', '23'].map((h) => (
              <span key={h} style={{ font: `500 9.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                {h}
              </span>
            ))}
          </div>
        </>
      )}
    </ChartCard>
  )
}

/** Order sources. Loads recharts only when there is something to draw. */
export function TrafficSourceChart({
  rows,
  loading,
}: {
  rows: Array<{ source: string; orders: number; revenue: number }>
  loading: boolean
}) {
  const slices = useMemo(() => buildSourceSlices(rows), [rows])
  const total = slices.reduce((sum, s) => sum + s.orders, 0)

  return (
    <ChartCard
      title="Order sources"
      hint="Attribution captured at checkout"
      right={
        total > 0 ? (
          <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink-2)' }}>{formatTaka(
            slices.reduce((sum, s) => sum + s.revenue, 0),
          )}</span>
        ) : null
      }
    >
      {loading ? (
        <div className="dc-skeleton" style={{ height: 132, borderRadius: 12 }} />
      ) : slices.length === 0 ? (
        <EmptyNote
          icon="icon-share-2"
          text="No attributed orders yet — sources appear once orders arrive with a campaign or referrer."
        />
      ) : (
        <TrafficDonut slices={slices} />
      )}
    </ChartCard>
  )
}
