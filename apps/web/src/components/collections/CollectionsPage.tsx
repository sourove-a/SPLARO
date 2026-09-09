'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, Sparkles, ShieldCheck, Truck, Gem, LayoutGrid, Box } from 'lucide-react'
import type { CollectionRoom, CollectionRoomCategory } from '@/lib/catalog/collection-rooms'
import { cn } from '@/lib/utils/cn'
import { CollectionsStardust } from './CollectionsStardust'
import { Collection3DCard } from './Collection3DCard'
import { Collections3DStage } from './Collections3DStage'
import { CollectionQuickPeekModal } from './CollectionQuickPeekModal'

export type CollectionFilterTab = 'all' | CollectionRoomCategory
export type CollectionViewMode = 'stage' | 'grid'

/** Shape rendered by every collections surface — resolved on the server. */
export type CuratedCollectionItem = CollectionRoom

const FILTER_TABS: { id: CollectionFilterTab; label: string }[] = [
  { id: 'all', label: 'All Collections' },
  { id: 'heritage', label: 'Heritage & Silk' },
  { id: 'drops', label: 'Signature Drops' },
  { id: 'seasonal', label: 'Seasonal Capsule' },
  { id: 'footwear', label: 'Footwear & Leather' },
]

interface CollectionsPageProps {
  rooms: CollectionRoom[]
}

