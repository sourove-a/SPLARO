'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import type { CuratedCollectionItem } from './CollectionsPage'

interface CollectionCardProps {
  item: CuratedCollectionItem
  onInspect: (item: CuratedCollectionItem) => void
  isHovered?: boolean
  isAnyHovered?: boolean
  onCardHover?: (id: string | null) => void
  /** Set on the first card so the grid's LCP image is not lazily fetched. */
  priority?: boolean
}

export function Collection3DCard({
  item,
  onInspect,
  isHovered = false,
  isAnyHovered = false,
  onCardHover,
  priority = false,
}: CollectionCardProps) {
  // Focus Cards logic: if another card is hovered, gently soften this card
  const isDimmed = isAnyHovered && !isHovered

  return (
    <div
      onMouseEnter={() => onCardHover?.(item.id)}
      onMouseLeave={() => onCardHover?.(null)}
      className={`group relative flex flex-col rounded-[24px] transition-opacity duration-300 ${
        isDimmed ? 'opacity-60' : 'opacity-100'
      }`}
    >
      {/* ── Stable Luxury Card Shell (No 3D Tilt, No Jitter) ── */}
      <div className="relative flex flex-col overflow-hidden rounded-[24px] border border-black/10 bg-white/90 backdrop-blur-2xl shadow-sm transition-all duration-300 ease-out group-hover:border-black/25 group-hover:shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
        {/* Image Media Container */}
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-950">
          <Image
            src={item.image}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />

          {/* Luxury vignette layers */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-85 group-hover:opacity-90 transition-opacity pointer-events-none"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent opacity-60 pointer-events-none"
            aria-hidden
          />

          {/* Floating Tag Badge */}
          <div className="absolute top-4 left-4 z-20 pointer-events-none">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/75 backdrop-blur-2xl px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white border border-white/20 shadow-md">
              <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,1)]" />
              {item.tag}
            </span>
          </div>

          {/* Editorial Typography Details — the whole media is the collection link */}
          <Link
            href={item.href}
            className="absolute inset-0 z-20 flex flex-col justify-end p-5 sm:p-6 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
          >
            <h3
              className="text-2xl font-normal tracking-tight text-white group-hover:text-zinc-100 transition-colors drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}
            >
              {item.title}
            </h3>
            <p className="mt-1.5 text-xs text-zinc-200/90 line-clamp-2 leading-relaxed font-light">
              {item.subtitle}
            </p>
          </Link>

          {/* Quick Peek Button in Top Right — sibling of the link, never nested inside it */}
          <button
            type="button"
            onClick={() => onInspect(item)}
            title={`Inspect ${item.title}`}
            className="group/peek absolute top-4 right-4 z-30 inline-flex items-center gap-1.5 rounded-full bg-black/70 hover:bg-white text-white hover:text-black backdrop-blur-2xl px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] border border-white/25 hover:border-white transition-all duration-200 shadow-sm"
          >
            <Sparkles className="h-3 w-3 text-white group-hover/peek:text-black transition-colors" />
            <span>Peek</span>
          </button>
        </div>

        {/* Card Action Footer */}
        <div className="flex items-center justify-between gap-3 p-4 px-5 bg-white/95 backdrop-blur-xl border-t border-black/5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            {item.pieceCount > 0
              ? `${item.pieceCount} ${item.pieceCount === 1 ? 'Piece' : 'Pieces'}`
              : 'Browse Room'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onInspect(item)}
              className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-black/5 hover:bg-black/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-black transition-colors duration-200"
            >
              <Sparkles className="h-3 w-3 text-zinc-700" />
              <span>Peek</span>
            </button>
            <Link
              href={item.href}
              className="group/btn relative inline-flex items-center gap-2 rounded-full bg-black hover:bg-zinc-800 text-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] shadow-sm transition-colors duration-200"
            >
              <span>Explore</span>
              <span className="sr-only">{item.title}</span>
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-white transition-transform duration-300 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5">
                <ArrowUpRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
