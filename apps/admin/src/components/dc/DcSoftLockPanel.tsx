'use client'

import { useRouter } from 'next/navigation'

import { DcIcon } from '@/components/dc/DcIcon'
import { FONT } from '@/components/dc/tokens'

/**
 * Shown on deep/beta URLs that are not in the primary DC sidebar.
 * The pre-DC panels those URLs used to render are retired.
 */
export function DcSoftLockPanel({
  title,
  href,
  hint,
}: {
  title: string
  href?: string
  hint?: string
}) {
  const router = useRouter()
  return (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 14,
        background: 'var(--surface)',
        backgroundImage: 'var(--card-sheen)',
        padding: '28px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        maxWidth: 560,
      }}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 40,
          height: 40,
          borderRadius: 10,
          border: '1px solid var(--line-2)',
          background: 'var(--surface-2)',
          color: 'var(--violet)',
        }}
      >
        <DcIcon name="icon-lock" size={18} />
      </span>
      <div>
        <p style={{ font: `700 15px/1.3 ${FONT}`, color: 'var(--ink)', marginBottom: 6 }}>
          {title} is not on the primary DC nav
        </p>
        <p style={{ font: `500 12.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
          {hint ??
            'This deep URL used the old module panel. Use the sidebar screens instead — they are the live DC workspace.'}
        </p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          style={{
            height: 34,
            padding: '0 14px',
            borderRadius: 9,
            border: 0,
            background: 'var(--violet-solid)',
            color: 'var(--on-violet)',
            font: `600 12.5px/1 ${FONT}`,
            cursor: 'pointer',
          }}
        >
          Go to Dashboard
        </button>
        {href ? (
          <button
            type="button"
            onClick={() => router.push(href)}
            style={{
              height: 34,
              padding: '0 14px',
              borderRadius: 9,
              border: '1px solid var(--line-2)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              font: `600 12.5px/1 ${FONT}`,
              cursor: 'pointer',
            }}
          >
            Open related screen
          </button>
        ) : null}
      </div>
    </div>
  )
}
