'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  buildFallbackRowActions,
  buildRowActionPresets,
  type RowActionItem,
} from '@/lib/admin/row-action-presets'
import { hasBackendRecordApi } from '@/lib/modules/module-maturity'
import { backendMissingRowAction } from '@/lib/admin/row-action-presets'
import { useAdminNavigate } from '@/lib/navigation/client-nav'

interface RowActionsMenuProps {
  recordName: string
  moduleHref: string
  recordId: string
  actions?: RowActionItem[]
}

const LIVE_DETAIL: Record<string, { view: (id: string) => string; edit?: (id: string) => string }> = {
  '/dashboard/customers': {
    view: (id) => `/dashboard/customers/${id}`,
    edit: (id) => `/dashboard/customers/${id}`,
  },
  '/dashboard/orders': {
    view: (id) => `/dashboard/orders/${id}`,
    edit: (id) => `/dashboard/orders/${id}`,
  },
  '/dashboard/products': {
    view: (id) => `/dashboard/products/${id}`,
    edit: (id) => `/dashboard/products/${id}/edit`,
  },
  '/dashboard/invoices': {
    view: (id) => `/dashboard/invoices/${id}`,
  },
}

const MENU_ESTIMATE_PX = 148

export function RowActionsMenu({ recordName, moduleHref, recordId, actions }: RowActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0, openUp: false })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const { navigate } = useAdminNavigate()
  const live = hasBackendRecordApi(moduleHref) ? LIVE_DETAIL[moduleHref] : undefined

  useEffect(() => setMounted(true), [])

  const close = useCallback(() => setOpen(false), [])

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const menuHeight = menuRef.current?.offsetHeight ?? MENU_ESTIMATE_PX
    const openUp = spaceBelow < menuHeight + 16
    setPos({
      top: openUp ? Math.max(8, rect.top - menuHeight - 6) : rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
      openUp,
    })
  }, [])

  const handleOpen = () => {
    if (!open) {
      updatePosition()
      setOpen(true)
      return
    }
    close()
  }

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const onScrollOrResize = () => close()
    window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true })
    window.addEventListener('resize', onScrollOrResize, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, { capture: true })
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, close])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  const go = (path: string) => {
    close()
    navigate(path)
  }

  const presetArgs = { moduleHref, recordId, recordName, navigate, close }

  const menuItems: RowActionItem[] =
    actions ??
    buildRowActionPresets(presetArgs) ??
    (live
      ? [
          { label: 'View details', onClick: () => go(live.view(recordId)) },
          ...(live.edit
            ? [{ label: 'Edit', onClick: () => go(live.edit!(recordId)) }]
            : []),
          backendMissingRowAction('Archive'),
        ]
      : buildFallbackRowActions(presetArgs))

  const menu =
    open && mounted
      ? createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[310] cursor-default bg-transparent"
              onClick={close}
              aria-label="Close menu"
            />
            <div
              ref={menuRef}
              role="menu"
              className="admin-dropdown-menu fixed z-[320] min-w-[168px] overflow-hidden rounded-[12px] border border-black/8 bg-white py-1 shadow-[0_12px_32px_rgba(17,17,20,0.12)] dark:border-white/10 dark:bg-[#1c1c24] dark:shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
              style={{ top: pos.top, right: pos.right }}
            >
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  aria-disabled={item.disabled}
                  title={item.disabled ? (item.disabledTitle ?? 'Backend not connected for this action') : undefined}
                  className={cn(
                    'admin-dropdown-menu__item block w-full px-3 py-2 text-left text-xs font-semibold',
                    item.disabled && 'cursor-not-allowed opacity-45',
                    !item.disabled && item.tone === 'danger'
                      ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10'
                      : !item.disabled && 'text-[var(--admin-text)]',
                    item.disabled && item.tone === 'danger' && 'text-red-400',
                  )}
                  onClick={item.disabled ? undefined : item.onClick}
                >
                  {item.label}
                  {item.disabled ? (
                    <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                      Not connected
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )
      : null

  return (
    <div className="relative flex justify-end">
      <button
        ref={btnRef}
        type="button"
        className="admin-row-actions-trigger p-2 text-[var(--admin-text-secondary)]"
        onClick={handleOpen}
        aria-label={`Actions for ${recordName}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menu}
    </div>
  )
}
