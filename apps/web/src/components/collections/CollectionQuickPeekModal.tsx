'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { X, ArrowUpRight, Gem, ShieldCheck, Sparkles } from 'lucide-react'
import type { CuratedCollectionItem } from './CollectionsPage'

interface CollectionQuickPeekModalProps {
  item: CuratedCollectionItem | null
  onClose: () => void
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

export function CollectionQuickPeekModal({ item, onClose }: CollectionQuickPeekModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!item) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      // Keep Tab inside the dialog — aria-modal alone does not trap focus.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      } else if (!dialog.contains(document.activeElement)) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    // Prevent background scrolling while modal is open
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
      previouslyFocused?.focus?.()
    }
  }, [item])

  if (!item) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10"
    >
      {/* ── Dark Backdrop Blur Sheen ── */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
        aria-hidden
      />

      {/* ── Floating Modal Card (Pure Monochrome Glass) ── */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Inspect ${item.title}`}
        className="relative z-10 w-full max-w-3xl overflow-hidden rounded-[26px] border border-white/20 bg-[#0c0d10]/95 text-white shadow-[0_30px_90px_rgba(0,0,0,0.85)] backdrop-blur-3xl animate-fade-in"
      >
        {/* Close Button */}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="absolute top-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-xl border border-white/20 transition-all duration-300 hover:bg-white hover:text-black hover:scale-105"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12">
          {/* Left Column: Media Visual Showcase */}
          <div className="relative aspect-[4/3] md:aspect-auto md:col-span-5 w-full min-h-[260px] md:min-h-[440px] bg-zinc-950 overflow-hidden">
            <Image
              src={item.image}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 360px"
              className="object-cover object-center"
              priority
            />
            <div
              className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/80 via-black/25 to-transparent"
              aria-hidden
            />
            <div className="absolute bottom-4 left-4 right-4 md:hidden">
              <span className="rounded-full bg-black/60 backdrop-blur-xl px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white border border-white/20">
                {item.tag}
              </span>
            </div>
          </div>

          {/* Right Column: Atelier Breakdown & Specs */}
          <div className="p-6 sm:p-8 md:col-span-7 flex flex-col justify-between">
            <div>
              <div className="hidden md:inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white border border-white/20">
                <Sparkles className="h-3 w-3 text-white" />
                {item.tag}
              </div>

              <h3
                className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-normal tracking-tight text-white"
                style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}
              >
                {item.title}
              </h3>

              <p className="mt-3 text-xs sm:text-sm text-zinc-300/90 leading-relaxed font-light">
                {item.subtitle}
              </p>

              {/* Atelier Specs Matrix */}
              <div className="mt-6 space-y-3 rounded-2xl bg-white/[0.04] p-4 border border-white/[0.08]">
                <div className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-zinc-400 font-medium uppercase tracking-[0.12em]">Edition Type</span>
                  <span className="text-white font-semibold uppercase tracking-[0.08em]">Curated Capsule</span>
                </div>
                <div className="h-px bg-white/[0.06]" />
                <div className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-zinc-400 font-medium uppercase tracking-[0.12em]">Craftsmanship</span>
                  <span className="text-zinc-200 text-right">Artisanal Loom &amp; Master Tailored</span>
                </div>
                <div className="h-px bg-white/[0.06]" />
                <div className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-zinc-400 font-medium uppercase tracking-[0.12em]">Availability</span>
                  <span className="text-white font-semibold text-right">
                    {item.pieceCount > 0
                      ? `${item.pieceCount} ${item.pieceCount === 1 ? 'Piece' : 'Pieces'} Ready`
                      : 'Restocking Soon'}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-zinc-300" />
                  Authentic Fabric
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Gem className="h-3.5 w-3.5 text-zinc-300" />
                  Signature Packaging
                </span>
              </div>
            </div>

            {/* Action Buttons (Full Glass Monochrome) */}
            <div className="mt-8 pt-5 border-t border-white/[0.08] flex items-center gap-3">
              <Link
                href={item.href}
                onClick={onClose}
                className="group/btn flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-white hover:bg-zinc-200 px-6 py-3.5 text-xs font-extrabold uppercase tracking-[0.16em] text-black shadow-[0_0_25px_rgba(255,255,255,0.35),inset_0_1px_1px_rgba(255,255,255,1)] transition-all duration-300 hover:scale-[1.02] active:scale-95"
              >
                <span>Enter Collection</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-black transition-transform duration-300 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/20 bg-white/10 hover:bg-white text-white hover:text-black px-6 py-3.5 text-xs font-bold uppercase tracking-[0.14em] backdrop-blur-2xl transition-all duration-300 hover:scale-105 active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
