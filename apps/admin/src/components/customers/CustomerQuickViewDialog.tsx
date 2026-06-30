'use client'

import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { CustomerProfileClient } from '@/components/customers/CustomerProfileClient'
import { AdminNavLink } from '@/components/layout/AdminNavLink'

interface CustomerQuickViewDialogProps {
  customerId: string | null
  onClose: () => void
}

export function CustomerQuickViewDialog({ customerId, onClose }: CustomerQuickViewDialogProps) {
  return (
    <AnimatePresence>
      {customerId ? (
        <>
          <motion.button
            type="button"
            aria-label="Close customer preview"
            className="fixed inset-0 z-[80] bg-black/25 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Customer profile"
            className="fixed inset-y-0 right-0 z-[81] flex w-full max-w-xl flex-col border-l border-white/70 bg-white/[0.94] shadow-[-24px_0_80px_rgba(17,17,20,0.14)] backdrop-blur-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
              <div>
                <p className="admin-page-eyebrow">Customer 360°</p>
                <h2 className="text-base font-black text-[#111111]">Profile preview</h2>
              </div>
              <div className="flex items-center gap-2">
                <AdminNavLink href={`/dashboard/customers/${customerId}`} className="admin-btn admin-btn--ghost !text-xs">
                  Open full page
                </AdminNavLink>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-black/8 bg-white/80 text-[#6B6B6B] hover:text-[#111111]"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <CustomerProfileClient customerId={customerId} />
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