export function CollectionsPage({ rooms }: CollectionsPageProps) {
  const [requestedTab, setRequestedTab] = useState<CollectionFilterTab>('all')
  const [viewMode, setViewMode] = useState<CollectionViewMode>('stage')
  const [inspectingItem, setInspectingItem] = useState<CuratedCollectionItem | null>(null)
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null)

  // Only offer a tab when at least one room lands in it.
  const tabs = useMemo(() => {
    const counts = new Map<CollectionFilterTab, number>()
    for (const room of rooms) {
      counts.set(room.category, (counts.get(room.category) ?? 0) + 1)
    }
    return FILTER_TABS.filter((tab) => tab.id === 'all' || (counts.get(tab.id) ?? 0) > 0).map((tab) => ({
      ...tab,
      count: tab.id === 'all' ? rooms.length : (counts.get(tab.id) ?? 0),
    }))
  }, [rooms])

  // Derived, never stored: a tab that disappears falls back to "all" without an effect.
  const activeTab = tabs.some((tab) => tab.id === requestedTab) ? requestedTab : 'all'

  const filtered = useMemo(() => {
    if (activeTab === 'all') return rooms
    return rooms.filter((room) => room.category === activeTab)
  }, [activeTab, rooms])

  const spotlight = useMemo(() => rooms.find((room) => room.isSpotlight) ?? rooms[0], [rooms])

  const remaining = useMemo(() => {
    if (activeTab === 'all' && spotlight) {
      return filtered.filter((room) => room.id !== spotlight.id)
    }
    return filtered
  }, [activeTab, filtered, spotlight])

  const hasRooms = rooms.length > 0
  const gridItems = viewMode === 'grid' ? remaining : filtered

  return (
    <div className="collections-lux relative min-h-screen bg-[#f8f9fa] text-[#0a0a0c] overflow-hidden">
      {/* ── Ambient Haute-Couture Stardust Particles ── */}
      <CollectionsStardust />

      {/* ── Top Ambient Radial Glow (Monochrome Glass) ── */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[500px] opacity-70 z-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(255, 255, 255, 0.6), transparent 75%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-[1360px] px-4 pt-4 pb-20 sm:px-6 lg:px-10 lg:pt-6">
        {/* ── Breadcrumb & Navigation Back ── */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-6 border-b border-black/[0.08]">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-black"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
            <span className="hidden sm:inline">SPLARO Atelier</span>
            <span className="hidden sm:inline text-zinc-300">•</span>
            <span className="text-zinc-900 font-bold">
              {rooms.length} {rooms.length === 1 ? 'Curated Room' : 'Curated Rooms'}
            </span>
          </div>
        </div>

        {/* ── Editorial Masthead ── */}
        <header className="pt-10 pb-8 sm:pt-14 sm:pb-12 text-center max-w-3xl mx-auto relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.04] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-black shadow-sm backdrop-blur-xl">
            <Sparkles className="h-3 w-3 text-black" />
            Curated Haute Couture Atelier
          </div>
          <h1
            className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-normal tracking-[-0.03em] text-[#0f1013]"
            style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}
          >
            Lines with a point of view.
          </h1>
          <p className="mt-4 text-sm sm:text-base leading-relaxed text-zinc-600 max-w-xl mx-auto font-light">
            Distinct capsule wardrobes and limited seasonal chapters — designed with intention,
            master-tailored for enduring luxury.
          </p>

          {hasRooms ? (
            <>
              {/* ── Interactive View Mode Switch (Rock-Solid Geometry, Zero Layout Shift) ── */}
              <div
                role="group"
                aria-label="Collections layout"
                className="mt-7 inline-flex items-center rounded-full bg-white/90 backdrop-blur-2xl p-1.5 border border-black/10 shadow-[0_4px_24px_rgba(0,0,0,0.06)]"
              >
                <button
                  type="button"
                  onClick={() => setViewMode('stage')}
                  aria-pressed={viewMode === 'stage'}
                  className={cn(
                    'relative inline-flex items-center gap-2 rounded-full px-5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors duration-200 select-none cursor-pointer',
                    viewMode === 'stage'
                      ? 'bg-black text-white shadow-[0_2px_12px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.2)] ring-1 ring-white/20'
                      : 'text-zinc-600 hover:text-black hover:bg-black/[0.04]',
                  )}
                >
                  <Box className={cn('h-3.5 w-3.5', viewMode === 'stage' ? 'text-white' : 'text-zinc-400')} />
                  <span>Runway Showcase</span>
                  {viewMode === 'stage' && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,1)]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  aria-pressed={viewMode === 'grid'}
                  className={cn(
                    'relative inline-flex items-center gap-2 rounded-full px-5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors duration-200 select-none cursor-pointer',
                    viewMode === 'grid'
                      ? 'bg-black text-white shadow-[0_2px_12px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.2)] ring-1 ring-white/20'
                      : 'text-zinc-600 hover:text-black hover:bg-black/[0.04]',
                  )}
                >
                  <LayoutGrid className={cn('h-3.5 w-3.5', viewMode === 'grid' ? 'text-white' : 'text-zinc-400')} />
                  <span>Editorial Grid</span>
                  {viewMode === 'grid' && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,1)]" />
                  )}
                </button>
              </div>

              {/* ── Haute-Couture Category Filter Rail ── */}
              {tabs.length > 1 ? (
                <nav
                  aria-label="Filter collections by category"
                  className="mt-6 flex items-center justify-center w-full"
                >
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-4xl mx-auto py-1">
                    {tabs.map((tab) => {
                      const active = activeTab === tab.id

                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setRequestedTab(tab.id)}
                          aria-pressed={active}
                          className={cn(
                            'relative inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 sm:px-6 sm:py-2.5 text-xs font-semibold tracking-[0.06em] uppercase whitespace-nowrap transition-colors duration-200 select-none cursor-pointer',
                            active
                              ? 'bg-black text-white border border-black shadow-[0_2px_12px_rgba(0,0,0,0.18)] ring-1 ring-white/20'
                              : 'border border-black/15 bg-white/90 text-zinc-700 hover:text-black hover:bg-white hover:border-black/35 shadow-sm backdrop-blur-xl',
                          )}
                        >
                          {active && (
                            <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,1)]" />
                          )}
                          <span>{tab.label}</span>
                          <span className="text-[10px] font-mono text-zinc-400">({tab.count})</span>
                        </button>
                      )
                    })}
                  </div>
                </nav>
              ) : null}
            </>
          ) : null}
        </header>

        {!hasRooms ? (
          <div className="mx-auto max-w-xl rounded-[28px] border border-black/10 bg-white/85 backdrop-blur-2xl p-10 text-center shadow-sm">
            <p className="text-sm text-zinc-600 font-light">
              Collections will appear here as they are published.
            </p>
            <Link
              href="/shop"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-xs font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-800"
            >
              Shop All Catalog
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : null}

        {/* ── RUNWAY SHOWCASE VIEW ── */}
        {hasRooms && viewMode === 'stage' ? (
          <div className="mb-14 sm:mb-20 animate-fade-in">
            <Collections3DStage
              collections={filtered}
              onInspect={(item) => setInspectingItem(item)}
              keyboardEnabled={inspectingItem === null}
            />
          </div>
        ) : null}

        {/* ── Spotlight Hero Showcase (Featured Flagship Room) ── */}
        {hasRooms && activeTab === 'all' && spotlight && viewMode === 'grid' ? (
          <div className="mb-12 sm:mb-16">
            <div className="group relative block overflow-hidden rounded-[28px] border border-black/10 bg-zinc-950 shadow-2xl transition-all duration-500 hover:shadow-[0_25px_60px_rgba(0,0,0,0.18)]">
              <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full min-h-[360px] sm:min-h-[460px] overflow-hidden">
                <Image
                  src={spotlight.image}
                  alt={spotlight.title}
                  fill
                  priority
                  sizes="(max-width: 1280px) 100vw, 1360px"
                  className="object-cover object-center transition-transform duration-1000 ease-out group-hover:scale-[1.03]"
                />
                {/* Gradient vignette sheen */}
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/10 pointer-events-none"
                  aria-hidden
                />
                <div
                  className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/35 to-transparent pointer-events-none"
                  aria-hidden
                />

                {/* Content Overlay */}
                <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10 lg:p-14">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1 text-[11px] font-bold tracking-[0.18em] text-white uppercase backdrop-blur-2xl border border-white/25 shadow-lg">
                      <Gem className="h-3 w-3 text-white" />
                      {spotlight.tag}
                    </div>
                    <h2
                      className="mt-3 text-3xl sm:text-5xl font-normal tracking-tight text-white drop-shadow-md"
                      style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}
                    >
                      {spotlight.title}
                    </h2>
                    <p className="mt-3 text-xs sm:text-sm md:text-base text-zinc-200/90 leading-relaxed line-clamp-2 sm:line-clamp-none font-light">
                      {spotlight.subtitle}
                    </p>

                    <div className="mt-6 flex flex-wrap items-center gap-3 sm:gap-4">
                      <Link
                        href={spotlight.href}
                        className="group/btn inline-flex items-center gap-2.5 rounded-full bg-white hover:bg-zinc-200 px-7 py-3.5 text-xs font-extrabold uppercase tracking-[0.16em] text-black shadow-lg transition-colors duration-200"
                      >
                        <span>Explore Collection</span>
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-black transition-transform duration-300 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => setInspectingItem(spotlight)}
                        className="group/peek inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 hover:bg-white text-white hover:text-black px-6 py-3.5 text-xs font-bold uppercase tracking-[0.16em] backdrop-blur-2xl shadow-lg transition-colors duration-200"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-white group-hover/peek:text-black transition-colors" />
                        <span>Inspect Room</span>
                      </button>
                      {spotlight.pieceCount > 0 ? (
                        <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-300">
                          {spotlight.pieceCount} {spotlight.pieceCount === 1 ? 'Piece' : 'Pieces'} Available
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Curated Collection Cards Section ── */}
        {hasRooms ? (
          <section aria-label="Curated Collections Grid">
            <div className="flex flex-wrap items-end justify-between gap-4 pb-6 mb-8 border-b border-black/[0.08]">
              <div>
                <h2
                  className="text-2xl sm:text-3xl font-medium tracking-tight text-zinc-900"
                  style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}
                >
                  {activeTab === 'all' ? 'All Capsule Lines' : tabs.find((t) => t.id === activeTab)?.label}
                </h2>
                <p className="text-xs text-zinc-500 uppercase tracking-[0.12em] mt-1">
                  Showing {gridItems.length} {gridItems.length === 1 ? 'collection' : 'collections'}
                </p>
              </div>
              <Link
                href="/shop"
                className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-zinc-900 hover:text-black transition-colors"
              >
                Shop All Catalog
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Elevated Collections Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {gridItems.map((item, index) => (
                <Collection3DCard
                  key={item.id}
                  item={item}
                  onInspect={(target) => setInspectingItem(target)}
                  isHovered={hoveredCardId === item.id}
                  isAnyHovered={hoveredCardId !== null}
                  onCardHover={setHoveredCardId}
                  priority={viewMode === 'grid' && index === 0}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Brand Craftsmanship & Atelier Manifesto Strip (Pure Monochrome Glass) ── */}
        <section className="mt-20 sm:mt-24 rounded-[28px] border border-black/10 bg-white/80 backdrop-blur-2xl p-8 sm:p-12 text-center shadow-sm relative overflow-hidden">
          <div
            className="pointer-events-none absolute -right-20 -bottom-20 h-60 w-60 rounded-full bg-black/5 blur-3xl"
            aria-hidden
          />
          <div className="max-w-2xl mx-auto relative z-10">
            <span className="text-xs font-extrabold uppercase tracking-[0.25em] text-zinc-500">
              The SPLARO Philosophy
            </span>
            <h3
              className="mt-3 text-2xl sm:text-3xl font-normal tracking-tight text-zinc-900"
              style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}
            >
              “Every collection is a deliberate chapter — fabrics chosen with conviction, crafted for timeless presence.”
            </h3>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-black/5 text-left sm:text-center relative z-10">
            <div className="flex flex-col items-start sm:items-center">
              <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-black border border-black/10">
                <Gem className="h-5 w-5" />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-900">
                Artisanal Integrity
              </h4>
              <p className="mt-1 text-xs text-zinc-500 font-light">
                Master weaving, authentic silk, and hand-finished garment details.
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-center">
              <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-black border border-black/10">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-900">
                Limited Capsule Runs
              </h4>
              <p className="mt-1 text-xs text-zinc-500 font-light">
                Produced in curated batches to preserve exclusivity and exceptional quality.
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-center">
              <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-black border border-black/10">
                <Truck className="h-5 w-5" />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-900">
                Nationwide Delivery
              </h4>
              <p className="mt-1 text-xs text-zinc-500 font-light">
                Tracked courier delivery across all 64 districts in Bangladesh.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ── Inspection Quick Peek Modal ── */}
      <CollectionQuickPeekModal item={inspectingItem} onClose={() => setInspectingItem(null)} />
    </div>
  )
}
