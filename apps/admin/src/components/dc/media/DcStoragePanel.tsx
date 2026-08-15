'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { useMediaStorage } from '@/lib/api/hooks'
import { fetchMediaStorage, type MediaStorage } from '@/lib/api/media'
import '@/styles/dc-media-storage.css'

/**
 * What the library costs on the VPS, in the four shapes an admin actually asks
 * for: how full the volume is, what the bytes are made of, where they sit, and
 * how fast the pile is growing.
 *
 * Every number arrives measured from `/admin/media/storage`, which walks the
 * upload root — so the derivative ladder and unindexed files are visible here
 * rather than hidden behind the row totals in Postgres.
 */

const KIND_LABEL: Record<string, string> = {
  image: 'Images',
  video: 'Video',
  pdf: 'PDF',
  gif: 'GIF',
  svg: 'SVG',
  other: 'Other',
}

export function formatBytes(bytes: number | null | undefined): string {
  const value = Number(bytes ?? 0)
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const power = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const scaled = value / 1024 ** power
  const digits = scaled >= 100 || power === 0 ? 0 : scaled >= 10 ? 1 : 2
  return `${scaled.toFixed(digits)} ${units[power]}`
}

function percentOf(part: number, whole: number): number {
  if (!whole || whole <= 0) return 0
  return Math.min(100, Math.max(0, (part / whole) * 100))
}

function formatPercent(part: number, whole: number): string {
  const pct = percentOf(part, whole)
  if (pct > 0 && pct < 0.1) return '<0.1%'
  return `${pct.toFixed(pct >= 10 ? 0 : 1)}%`
}

function monthLabel(month: string): string {
  const [year = '', index = ''] = month.split('-')
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[Number(index) - 1] ?? month} ${year.slice(2)}`
}

type Slice = { key: string; label: string; bytes: number; color: string }

/** Donut arcs drawn as dashed circle strokes, each shortened by the surface gap. */
function DonutRing({
  slices,
  total,
  centerValue,
  centerLabel,
  onHover,
}: {
  slices: Slice[]
  total: number
  centerValue: string
  centerLabel: string
  onHover: (slice: Slice | null, event: React.MouseEvent) => void
}) {
  const radius = 62
  const circumference = 2 * Math.PI * radius
  let offset = 0
  const arcs = slices.map((slice) => {
    const length = total > 0 ? (slice.bytes / total) * circumference : 0
    const arc = { slice, length: Math.max(0, length - 2), offset }
    offset += length
    return arc
  })
  return (
    <svg viewBox="0 0 160 160" role="img" aria-label={`${centerLabel}: ${centerValue}`}>
      <g transform="rotate(-90 80 80)">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--viz-track)" strokeWidth="17" />
        {arcs.map(({ slice, length, offset: start }) => (
          <circle
            key={slice.key}
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth="17"
            strokeDasharray={`${length} ${Math.max(0, circumference - length)}`}
            strokeDashoffset={-start}
            onMouseMove={(event) => onHover(slice, event)}
            onMouseLeave={(event) => onHover(null, event)}
          />
        ))}
      </g>
      <text x="80" y="78" textAnchor="middle" className="dc-mstore__donut-value">
        {centerValue}
      </text>
      <text x="80" y="94" textAnchor="middle" className="dc-mstore__donut-label">
        {centerLabel}
      </text>
    </svg>
  )
}

/** Cumulative library size over the last twelve months. */
function GrowthArea({
  points,
  gradientId,
  hoverIndex,
  onHover,
}: {
  points: MediaStorage['byMonth']
  gradientId: string
  hoverIndex: number | null
  onHover: (index: number | null, event: React.MouseEvent) => void
}) {
  const width = 640
  const height = 140
  const padding = { top: 10, right: 4, bottom: 8, left: 4 }
  const peak = Math.max(1, ...points.map((point) => point.cumulativeBytes))
  const step = points.length > 1 ? (width - padding.left - padding.right) / (points.length - 1) : 0
  const coords = points.map((point, index) => ({
    x: padding.left + index * step,
    y:
      padding.top +
      (1 - point.cumulativeBytes / peak) * (height - padding.top - padding.bottom),
  }))
  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
  const area = `${line} L${coords[coords.length - 1]?.x ?? 0} ${height - padding.bottom} L${coords[0]?.x ?? 0} ${height - padding.bottom} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      // Stretched to the card width, so the stroke opts out of the scale and the
      // month labels live in HTML below rather than being blown up with it.
      preserveAspectRatio="none"
      role="img"
      aria-label="Library size over the last twelve months"
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const ratio = (event.clientX - rect.left) / rect.width
        const index = Math.round((ratio * width - padding.left) / (step || 1))
        onHover(Math.min(points.length - 1, Math.max(0, index)), event)
      }}
      onMouseLeave={(event) => onHover(null, event)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--viz-indexed)" stopOpacity="0.26" />
          <stop offset="100%" stopColor="var(--viz-indexed)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1={padding.left}
        y1={height - padding.bottom}
        x2={width - padding.right}
        y2={height - padding.bottom}
        stroke="var(--line)"
        strokeWidth="1"
      />
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--viz-indexed)"
        strokeWidth="2"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {hoverIndex !== null && coords[hoverIndex] ? (
        <>
          <line
            x1={coords[hoverIndex].x}
            y1={padding.top}
            x2={coords[hoverIndex].x}
            y2={height - padding.bottom}
            stroke="var(--line-2)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={coords[hoverIndex].x}
            cy={coords[hoverIndex].y}
            r="4"
            fill="var(--viz-indexed)"
            stroke="var(--surface-2)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </>
      ) : null}
    </svg>
  )
}

