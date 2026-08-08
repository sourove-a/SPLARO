'use client'

import type { OnlineAdmin } from '@/lib/api/presence'
import { formatAdminRoleLabel } from '@/lib/auth/role-label'
import { FONT } from './tokens'

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'SP'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || 'SP'
}

export interface DcPresencePopoverProps {
  open: boolean
  onClose: () => void
  admins: OnlineAdmin[] | undefined
  storefrontCount: number
  loading: boolean
}

export function DcPresencePopover({ open, onClose, admins, storefrontCount, loading }: DcPresencePopoverProps) {
  if (!open) return null

  const list = admins ?? []

  return (
    <>
      <button
        type="button"
        aria-label="Close online staff"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 95, border: 0, background: 'transparent', cursor: 'default' }}
      />
      <div
        role="dialog"
        aria-label="Online now"
        style={{
          position: 'fixed',
          top: 60,
          right: 190,
          zIndex: 96,
          width: 300,
          maxWidth: 'calc(100vw - 32px)',
          border: '1px solid var(--line-2)',
          borderRadius: 13,
          background: 'var(--surface)',
          overflow: 'hidden',
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 14px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <span style={{ font: `600 13px/1 ${FONT}`, color: 'var(--ink)' }}>Online now</span>
        </div>

        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '18px 14px', font: `400 12.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
              Loading…
            </div>
          ) : list.length === 0 ? (
            <div style={{ padding: '18px 14px', font: `400 12.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
              No staff online right now.
            </div>
          ) : (
            list.map((admin) => (
              <div
                key={admin.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <span
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 99,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    color: 'var(--ink-2)',
                    font: `700 11.5px/1 ${FONT}`,
                    flexShrink: 0,
                    position: 'relative',
                  }}
                >
                  {initialsOf(admin.name)}
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -1,
                      right: -1,
                      width: 9,
                      height: 9,
                      borderRadius: 99,
                      background: 'var(--ok)',
                      border: '2px solid var(--surface)',
                    }}
                  />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      font: `600 12.5px/1.3 ${FONT}`,
                      color: 'var(--ink)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {admin.name || admin.email || 'Staff member'}
                  </div>
                  <div style={{ font: `400 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                    {formatAdminRoleLabel(admin.role, admin.email ?? undefined)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid var(--line)',
            font: `500 11.5px/1.4 ${FONT}`,
            color: 'var(--ink-3)',
          }}
        >
          {storefrontCount} storefront visitor{storefrontCount === 1 ? '' : 's'} browsing now
        </div>
      </div>
    </>
  )
}
