'use client'

import { DcIcon } from '../DcIcon'
import { FLEX, FONT, MONO } from '../tokens'
import type { DcBlock } from './types'

/** Rough block heights, so the skeleton is shaped like the screen it replaces. */
const SKELETON_HEIGHT: Record<DcBlock['t'], number> = {
  hero: 148,
  kpis: 108,
  decide: 300,
  table: 280,
  cards: 240,
  list: 220,
  toggles: 200,
  vis: 220,
  pub: 240,
  form: 240,
  chart: 214,
  seg: 76,
  banner: 44,
  save: 58,
  beta: 74,
  media: 210,
  timeline: 220,
  tabs: 43,
}

/** Shimmer placeholders matching this screen's real block layout. */
export function DcLoadingState({ blocks }: { blocks: DcBlock[] }) {
  return (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', width: '100%' }}
    >
      {blocks.map((b, i) => {
        const [flex, min] = FLEX[b.w || 'full']
        return (
          <div key={i} style={{ flex, minWidth: min, maxWidth: '100%' }}>
            <div
              className="dc-skeleton"
              style={{
                height: SKELETON_HEIGHT[b.t] ?? 180,
                borderRadius: 14,
                border: '1px solid var(--line)',
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

export interface DcEmptyStateProps {
  icon: string
  title: string
  body: string
  cta?: string
  onCta?: () => void
}

/** Module-specific empty state — there is deliberately no generic fallback copy. */
export function DcEmptyState({ icon, title, body, cta, onCta }: DcEmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        padding: '80px 20px',
        border: '1px dashed var(--line-2)',
        borderRadius: 14,
        background: 'var(--surface)',
      }}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 52,
          height: 52,
          borderRadius: 14,
          border: '1px solid var(--line)',
          background: 'var(--surface-2)',
          color: 'var(--ink-3)',
        }}
      >
        <DcIcon name={icon} size={22} />
      </span>
      <span style={{ font: `600 16px/1 ${FONT}`, color: 'var(--ink)' }}>{title}</span>
      <span
        style={{
          font: `400 13px/1.6 ${FONT}`,
          color: 'var(--ink-3)',
          maxWidth: 400,
          textAlign: 'center',
          textWrap: 'pretty',
        }}
      >
        {body}
      </span>
      {cta ? (
        <button
          type="button"
          onClick={onCta}
          style={{
            height: 34,
            padding: '0 15px',
            borderRadius: 9,
            border: '1px solid var(--violet-solid)',
            background: 'var(--violet-solid)',
            color: 'var(--on-violet)',
            cursor: 'pointer',
            font: `600 12.5px/1 ${FONT}`,
          }}
        >
          {cta}
        </button>
      ) : null}
    </div>
  )
}

export interface DcErrorStateProps {
  /** The real API error, endpoint included — shown verbatim, never paraphrased. */
  error: string
  hint?: string
  onRetry?: () => void
}

export function DcErrorState({ error, hint, onRetry }: DcErrorStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '18px 18px 20px',
        border: '1px solid var(--bad-bd)',
        borderRadius: 14,
        background: 'var(--bad-soft)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <DcIcon name="icon-triangle-alert" size={16} color="var(--bad)" />
        <span style={{ flex: 1, font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
          This module could not load
        </span>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              height: 32,
              padding: '0 13px',
              borderRadius: 9,
              border: '1px solid var(--bad-bd)',
              background: 'transparent',
              color: 'var(--bad)',
              cursor: 'pointer',
              font: `600 12.5px/1 ${FONT}`,
            }}
          >
            <DcIcon name="icon-refresh-cw" size={13} />
            <span>Retry</span>
          </button>
        ) : null}
      </div>
      <code
        style={{
          display: 'block',
          padding: '10px 12px',
          borderRadius: 9,
          border: '1px solid var(--line)',
          background: 'var(--surface)',
          font: `500 12px/1.55 ${MONO}`,
          color: 'var(--ink)',
          overflowX: 'auto',
        }}
      >
        {error}
      </code>
      {hint ? (
        <span style={{ font: `400 12px/1.55 ${FONT}`, color: 'var(--ink-2)', textWrap: 'pretty' }}>
          {hint}
        </span>
      ) : null}
    </div>
  )
}
