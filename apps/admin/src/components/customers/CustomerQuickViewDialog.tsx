'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { CustomerProfileClient } from '@/components/customers/CustomerProfileClient'
import { AdminLinkButton } from '@/components/ui/AdminButton'

interface CustomerQuickViewDialogProps {
  customerId: string | null
  onClose: () => void
}

export function CustomerQuickViewDialog({ customerId, onClose }: CustomerQuickViewDialogProps) {
  useEffect(() => {
    if (!customerId) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [customerId, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {customerId ? (
        <div className="admin-customer-preview-root" key={customerId}>
          <motion.button
            type="button"
            aria-label="Close customer preview"
            className="admin-customer-preview__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Customer profile preview"
            className="admin-customer-preview admin-drawer"
            initial={{ x: 28, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 28, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="admin-customer-preview__header">
              <div className="min-w-0">
                <p className="admin-page-eyebrow">Customer 360°</p>
                <h2 className="admin-customer-preview__title">Profile preview</h2>
              </div>
              <div className="admin-customer-preview__actions">
                <AdminLinkButton href={`/dashboard/customers/${customerId}`} variant="ghost" size="sm">
                  Open full page
                </AdminLinkButton>
                <button
                  type="button"
                  onClick={onClose}
                  className="admin-customer-preview__close"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="admin-customer-preview__body">
              <CustomerProfileClient customerId={customerId} />
            </div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
