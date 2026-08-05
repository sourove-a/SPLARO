'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import type { AdminNavGroup } from '@/lib/navigation/admin-nav'
import { getNavItemByHref } from '@/lib/navigation/admin-nav'
import { HANDOFF_PINNED_HREFS } from '@/lib/navigation/handoff-sidebar'

import { DcIcon } from './DcIcon'
import { FONT, MONO } from './tokens'

// Measured off the prototype, which renders 244px. The handoff README says
// 248px — the README is the one that is wrong.
export const SIDEBAR_WIDTH_OPEN = 244
export const SIDEBAR_WIDTH_COLLAPSED = 62

/** Hrefs surfaced above the groups, in this order. */
const PINNED_HREFS = [...HANDOFF_PINNED_HREFS]

export interface DcSidebarUser {
  name: string
  role: string
  initials: string
  email?: string
}

export interface DcSidebarProps {
  groups: AdminNavGroup[]
  activeHref: string
  collapsed: boolean
  onToggleCollapsed: () => void
  user: DcSidebarUser
  onSignOut?: (() => void) | undefined
  /** Opens admin profile (details, IP, password). Prefer over immediate sign-out. */
  onOpenProfile?: (() => void) | undefined
}

interface Row {
  href: string
  label: string
  icon: string
  badge?: string | number
}

function rowStyle(active: boolean) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    width: '100%',
    height: 33,
    padding: '0 8px',
    borderRadius: 8,
    border: `1px solid ${active ? 'var(--violet-bd)' : 'transparent'}`,
    cursor: 'pointer',
    textAlign: 'left' as const,
    font: `500 13px/1 ${FONT}`,
    background: active ? 'var(--violet-soft)' : 'transparent',
    color: active ? 'var(--violet)' : 'var(--ink-2)',
  }
}

function NavRow({ row, active }: { row: Row; active: boolean }) {
  return (
    <Link href={row.href} className={active ? undefined : 'dc-hover-surface'} style={rowStyle(active)}>
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 22,
          height: 22,
          flex: 'none',
          borderRadius: 6,
          background: active ? 'transparent' : 'var(--surface-2)',
          color: active ? 'var(--violet)' : 'var(--ink-3)',
        }}
      >
        <DcIcon name={row.icon} size={13} />
      </span>
      <span
        style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {row.label}
      </span>
      {row.badge !== undefined && row.badge !== '' ? (
        <span
          style={{
            minWidth: 19,
            height: 18,
            padding: '0 5px',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 99,
            font: `700 10.5px/1 ${FONT}`,
            background: active ? 'var(--violet-solid)' : 'var(--surface-3)',
            color: active ? 'var(--on-violet)' : 'var(--ink-2)',
          }}
        >
          {row.badge}
        </span>
      ) : null}
    </Link>
  )
}

