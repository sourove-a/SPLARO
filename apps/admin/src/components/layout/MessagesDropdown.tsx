'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Headphones } from 'lucide-react'
import { AdminNavLink } from '@/components/layout/AdminNavLink'

export function MessagesDropdown() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="admin-header-chip"
        aria-label="Messages"
        aria-expanded={open}
      >
        <MessageSquare className="h-4 w-4" strokeWidth={2} />
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <button
              type="button"
              aria-label="Close messages"
              className="fixed inset-0 z-[250] cursor-default bg-black/5 backdrop-blur-[1px]"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="admin-header-popover fixed right-4 top-[5.25rem] z-[300] w-80 overflow-hidden rounded-[22px] sm:right-6"
            >
              <div className="border-b border-[var(--admin-glass-border)] px-4 py-3">
                <p className="text-sm font-black text-[var(--admin-text)]">Messages</p>
                <p className="text-[10px] font-semibold text-[var(--admin-text-secondary)]">Live chat inbox</p>
              </div>
              <p className="px-4 py-8 text-center text-xs font-semibold leading-relaxed text-[var(--admin-text-secondary)]">
                No live messages yet. Connect WhatsApp or open Helpdesk when customer chat is enabled.
              </p>
              <div className="border-t border-[var(--admin-glass-border)] p-2">
                <AdminNavLink
                  href="/dashboard/support/helpdesk"
                  onNavigate={() => setOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-[14px] py-2 text-xs font-black text-[var(--admin-text)] hover:bg-[var(--admin-surface-hover)]"
                >
                  <Headphones className="h-3.5 w-3.5" />
                  Open helpdesk
                </AdminNavLink>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
