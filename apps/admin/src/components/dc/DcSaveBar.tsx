'use client'

import { DcIcon } from './DcIcon'
import { FONT } from './tokens'

export interface DcSaveBarProps {
  dirty: boolean
  saving: boolean
  /** What saving will actually do — shown only while dirty. */
  hint: string
  /** Shown when clean, e.g. "Last saved 4m ago by Rifat Hasan." */
  cleanNote?: string | undefined
  onReset: () => void
  onSave: () => void
}

/**
 * Save honesty, per the design: instant switches apply on click, text edits
 * raise this amber bar, and the green toast only fires after a verified save.
 */
export function DcSaveBar({
  dirty,
  saving,
  hint,
  cleanNote,
  onReset,
  onSave,
}: DcSaveBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        padding: '12px 15px',
        border: `1px solid ${dirty ? 'var(--warn-bd)' : 'var(--line)'}`,
        borderRadius: 12,
        background: dirty ? 'var(--warn-soft)' : 'var(--surface)',
      }}
    >
      <DcIcon
        name={dirty ? 'icon-pencil' : 'icon-circle-check'}
        size={15}
        color={dirty ? 'var(--warn)' : 'var(--ok)'}
      />
      <span
        style={{
          flex: 1,
          minWidth: 170,
          font: `500 12.5px/1.5 ${FONT}`,
          color: 'var(--ink-2)',
          textWrap: 'pretty',
        }}
      >
        {dirty ? `Unsaved changes. ${hint}` : (cleanNote ?? 'No unsaved changes.')}
      </span>
      <button
        type="button"
        onClick={onReset}
        disabled={!dirty || saving}
        className="dc-hover-ink"
        style={{
          height: 32,
          padding: '0 13px',
          borderRadius: 9,
          border: '1px solid var(--line)',
          background: 'var(--surface-2)',
          color: 'var(--ink-2)',
          cursor: dirty && !saving ? 'pointer' : 'not-allowed',
          font: `600 12.5px/1 ${FONT}`,
          opacity: dirty ? 1 : 0.6,
        }}
      >
        Reset
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || saving}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          height: 32,
          padding: '0 14px',
          borderRadius: 9,
          cursor: dirty && !saving ? 'pointer' : 'not-allowed',
          font: `600 12.5px/1 ${FONT}`,
          border: `1px solid ${dirty ? 'var(--violet-solid)' : 'var(--line)'}`,
          background: dirty ? 'var(--violet-solid)' : 'var(--surface-2)',
          color: dirty ? 'var(--on-violet)' : 'var(--ink-3)',
          opacity: saving ? 0.7 : 1,
        }}
      >
        <DcIcon name="icon-check" size={13} />
        <span>{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</span>
      </button>
    </div>
  )
}
