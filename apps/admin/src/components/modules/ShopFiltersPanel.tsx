'use client'

import { ArrowDown, ArrowUp, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import type { ShopFiltersConfig, ShopPriceBandConfig, ShopSortOptionConfig } from '@splaro/types'
import { DEFAULT_SHOP_FILTERS } from '@splaro/types'
import { cn } from '@/lib/utils/cn'

interface ShopFiltersPanelProps {
  filters: ShopFiltersConfig
  savedFilters?: ShopFiltersConfig
  onChange: (filters: ShopFiltersConfig) => void
  onSave: () => void
  saving?: boolean
}

function filtersEqual(a: ShopFiltersConfig, b: ShopFiltersConfig) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const next = [...items]
  const target = index + direction
  if (target < 0 || target >= next.length) return next
  const current = next[index]
  const swap = next[target]
  if (current === undefined || swap === undefined) return next
  next[index] = swap
  next[target] = current
  return next
}

function updateSortOption(
  options: ShopSortOptionConfig[],
  id: string,
  patch: Partial<ShopSortOptionConfig>,
) {
  return options.map((option) => (option.id === id ? { ...option, ...patch } : option))
}

function updatePriceBand(
  bands: ShopPriceBandConfig[],
  id: string,
  patch: Partial<ShopPriceBandConfig>,
) {
  return bands.map((band) => (band.id === id ? { ...band, ...patch } : band))
}

