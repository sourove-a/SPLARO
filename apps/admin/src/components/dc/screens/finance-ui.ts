import type { CSSProperties } from 'react'

import { FONT } from '@/components/dc/tokens'
export function financePeriodPill(active: boolean): CSSProperties {
  return {
    height: 32,
    padding: '0 13px',
    borderRadius: 99,
    border: `1px solid ${active ? 'var(--violet-solid)' : 'var(--line)'}`,
    background: active ? 'var(--violet-solid)' : 'var(--surface)',
    color: active ? 'var(--on-violet)' : 'var(--ink-2)',
    cursor: 'pointer',
    font: `600 12px/1 ${FONT}`,
  }
}

export const financePrimaryBtn: CSSProperties = {
  border: 0,
  borderRadius: 10,
  padding: '10px 14px',
  background: 'var(--ink)',
  color: 'var(--surface)',
  font: `600 12.5px/1 ${FONT}`,
  cursor: 'pointer',
}

export const financeGhostBtn: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: '8px 12px',
  background: 'var(--surface)',
  color: 'var(--ink)',
  font: `600 12px/1 ${FONT}`,
  cursor: 'pointer',
}

export function financePagerBtn(disabled: boolean): CSSProperties {
  return {
    ...financeGhostBtn,
    opacity: disabled ? 0.45 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
