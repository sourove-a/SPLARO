'use client'

import { DcIcon } from './DcIcon'
import { FONT, MONO } from './tokens'

export interface DcQuickAction {
  label: string
  icon: string
  color?: string
  disabled?: boolean
  onClick?: () => void
  /** Violet dashed border — used for AI generator in the design handoff. */
  accent?: boolean
}

export interface DcActivityItem {
  time: string
  title: string
  meta: string
  dot?: string
}

export interface DcRailProps {
  quickActions: DcQuickAction[]
  activity: DcActivityItem[]
}

export const RAIL_WIDTH = 272

export function DcRail({ quickActions, activity }: DcRailProps) {
  return (
    <aside
      style={{
        flex: 'none',
        width: RAIL_WIDTH,
        borderLeft: '1px solid var(--line)',
        background: 'var(--sidebar)',
        position: 'sticky',
        top: 56,
        height: 'calc(100vh - 56px)',
        overflowY: 'auto',
        padding: '16px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div
          style={{
            font: `700 10px/1 ${FONT}`,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: 'var(--ink-3)',
          }}
        >
          Quick actions
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          {quickActions.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={q.onClick}
              disabled={q.disabled}
              className={q.accent ? 'dc-qa-accent' : 'dc-hover-line'}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
                padding: 10,
                borderRadius: 10,
                cursor: q.disabled ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                border: q.accent ? '1px dashed var(--violet-bd)' : '1px solid var(--line)',
                background: q.accent ? 'var(--violet-soft)' : 'var(--surface)',
                color: 'var(--ink)',
                opacity: q.disabled ? 0.5 : 1,
              }}
            >
              <DcIcon name={q.icon} size={15} color={q.color ?? 'var(--ink-3)'} />
              <span style={{ font: `600 12px/1.2 ${FONT}` }}>{q.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              flex: 1,
              font: `700 10px/1 ${FONT}`,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            Recent activity
          </span>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 99,
              background: 'var(--ok)',
              animation: 'dc-pulse 2.4s infinite',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 2 }}>
          {activity.map((a, i) => (
            <div
              key={`${a.time}-${i}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '38px 18px 1fr',
                columnGap: 8,
                alignItems: 'stretch',
              }}
            >
              <span
                style={{
                  paddingTop: 1,
                  textAlign: 'right',
                  font: `600 10px/1.5 ${MONO}`,
                  color: 'var(--ink-3)',
                }}
              >
                {a.time}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span
                  style={{
                    width: 9,
                    height: 9,
                    flex: 'none',
                    marginTop: 3,
                    borderRadius: 99,
                    border: `2px solid ${a.dot ?? 'var(--line-2)'}`,
                    background: 'var(--surface)',
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    width: 1,
                    background: i === activity.length - 1 ? 'transparent' : 'var(--line)',
                  }}
                />
              </span>
              <span
                style={{
                  paddingBottom: 13,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  minWidth: 0,
                }}
              >
                <span
                  style={{ font: `500 12px/1.4 ${FONT}`, color: 'var(--ink)', textWrap: 'pretty' }}
                >
                  {a.title}
                </span>
                <span
                  style={{
                    font: `400 10.5px/1.45 ${FONT}`,
                    color: 'var(--ink-3)',
                    textWrap: 'pretty',
                  }}
                >
                  {a.meta}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
