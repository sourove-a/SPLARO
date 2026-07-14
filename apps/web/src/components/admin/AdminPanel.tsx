'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from '@/lib/motion/react'
import { Eye, EyeOff, X, ChevronRight } from 'lucide-react'
import {
  useAdminStore,
  SECTION_KEYS,
  SECTION_LABELS,
  type SectionKey,
} from '@/store/adminStore'

/* ── Applies/removes [data-hide-*] on <body> ─────────────────── */
function useSectionVisibility() {
  const sections = useAdminStore((s) => s.sections)

  useEffect(() => {
    SECTION_KEYS.forEach((key) => {
      const attr = `data-hide-${key}`
      if (sections[key]) {
        document.body.removeAttribute(attr)
      } else {
        document.body.setAttribute(attr, '')
      }
    })
  }, [sections])
}

/* ── Toggle Switch ────────────────────────────────────────────── */
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      className="relative h-6 w-10 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A97E] focus-visible:ring-offset-2"
      style={{
        background: on
          ? 'linear-gradient(135deg, #C8A97E 0%, #A8895E 100%)'
          : 'rgba(17,17,17,0.15)',
      }}
    >
      <span
        className="absolute top-0.5 block h-5 w-5 rounded-full bg-white shadow-md transition-all duration-200"
        style={{
          left: on ? 'calc(100% - 22px)' : '2px',
          boxShadow: '0 2px 6px rgba(17,17,17,0.20)',
        }}
      />
    </button>
  )
}

/* ── Admin Trigger (floating gear button) ────────────────────── */
export function AdminTrigger() {
  const setAdminOpen = useAdminStore((s) => s.setAdminOpen)
  const isAdminOpen = useAdminStore((s) => s.isAdminOpen)

  /* Keyboard shortcut: Ctrl+Shift+A */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        setAdminOpen(!isAdminOpen)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isAdminOpen, setAdminOpen])

  useSectionVisibility()

  return (
    <>
      <AdminPanel />
    </>
  )
}

/* ── Main Admin Panel ─────────────────────────────────────────── */
function AdminPanel() {
  const { sections, payments, isAdminOpen, setAdminOpen, toggleSection, togglePayment, showAll, hideAll } =
    useAdminStore()
  const panelRef = useRef<HTMLDivElement>(null)

  const visibleCount = Object.values(sections).filter(Boolean).length
  const totalCount = SECTION_KEYS.length

  /* Click outside closes */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setAdminOpen(false)
      }
    }
    if (isAdminOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isAdminOpen, setAdminOpen])

  return (
    <AnimatePresence>
      {isAdminOpen && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, x: -20, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -20, scale: 0.96 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-20 left-4 z-[70] w-72 overflow-hidden"
          style={{
            background: 'rgba(17,17,17,0.94)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: '1px solid rgba(200,169,126,0.25)',
            borderRadius: '20px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.40), 0 8px 24px rgba(0,0,0,0.20), inset 0 1.5px 0 rgba(255,255,255,0.08)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.22em] text-[#C8A97E]">
                Admin Panel
              </p>
              <p className="mt-0.5 text-[0.5rem] text-white/40">
                {visibleCount} of {totalCount} sections visible
              </p>
            </div>
            <button
              onClick={() => setAdminOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5 text-white/60" strokeWidth={2} />
            </button>
          </div>

          {/* Section toggles */}
          <div className="max-h-[360px] overflow-y-auto px-3 py-3">
            {SECTION_KEYS.map((key) => {
              const isOn = sections[key]
              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl px-2.5 py-2.5 transition-colors hover:bg-white/[0.06]"
                >
                  <div className="flex items-center gap-2.5">
                    {isOn ? (
                      <Eye className="h-3.5 w-3.5 text-[#C8A97E]" strokeWidth={2} />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-white/30" strokeWidth={2} />
                    )}
                    <span
                      className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] transition-colors"
                      style={{ color: isOn ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.30)' }}
                    >
                      {SECTION_LABELS[key as SectionKey]}
                    </span>
                  </div>
                  <Toggle on={isOn} onToggle={() => toggleSection(key as SectionKey)} />
                </div>
              )
            })}
          </div>

          {/* Payment method toggles */}
          <div className="border-t border-white/10 px-3 py-3">
            <p className="px-2.5 pb-2 text-[0.58rem] font-bold uppercase tracking-[0.18em] text-[#C8A97E]">
              Checkout payments
            </p>
            {(
              [
                ['bkash', 'bKash'],
                ['nagad', 'Nagad'],
              ] as const
            ).map(([key, label]) => {
              const isOn = payments[key]
              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl px-2.5 py-2.5 transition-colors hover:bg-white/[0.06]"
                >
                  <div className="flex items-center gap-2.5">
                    {isOn ? (
                      <Eye className="h-3.5 w-3.5 text-[#C8A97E]" strokeWidth={2} />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-white/30" strokeWidth={2} />
                    )}
                    <span
                      className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] transition-colors"
                      style={{ color: isOn ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.30)' }}
                    >
                      {label}
                    </span>
                  </div>
                  <Toggle on={isOn} onToggle={() => togglePayment(key)} />
                </div>
              )
            })}
            <p className="px-2.5 pt-1 text-[0.46rem] leading-relaxed text-white/30">
              Cash on Delivery and SSLCommerz stay visible. Enable mobile wallets when ready.
            </p>
          </div>

          {/* Footer actions */}
          <div className="flex gap-2 border-t border-white/10 px-3 py-3">
            <button
              onClick={showAll}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[0.5rem] font-bold uppercase tracking-[0.16em] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Eye className="h-3 w-3" strokeWidth={2} />
              Show All
            </button>
            <button
              onClick={hideAll}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[0.5rem] font-bold uppercase tracking-[0.16em] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <EyeOff className="h-3 w-3" strokeWidth={2} />
              Hide All
            </button>
          </div>

          {/* Tip */}
          <div className="flex items-center gap-1.5 border-t border-white/[0.06] px-5 py-3">
            <ChevronRight className="h-2.5 w-2.5 text-white/20" strokeWidth={2} />
            <p className="text-[0.46rem] text-white/25 tracking-widest uppercase">
              Ctrl+Shift+A to toggle
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