export function ShopFiltersPanel({
  filters,
  savedFilters,
  onChange,
  onSave,
  saving = false,
}: ShopFiltersPanelProps) {
  const baseline = savedFilters ?? DEFAULT_SHOP_FILTERS
  const dirty = !filtersEqual(filters, baseline)

  const patch = (next: Partial<ShopFiltersConfig>) => onChange({ ...filters, ...next })

  return (
    <div className="space-y-5">
      <section className="admin-module-card">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="admin-module-card__title flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Shop filter bar
            </h3>
            <p className="admin-module-card__text mt-1">
              Control labels, sort options, price bands, and which filters appear on /shop.
              Category pills are managed in the Catalog tab.
            </p>
          </div>
          {dirty ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
              Unsaved changes
            </span>
          ) : null}
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-2">
          {(
            [
              ['showColorFilter', 'Color filter'],
              ['showSizeFilter', 'Size filter'],
              ['showPriceFilter', 'Price filter'],
              ['showSortFilter', 'Sort filter'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="admin-check-row">
              <span className="text-sm font-semibold">{label}</span>
              <input
                type="checkbox"
                checked={filters[key]}
                onChange={() => patch({ [key]: !filters[key] })}
                className="h-4 w-4 accent-[#5E7CFF]"
              />
            </label>
          ))}
        </div>

        <h4 className="mb-2 text-sm font-bold text-[#1A1A1A]">Filter labels</h4>
        <div className="mb-5 grid gap-3 md:grid-cols-2">
          {(
            [
              ['color', 'Color label'],
              ['size', 'Size label'],
              ['price', 'Price label'],
              ['sort', 'Sort label'],
              ['all', '“All” option label'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              <span className="mb-1 block text-xs font-semibold text-[#6B6B6B]">{label}</span>
              <input
                className="admin-input"
                value={filters.labels[key]}
                onChange={(e) =>
                  patch({ labels: { ...filters.labels, [key]: e.target.value } })
                }
              />
            </label>
          ))}
        </div>

        <h4 className="mb-2 text-sm font-bold text-[#1A1A1A]">Sort options</h4>
        <div className="space-y-2">
          {filters.sortOptions.map((option, index) => (
            <div
              key={option.id}
              className={cn(
                'grid gap-2 rounded-[14px] border border-black/6 bg-white/70 p-3 md:grid-cols-[auto_1fr_auto_auto]',
                !option.enabled && 'opacity-60',
              )}
            >
              <div className="flex items-center gap-1">
                <AdminButton
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() => patch({ sortOptions: moveItem(filters.sortOptions, index, -1) })}
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </AdminButton>
                <AdminButton
                  variant="ghost"
                  disabled={index === filters.sortOptions.length - 1}
                  onClick={() => patch({ sortOptions: moveItem(filters.sortOptions, index, 1) })}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </AdminButton>
              </div>
              <input
                className="admin-input"
                value={option.label}
                onChange={(e) =>
                  patch({
                    sortOptions: updateSortOption(filters.sortOptions, option.id, {
                      label: e.target.value,
                    }),
                  })
                }
              />
              <label className="admin-check-row justify-end">
                <span className="text-xs font-semibold">Show</span>
                <input
                  type="checkbox"
                  checked={option.enabled}
                  onChange={() =>
                    patch({
                      sortOptions: updateSortOption(filters.sortOptions, option.id, {
                        enabled: !option.enabled,
                      }),
                    })
                  }
                  className="h-4 w-4 accent-[#5E7CFF]"
                />
              </label>
            </div>
          ))}
        </div>

        <h4 className="mb-2 mt-6 text-sm font-bold text-[#1A1A1A]">Desktop price bands</h4>
        <p className="admin-module-card__text mb-3">
          Min/max in BDT. Leave min empty for “under”, max empty for “above”.
        </p>
        <div className="space-y-2">
          {filters.priceBands.map((band, index) => (
            <PriceBandRow
              key={band.id}
              band={band}
              index={index}
              total={filters.priceBands.length}
              onMove={(direction) =>
                patch({ priceBands: moveItem(filters.priceBands, index, direction) })
              }
              onChange={(patchBand) =>
                patch({
                  priceBands: updatePriceBand(filters.priceBands, band.id, patchBand),
                })
              }
            />
          ))}
        </div>

        <h4 className="mb-2 mt-6 text-sm font-bold text-[#1A1A1A]">Mobile quick price chips</h4>
        <div className="space-y-2">
          {filters.mobilePriceChips.map((band, index) => (
            <PriceBandRow
              key={band.id}
              band={band}
              index={index}
              total={filters.mobilePriceChips.length}
              onMove={(direction) =>
                patch({ mobilePriceChips: moveItem(filters.mobilePriceChips, index, direction) })
              }
              onChange={(patchBand) =>
                patch({
                  mobilePriceChips: updatePriceBand(filters.mobilePriceChips, band.id, patchBand),
                })
              }
            />
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <AdminButton
            variant="ghost"
            onClick={() => onChange({ ...DEFAULT_SHOP_FILTERS })}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to defaults
          </AdminButton>
          <AdminButton variant="gold" loading={saving} disabled={!dirty} onClick={onSave}>
            Save shop filters
          </AdminButton>
        </div>
      </section>
    </div>
  )
}

function PriceBandRow({
  band,
  index,
  total,
  onMove,
  onChange,
}: {
  band: ShopPriceBandConfig
  index: number
  total: number
  onMove: (direction: -1 | 1) => void
  onChange: (patch: Partial<ShopPriceBandConfig>) => void
}) {
  return (
    <div
      className={cn(
        'grid gap-2 rounded-[14px] border border-black/6 bg-white/70 p-3 md:grid-cols-[auto_1fr_100px_100px_auto]',
        !band.enabled && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-1">
        <AdminButton
          variant="ghost"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          aria-label="Move up"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </AdminButton>
        <AdminButton
          variant="ghost"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          aria-label="Move down"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </AdminButton>
      </div>
      <input
        className="admin-input"
        value={band.label}
        onChange={(e) => onChange({ label: e.target.value })}
      />
      <input
        className="admin-input"
        type="number"
        min={0}
        placeholder="Min"
        value={band.min ?? ''}
        onChange={(e) =>
          onChange({ min: e.target.value === '' ? null : Number(e.target.value) })
        }
      />
      <input
        className="admin-input"
        type="number"
        min={0}
        placeholder="Max"
        value={band.max ?? ''}
        onChange={(e) =>
          onChange({ max: e.target.value === '' ? null : Number(e.target.value) })
        }
      />
      <label className="admin-check-row justify-end">
        <span className="text-xs font-semibold">Show</span>
        <input
          type="checkbox"
          checked={band.enabled}
          onChange={() => onChange({ enabled: !band.enabled })}
          className="h-4 w-4 accent-[#5E7CFF]"
        />
      </label>
    </div>
  )
}
