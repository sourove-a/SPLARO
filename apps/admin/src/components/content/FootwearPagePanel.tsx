'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff, Save, RotateCcw, ExternalLink, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryItem {
  id: string
  label: string
  image: string
  href: string
  visible: boolean
}

interface FootwearProduct {
  id: string
  name: string
  code: string
  colors: number
  price: number
  image: string | null
}

interface ProductRow {
  id: string
  title: string
  subtitle: string
  visible: boolean
  exploreHref: string
  products: FootwearProduct[]
}

interface FootwearConfig {
  heroBanner: {
    visible: boolean
    image: string
    alt: string
    title: string
    subtitle: string
  }
  shopByCategory: {
    visible: boolean
    title: string
    categories: CategoryItem[]
  }
  productRows: ProductRow[]
}

const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'
const API_URL = '/api/footwear-config'

// ─── Sub-components ───────────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5E7CFF]/50 border',
          checked
            ? 'bg-[#111111] border-[#111111]'
            : 'bg-[#F4F5F7] border-[rgba(17,17,17,0.12)]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
      <span className="text-sm font-medium text-[#111]">{label}</span>
    </label>
  )
}

function SectionCard({
  title,
  badge,
  visible,
  onToggle,
  children,
  collapsible = true,
}: {
  title: string
  badge?: string
  visible: boolean
  onToggle: (v: boolean) => void
  children?: React.ReactNode
  collapsible?: boolean
}) {
  const [open, setOpen] = useState(true)

  return (
    <div
      className={cn(
        'rounded-2xl border transition-all duration-200',
        visible
          ? 'border-[rgba(17,17,17,0.08)] bg-white'
          : 'border-[rgba(17,17,17,0.05)] bg-[#F8F8F8] opacity-60',
      )}
    >
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <span className={cn('w-2 h-2 rounded-full', visible ? 'bg-emerald-500' : 'bg-gray-300')} />
          <span className="font-semibold text-[#111] text-sm">{title}</span>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4F5F7] text-[#6B6B6B] border border-[rgba(17,17,17,0.08)]">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <ToggleSwitch
            checked={visible}
            onChange={onToggle}
            label={visible ? 'Visible' : 'Hidden'}
          />
          {collapsible && children && (
            <button
              onClick={() => setOpen(o => !o)}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#F4F5F7] text-[#6B6B6B] transition-colors"
            >
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>
      {open && children && (
        <div className="border-t border-[rgba(17,17,17,0.06)] px-5 py-4">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function FootwearPagePanel() {
  const [config, setConfig] = useState<FootwearConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    fetch(API_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => { setConfig(data); setLoading(false) })
      .catch(() => {
        toast.error('Failed to load footwear config', { id: 'footwear-config-load' })
        setLoading(false)
      })
  }, [])

  function update(fn: (c: FootwearConfig) => FootwearConfig) {
    setConfig(prev => prev ? fn(prev) : prev)
    setDirty(true)
  }

  async function save() {
    if (!config) return
    setSaving(true)
    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Footwear page saved')
      setDirty(false)
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setLoading(true)
    fetch(API_URL)
      .then(r => r.json())
      .then(data => { setConfig(data); setDirty(false); setLoading(false) })
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="animate-spin text-[#6B6B6B]" size={28} />
      </div>
    )
  }

  if (!config) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <a
          href={`${WEB_BASE}/footwear`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(17,17,17,0.10)] bg-white px-3 py-2 text-xs font-medium text-[#6B6B6B] transition-colors hover:border-[rgba(17,17,17,0.20)]"
        >
          <ExternalLink size={12} />
          Preview
        </a>
        {dirty ? (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(17,17,17,0.10)] bg-white px-3 py-2 text-xs font-medium text-[#6B6B6B] transition-colors hover:bg-[#F4F5F7]"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        ) : null}
        <AdminButton variant="gold" onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Save size={13} className="mr-1.5" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </AdminButton>
      </div>

      <div className="max-w-2xl space-y-4">

        {/* Dirty indicator */}
        {dirty && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Unsaved changes — click Save to publish
          </div>
        )}

        {/* ── Hero Banner ── */}
        <SectionCard
          title="Hero Banner"
          badge="Full-width image"
          visible={config.heroBanner.visible}
          onToggle={v => update(c => ({ ...c, heroBanner: { ...c.heroBanner, visible: v } }))}
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[#6B6B6B] mb-1 block">Title</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-[rgba(17,17,17,0.10)] text-sm text-[#111] bg-[#FAFAFA] focus:outline-none focus:border-[#5E7CFF] transition-colors"
                value={config.heroBanner.title}
                onChange={e => update(c => ({ ...c, heroBanner: { ...c.heroBanner, title: e.target.value } }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#6B6B6B] mb-1 block">Subtitle</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-[rgba(17,17,17,0.10)] text-sm text-[#111] bg-[#FAFAFA] focus:outline-none focus:border-[#5E7CFF] transition-colors"
                value={config.heroBanner.subtitle}
                onChange={e => update(c => ({ ...c, heroBanner: { ...c.heroBanner, subtitle: e.target.value } }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#6B6B6B] mb-1 block">Image URL</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-[rgba(17,17,17,0.10)] text-sm text-[#111] bg-[#FAFAFA] focus:outline-none focus:border-[#5E7CFF] transition-colors font-mono"
                value={config.heroBanner.image}
                onChange={e => update(c => ({ ...c, heroBanner: { ...c.heroBanner, image: e.target.value } }))}
              />
            </div>
          </div>
        </SectionCard>

        {/* ── Shop By Category ── */}
        <SectionCard
          title="Shop By Category"
          badge={`${config.shopByCategory.categories.filter(c => c.visible).length} categories`}
          visible={config.shopByCategory.visible}
          onToggle={v => update(c => ({ ...c, shopByCategory: { ...c.shopByCategory, visible: v } }))}
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[#6B6B6B] mb-1 block">Section Title</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-[rgba(17,17,17,0.10)] text-sm text-[#111] bg-[#FAFAFA] focus:outline-none focus:border-[#5E7CFF] transition-colors"
                value={config.shopByCategory.title}
                onChange={e => update(c => ({
                  ...c,
                  shopByCategory: { ...c.shopByCategory, title: e.target.value },
                }))}
              />
            </div>

            <div>
              <p className="text-xs font-medium text-[#6B6B6B] mb-2">Categories</p>
              <div className="space-y-2">
                {config.shopByCategory.categories.map((cat, i) => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[rgba(17,17,17,0.07)] bg-[#FAFAFA]"
                  >
                    <span className={cn('w-2 h-2 rounded-full shrink-0', cat.visible ? 'bg-emerald-500' : 'bg-gray-300')} />
                    <span className="text-sm font-medium text-[#111] flex-1">{cat.label}</span>
                    <span className="text-xs text-[#9CA3AF] font-mono">{cat.href}</span>
                    <button
                      onClick={() => update(c => ({
                        ...c,
                        shopByCategory: {
                          ...c.shopByCategory,
                          categories: c.shopByCategory.categories.map((cc, j) =>
                            j === i ? { ...cc, visible: !cc.visible } : cc,
                          ),
                        },
                      }))}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                        cat.visible
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-[rgba(17,17,17,0.10)] bg-white text-[#6B6B6B] hover:bg-[#F4F5F7]',
                      )}
                    >
                      {cat.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                      {cat.visible ? 'Visible' : 'Hidden'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ── Product Rows ── */}
        {config.productRows.map((row, ri) => (
          <SectionCard
            key={row.id}
            title={row.title}
            badge={`${row.products.length} products`}
            visible={row.visible}
            onToggle={v => update(c => ({
              ...c,
              productRows: c.productRows.map((r, j) => j === ri ? { ...r, visible: v } : r),
            }))}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#6B6B6B] mb-1 block">Title</label>
                  <input
                    className="w-full px-3 py-2 rounded-lg border border-[rgba(17,17,17,0.10)] text-sm text-[#111] bg-[#FAFAFA] focus:outline-none focus:border-[#5E7CFF] transition-colors"
                    value={row.title}
                    onChange={e => update(c => ({
                      ...c,
                      productRows: c.productRows.map((r, j) =>
                        j === ri ? { ...r, title: e.target.value } : r,
                      ),
                    }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#6B6B6B] mb-1 block">Subtitle</label>
                  <input
                    className="w-full px-3 py-2 rounded-lg border border-[rgba(17,17,17,0.10)] text-sm text-[#111] bg-[#FAFAFA] focus:outline-none focus:border-[#5E7CFF] transition-colors"
                    value={row.subtitle}
                    onChange={e => update(c => ({
                      ...c,
                      productRows: c.productRows.map((r, j) =>
                        j === ri ? { ...r, subtitle: e.target.value } : r,
                      ),
                    }))}
                  />
                </div>
              </div>

              {/* Product list (visibility only) */}
              <div>
                <p className="text-xs font-medium text-[#6B6B6B] mb-2">Products in this row</p>
                <div className="space-y-1.5">
                  {row.products.map(p => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FAFAFA] border border-[rgba(17,17,17,0.06)]"
                    >
                      <span className="text-xs font-mono text-[#9CA3AF] w-14 shrink-0">{p.code}</span>
                      <span className="text-sm text-[#111] flex-1">{p.name}</span>
                      <span className="text-xs text-[#6B6B6B]">{p.colors} colors</span>
                      <span className="text-xs font-bold text-[#111]">৳{p.price.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        ))}

      </div>
    </div>
  )
}