function BarList({ rows, empty }: { rows: Array<{ key: string; label: string; bytes: number; count: number }>; empty: string }) {
  const peak = Math.max(1, ...rows.map((row) => row.bytes))
  if (rows.length === 0) return <span className="dc-mstore__meta">{empty}</span>
  return (
    <div className="dc-mstore__bars">
      {rows.map((row) => (
        <div key={row.key} className="dc-mstore__bar-row">
          <span className="dc-mstore__bar-name" title={`${row.label} — ${row.count} asset${row.count === 1 ? '' : 's'}`}>
            {row.label}
          </span>
          <span className="dc-mstore__bar-track">
            <span className="dc-mstore__bar-fill" style={{ width: `${percentOf(row.bytes, peak)}%` }} />
          </span>
          <span className="dc-mstore__bar-value">{formatBytes(row.bytes)}</span>
        </div>
      ))}
    </div>
  )
}

export function DcStoragePanel({ onOpenTrash }: { onOpenTrash?: (() => void) | undefined }) {
  const storage = useMediaStorage()
  const qc = useQueryClient()
  const gradientId = useId().replace(/:/g, '')
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null)
  const [hoverMonth, setHoverMonth] = useState<number | null>(null)

  const rescan = useMutation({
    mutationFn: () => fetchMediaStorage(true),
    onSuccess: (data) => {
      qc.setQueryData(['media-storage'], data)
      void qc.invalidateQueries({ queryKey: ['media-orphans'] })
    },
  })

  const data = storage.data
  const split = data?.split

  const slices = useMemo<Slice[]>(() => {
    if (!split) return []
    return [
      { key: 'indexed', label: 'Indexed uploads', bytes: split.indexedBytes, color: 'var(--viz-indexed)' },
      { key: 'derived', label: 'Optimised copies', bytes: split.derivativeBytes, color: 'var(--viz-derived)' },
      { key: 'trash', label: 'In trash', bytes: split.trashBytes, color: 'var(--viz-trash)' },
      { key: 'orphan', label: 'Unindexed files', bytes: split.orphanBytes, color: 'var(--viz-orphan)' },
    ]
  }, [split])

  const folderRows = useMemo(() => {
    const rows = data?.byFolder ?? []
    const top = rows.slice(0, 8).map((row) => ({ key: row.slug, label: row.label, bytes: row.bytes, count: row.count }))
    const rest = rows.slice(8)
    if (rest.length > 0) {
      top.push({
        key: '__other',
        label: `Other (${rest.length} folders)`,
        bytes: rest.reduce((sum, row) => sum + row.bytes, 0),
        count: rest.reduce((sum, row) => sum + row.count, 0),
      })
    }
    return top
  }, [data?.byFolder])

  const typeRows = useMemo(
    () =>
      (data?.byType ?? []).map((row) => ({
        key: row.kind,
        label: KIND_LABEL[row.kind] ?? row.kind,
        bytes: row.bytes,
        count: row.count,
      })),
    [data?.byType],
  )

  if (storage.isLoading) {
    return (
      <section className="dc-mstore" aria-busy="true">
        <div className="dc-mstore__head">
          <h2 className="dc-mstore__title">Storage</h2>
          <span className="dc-mstore__meta">measuring the upload volume…</span>
        </div>
      </section>
    )
  }

  if (storage.error || !data) {
    return (
      <section className="dc-mstore">
        <div className="dc-mstore__head">
          <h2 className="dc-mstore__title">Storage</h2>
          <span className="dc-mstore__meta">
            GET /admin/media/storage failed — {storage.error instanceof Error ? storage.error.message : 'unavailable'}
          </span>
          <button type="button" className="dc-mstore__tool" style={{ marginLeft: 'auto' }} onClick={() => void storage.refetch()}>
            Retry
          </button>
        </div>
      </section>
    )
  }

  const months = data.byMonth ?? []
  const volume = data.volume
  // A configured quota is the store's real ceiling; `statfs` sees the whole host
  // volume, which on a shared VPS is somebody else's number.
  const budget = volume?.quotaBytes ?? volume?.totalBytes ?? 0
  const splitTotal = slices.reduce((sum, slice) => sum + slice.bytes, 0)
  const otherOnVolume =
    volume && !volume.quotaBytes ? Math.max(0, volume.usedBytes - data.libraryBytes) : 0
  const donutSlices: Slice[] = [
    { key: 'media', label: 'This media library', bytes: data.libraryBytes, color: 'var(--viz-indexed)' },
    ...(otherOnVolume > 0
      ? [{ key: 'other', label: 'Everything else on the volume', bytes: otherOnVolume, color: 'var(--ink-3)' }]
      : []),
  ]
  const usedOfBudget = volume?.quotaBytes ? data.libraryBytes : (volume?.usedBytes ?? data.libraryBytes)

  const showTip = (text: string, event: React.MouseEvent) => {
    const host = event.currentTarget.closest('.dc-mstore') as HTMLElement | null
    if (!host) return
    const rect = host.getBoundingClientRect()
    setTip({ text, x: event.clientX - rect.left, y: event.clientY - rect.top - 8 })
  }

  return (
    <section className="dc-mstore">
      <div className="dc-mstore__head">
        <h2 className="dc-mstore__title">Storage</h2>
        <span className="dc-mstore__meta">
          {data.disk?.available
            ? `walked ${data.disk.files.toLocaleString()} files · ${new Date(data.disk.scannedAt).toLocaleTimeString()}`
            : 'disk walk unavailable — showing indexed sizes only'}
        </span>
        <button
          type="button"
          className="dc-mstore__tool"
          style={{ marginLeft: 'auto' }}
          disabled={rescan.isPending}
          onClick={() => rescan.mutate()}
        >
          <DcIcon name="icon-refresh-cw" size={12} /> {rescan.isPending ? 'Rescanning…' : 'Rescan'}
        </button>
      </div>

      {data.disk?.truncated ? (
        <p className="dc-mstore__note">
          The upload folder holds more files than one scan reads — totals below are a floor, not the full picture.
        </p>
      ) : null}

      <div className="dc-mstore__tiles">
        <div className="dc-mstore__tile">
          <span className="dc-mstore__tile-label">
            <DcIcon name="icon-hard-drive" size={11} /> Media on disk
          </span>
          <span className="dc-mstore__tile-value">{formatBytes(data.libraryBytes)}</span>
          <span className="dc-mstore__tile-note">
            {budget > 0 ? `${formatPercent(data.libraryBytes, budget)} of ${formatBytes(budget)}` : 'volume size unknown'}
          </span>
        </div>
        <div className="dc-mstore__tile">
          <span className="dc-mstore__tile-label">
            <DcIcon name="icon-images" size={11} /> Assets
          </span>
          <span className="dc-mstore__tile-value">{data.libraryAssets.toLocaleString()}</span>
          <span className="dc-mstore__tile-note">
            {data.libraryAssets > 0
              ? `${formatBytes(Math.round(data.libraryBytes / data.libraryAssets))} average`
              : 'nothing uploaded yet'}
          </span>
        </div>
        <button
          type="button"
          className="dc-mstore__tile"
          onClick={onOpenTrash}
          disabled={!onOpenTrash}
          style={onOpenTrash ? undefined : { cursor: 'default' }}
        >
          <span className="dc-mstore__tile-label">
            <span className="dc-mstore__swatch" style={{ background: 'var(--viz-trash)' }} /> In trash
          </span>
          <span className="dc-mstore__tile-value">{formatBytes(split?.trashBytes ?? 0)}</span>
          <span className="dc-mstore__tile-note">
            {(split?.trashAssets ?? 0).toLocaleString()} asset{(split?.trashAssets ?? 0) === 1 ? '' : 's'} · reclaimable
          </span>
        </button>
        <div className="dc-mstore__tile">
          <span className="dc-mstore__tile-label">
            <span className="dc-mstore__swatch" style={{ background: 'var(--viz-orphan)' }} /> Unindexed
          </span>
          <span className="dc-mstore__tile-value">{formatBytes(split?.orphanBytes ?? 0)}</span>
          <span className="dc-mstore__tile-note">
            {(split?.orphanFiles ?? 0).toLocaleString()} file{(split?.orphanFiles ?? 0) === 1 ? '' : 's'} nothing points at
          </span>
        </div>
      </div>

      <div className="dc-mstore__grid">
        <div className="dc-mstore__card">
          <span className="dc-mstore__card-title">{volume?.quotaBytes ? 'Plan usage' : 'Upload volume'}</span>
          <div className="dc-mstore__donut">
            {budget > 0 ? (
              <DonutRing
                slices={donutSlices}
                total={budget}
                centerValue={formatPercent(usedOfBudget, budget)}
                centerLabel={`of ${formatBytes(budget)}`}
                onHover={(slice, event) =>
                  slice
                    ? showTip(`${slice.label} — ${formatBytes(slice.bytes)} (${formatPercent(slice.bytes, budget)})`, event)
                    : setTip(null)
                }
              />
            ) : (
              <span className="dc-mstore__meta">Volume size unavailable on this host.</span>
            )}
          </div>
          <div className="dc-mstore__legend">
            {donutSlices.map((slice) => (
              <span key={slice.key} className="dc-mstore__legend-row">
                <span className="dc-mstore__swatch" style={{ background: slice.color }} />
                {slice.label}
                <b>{formatBytes(slice.bytes)}</b>
              </span>
            ))}
            {volume ? (
              <span className="dc-mstore__legend-row">
                <span className="dc-mstore__swatch" style={{ background: 'var(--viz-track)' }} />
                Free on volume
                <b>{formatBytes(volume.freeBytes)}</b>
              </span>
            ) : null}
          </div>
          {volume ? <span className="dc-mstore__meta">{volume.path}</span> : null}
        </div>

        <div className="dc-mstore__card">
          <span className="dc-mstore__card-title">What the bytes are</span>
          <div
            className="dc-mstore__stack"
            role="img"
            aria-label={slices.map((slice) => `${slice.label} ${formatBytes(slice.bytes)}`).join(', ')}
          >
            {slices.map((slice) => (
              <span
                key={slice.key}
                style={{ width: `${percentOf(slice.bytes, splitTotal)}%`, background: slice.color }}
                onMouseMove={(event) =>
                  showTip(`${slice.label} — ${formatBytes(slice.bytes)} (${formatPercent(slice.bytes, splitTotal)})`, event)
                }
                onMouseLeave={() => setTip(null)}
              />
            ))}
          </div>
          <div className="dc-mstore__legend">
            {slices.map((slice) => (
              <span key={slice.key} className="dc-mstore__legend-row">
                <span className="dc-mstore__swatch" style={{ background: slice.color }} />
                {slice.label}
                <i>{formatPercent(slice.bytes, splitTotal)}</i>
                <b>{formatBytes(slice.bytes)}</b>
              </span>
            ))}
          </div>
          <span className="dc-mstore__meta">
            Optimised copies are the resized WebP/AVIF ladder the upload pipeline writes beside each original.
          </span>
        </div>
      </div>

      <div className="dc-mstore__grid dc-mstore__grid--split">
        <div className="dc-mstore__card">
          <span className="dc-mstore__card-title">By folder</span>
          <BarList rows={folderRows} empty="No folders hold media yet." />
        </div>
        <div className="dc-mstore__card">
          <span className="dc-mstore__card-title">By file type</span>
          <BarList rows={typeRows} empty="Nothing uploaded yet." />
        </div>
      </div>

      <div className="dc-mstore__card">
        <span className="dc-mstore__card-title">Library size · last 12 months</span>
        <div className="dc-mstore__spark">
          <GrowthArea
            points={months}
            gradientId={`mstore-growth-${gradientId}`}
            hoverIndex={hoverMonth}
            onHover={(index, event) => {
              setHoverMonth(index)
              if (index === null) {
                setTip(null)
                return
              }
              const point = months[index]
              if (!point) return
              showTip(
                `${monthLabel(point.month)} — ${formatBytes(point.cumulativeBytes)} total${point.count > 0 ? ` · +${formatBytes(point.bytes)} added` : ''}`,
                event,
              )
            }}
          />
          <div className="dc-mstore__spark-axis" aria-hidden>
            {months.map((point, index) => (
              <span key={point.month}>
                {index % 3 === 0 || index === months.length - 1 ? monthLabel(point.month) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="dc-mstore__details">
        <summary>Show the numbers</summary>
        <table className="dc-mstore__table">
          <thead>
            <tr>
              <th scope="col">Bucket</th>
              <th scope="col">Assets</th>
              <th scope="col">Size</th>
            </tr>
          </thead>
          <tbody>
            {slices.map((slice) => (
              <tr key={slice.key}>
                <th scope="row">{slice.label}</th>
                <td>—</td>
                <td>{formatBytes(slice.bytes)}</td>
              </tr>
            ))}
            {folderRows.map((row) => (
              <tr key={`folder-${row.key}`}>
                <th scope="row">Folder · {row.label}</th>
                <td>{row.count.toLocaleString()}</td>
                <td>{formatBytes(row.bytes)}</td>
              </tr>
            ))}
            {(data.largest ?? []).map((asset) => (
              <tr key={asset.id}>
                <th scope="row">Largest · {asset.name}</th>
                <td>1</td>
                <td>{formatBytes(asset.bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      {tip ? (
        <div className="dc-mstore__tip" style={{ left: tip.x, top: tip.y }} role="status">
          {tip.text}
        </div>
      ) : null}
    </section>
  )
}