export function DcSidebar({
  groups,
  activeHref,
  collapsed,
  onToggleCollapsed,
  user,
  onSignOut,
  onOpenProfile,
}: DcSidebarProps) {
  const [query, setQuery] = useState('')

  const allRows: Row[] = useMemo(
    () =>
      groups.flatMap((g) =>
        g.items.map((it) => ({
          href: it.href,
          label: it.label,
          icon: it.icon,
          ...(it.badge !== undefined ? { badge: it.badge } : {}),
        })),
      ),
    [groups],
  )

  const q = query.trim().toLowerCase()
  const filteredGroups = useMemo(() => {
    if (!q) return groups
    return groups
      .map((g) => ({
        group: g.group,
        items: g.items.filter(
          (it) =>
            it.label.toLowerCase().includes(q) ||
            (it.description ?? '').toLowerCase().includes(q) ||
            it.href.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0)
  }, [groups, q])

  const pinned = useMemo(() => {
    return PINNED_HREFS.map((href) => {
      const fromGroups = allRows.find((r) => r.href === href)
      if (fromGroups) return fromGroups
      const nav = getNavItemByHref(href)
      if (!nav) return null
      return {
        href: nav.href,
        label: nav.label,
        icon: nav.icon,
        ...(nav.badge !== undefined ? { badge: nav.badge } : {}),
      } satisfies Row
    }).filter((r): r is Row => !!r)
  }, [allRows])

  const showPinned = !q && pinned.length > 0
  const navEmpty = q.length > 0 && filteredGroups.length === 0

  return (
    <aside
      className="dc-sidebar"
      style={{
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--line)',
        background: 'var(--sidebar)',
        position: 'sticky',
        top: 0,
        height: '100vh',
        width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_OPEN,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 56,
          padding: '0 14px',
          borderBottom: '1px solid var(--line)',
          flex: 'none',
        }}
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className="dc-hover-ink"
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 30,
            height: 30,
            flex: 'none',
            borderRadius: 8,
            border: '1px solid var(--line)',
            background: 'var(--surface-2)',
            color: 'var(--ink-2)',
            cursor: 'pointer',
          }}
        >
          <DcIcon name="icon-panel-left" size={15} />
        </button>
        {!collapsed ? <DcWordmark /> : null}
      </div>

      {!collapsed ? (
        <>
          <div style={{ flex: 'none', padding: '10px 10px 8px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 32,
                padding: '0 10px',
                borderRadius: 9,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
              }}
            >
              <DcIcon name="icon-search" size={13} color="var(--ink-3)" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter menu…"
                aria-label="Filter menu"
                // Without these the browser's password manager treats this as a
                // login field and drops the saved admin email into it on focus,
                // so opening the menu looked like a search nobody typed.
                type="search"
                name="dc-nav-filter"
                className="dc-nav-filter"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 0,
                  background: 'transparent',
                  outline: 'none',
                  color: 'var(--ink)',
                  font: `400 12.5px/1 ${FONT}`,
                }}
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  title="Clear"
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 18,
                    height: 18,
                    flex: 'none',
                    border: 0,
                    borderRadius: 5,
                    background: 'transparent',
                    color: 'var(--ink-3)',
                    cursor: 'pointer',
                  }}
                >
                  <DcIcon name="icon-x" size={12} />
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 10px 6px' }}>
            {showPinned ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  paddingBottom: 10,
                  marginBottom: 8,
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px 5px',
                    font: `700 10px/1 ${FONT}`,
                    letterSpacing: '.14em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-3)',
                  }}
                >
                  <DcIcon name="icon-pin" size={11} />
                  <span>Pinned</span>
                </div>
                {pinned.map((row) => (
                  <NavRow key={`pin-${row.href}`} row={row} active={row.href === activeHref} />
                ))}
              </div>
            ) : null}

            {filteredGroups.map((g) => {
              const here = g.items.some((it) => it.href === activeHref)
              return (
                <div
                  key={g.group}
                  style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 9 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      padding: '6px 10px',
                      background: 'var(--sidebar)',
                      font: `700 10px/1 ${FONT}`,
                      letterSpacing: '.14em',
                      textTransform: 'uppercase',
                      color: here ? 'var(--ink-2)' : 'var(--ink-3)',
                    }}
                  >
                    <span style={{ flex: 1, textAlign: 'left' }}>{g.group}</span>
                    {here ? (
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 99,
                          background: 'var(--violet)',
                        }}
                      />
                    ) : null}
                    <span style={{ font: `600 10px/1 ${MONO}`, color: 'var(--ink-3)', opacity: 0.65 }}>
                      {g.items.length}
                    </span>
                  </div>
                  {g.items.map((it) => (
                    <NavRow
                      key={it.href}
                      row={{
                        href: it.href,
                        label: it.label,
                        icon: it.icon,
                        ...(it.badge !== undefined ? { badge: it.badge } : {}),
                      }}
                      active={it.href === activeHref}
                    />
                  ))}
                </div>
              )
            })}

            {navEmpty ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  padding: '28px 12px',
                }}
              >
                <DcIcon name="icon-search-x" size={18} color="var(--ink-3)" />
                <span
                  style={{
                    font: `500 12.5px/1.4 ${FONT}`,
                    color: 'var(--ink-3)',
                    textAlign: 'center',
                  }}
                >
                  Nothing matches that
                </span>
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  style={{
                    height: 28,
                    padding: '0 11px',
                    borderRadius: 8,
                    border: '1px solid var(--line-2)',
                    background: 'var(--surface-2)',
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    font: `600 11.5px/1 ${FONT}`,
                  }}
                >
                  Show all {allRows.length}
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '8px 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {groups.map((g, gi) => (
            <div
              key={g.group}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                width: '100%',
              }}
            >
              <span
                title={g.group}
                style={{
                  width: 20,
                  height: 1,
                  background: gi === 0 ? 'transparent' : 'var(--line)',
                  margin: '5px 0 4px',
                }}
              />
              {g.items.map((it) => {
                const active = it.href === activeHref
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    title={it.label}
                    className={active ? undefined : 'dc-hover-surface'}
                    style={{
                      position: 'relative',
                      display: 'grid',
                      placeItems: 'center',
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      border: `1px solid ${active ? 'var(--violet-bd)' : 'transparent'}`,
                      background: active ? 'var(--violet-soft)' : 'transparent',
                      color: active ? 'var(--violet)' : 'var(--ink-2)',
                    }}
                  >
                    <DcIcon name={it.icon} size={15} />
                    {it.badge !== undefined && it.badge !== '' ? (
                      <span
                        style={{
                          position: 'absolute',
                          top: -2,
                          right: -2,
                          minWidth: 15,
                          height: 15,
                          padding: '0 3px',
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: 99,
                          font: `700 9px/1 ${FONT}`,
                          background: 'var(--violet-solid)',
                          color: 'var(--on-violet)',
                          border: '2px solid var(--sidebar)',
                        }}
                      >
                        {it.badge}
                      </span>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 'none', borderTop: '1px solid var(--line)', padding: '9px 10px' }}>
        <button
          type="button"
          onClick={() => (onOpenProfile ? onOpenProfile() : onSignOut?.())}
          className="dc-hover-surface"
          title="Open profile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            width: '100%',
            padding: '7px 8px',
            borderRadius: 9,
            border: '1px solid transparent',
            background: 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 28,
              height: 28,
              flex: 'none',
              borderRadius: 8,
              background: 'var(--violet-solid)',
              color: 'var(--on-violet)',
              font: `700 11px/1 ${FONT}`,
            }}
          >
            {user.initials}
          </span>
          {!collapsed ? (
            <>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <span style={{ font: `600 12.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                  {user.name}
                </span>
                <span
                  style={{
                    font: `400 11px/1 ${FONT}`,
                    color: 'var(--ink-3)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user.role}
                </span>
              </span>
              <DcIcon name="icon-user" size={14} color="var(--ink-3)" />
            </>
          ) : null}
        </button>
      </div>
    </aside>
  )
}

/** Logo lockup — swaps with the theme, matching the prototype's two files. */
function DcWordmark() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo/splaro-logo-black-premium.webp"
        alt="SPLARO"
        className="dc-logo-light"
        style={{ height: 17, width: 'auto', objectFit: 'contain', objectPosition: 'left' }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo/splaro-logo-white-premium.webp"
        alt="SPLARO"
        className="dc-logo-dark"
        style={{ height: 17, width: 'auto', objectFit: 'contain', objectPosition: 'left' }}
      />
    </>
  )
}
