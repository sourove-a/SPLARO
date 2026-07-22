'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff, Save, RotateCcw, ExternalLink, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { toastApiSaved, toastFail } from '@/lib/admin/feedback'
import { deepEqual } from '@/lib/admin/settings-save'
import { fetchFootwearConfig, saveFootwearConfig } from '@/lib/api/footwear-config'
import { revalidateWebCache } from '@/lib/api/revalidate'
import { getStorefrontOrigin } from '@/lib/storefront-origin'
import { cn } from '@/lib/utils/cn'

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

const WEB_BASE = getStorefrontOrigin()

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
    <label className="footwear-toggle">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'footwear-toggle__track',
          checked ? 'footwear-toggle__track--on' : 'footwear-toggle__track--off',
        )}
      >
        <span
          className={cn(
            'footwear-toggle__thumb',
            checked && 'footwear-toggle__thumb--on',
          )}
        />
      </button>
      <span className="footwear-toggle__label">{label}</span>
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
    <section
      className={cn(
        'footwear-section admin-module-card',
        !visible && 'footwear-section--dimmed',
      )}
    >
      <div className="footwear-section__head">
        <div className="footwear-section__title-wrap">
          <span className={cn('footwear-section__dot', visible ? 'footwear-section__dot--on' : 'footwear-section__dot--off')} />
          <span className="footwear-section__title">{title}</span>
          {badge ? <span className="footwear-section__badge">{badge}</span> : null}
        </div>
        <div className="footwear-section__actions">
          <ToggleSwitch checked={visible} onChange={onToggle} label={visible ? 'Visible' : 'Hidden'} />
          {collapsible && children ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="footwear-section__collapse"
              aria-expanded={open}
              aria-label={open ? 'Collapse section' : 'Expand section'}
            >
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          ) : null}
        </div>
      </div>
      {open && children ? (
        <div className="footwear-section__body">{children}</div>
      ) : null}
    </section>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={cn('footwear-field', className)}>
      <span className="footwear-field__label">{label}</span>
      {children}
    </label>
  )
}

export function FootwearPagePanel() {
  const [config, setConfig] = useState<FootwearConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    fetchFootwearConfig()
      .then((data) => {
        setConfig(data as unknown as FootwearConfig)
        setLoading(false)
      })
      .catch(() => {
        toastFail('Failed to load footwear config', 'footwear-config-load')
        setLoading(false)
      })
  }, [])

  function update(fn: (c: FootwearConfig) => FootwearConfig) {
    setConfig((prev) => (prev ? fn(prev) : prev))
    setDirty(true)
  }

  async function save() {
    if (!config) return
    setSaving(true)
    try {
      const saved = await saveFootwearConfig(config as unknown as Record<string, unknown>)
      if (!deepEqual(saved, config)) {
        toastFail('Save failed verification — server response mismatch.')
        return
      }
      await revalidateWebCache(['storefront-settings'])
      toastApiSaved('Footwear page')
      setDirty(false)
    } catch {
      toastFail('Footwear save failed')
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setLoading(true)
    fetchFootwearConfig()
      .then((data) => {
        setConfig(data as unknown as FootwearConfig)
        setDirty(false)
        setLoading(false)
      })
      .catch(() => {
        toastFail('Failed to reload footwear config')
        setLoading(false)
      })
  }

  if (loading) {
    return (
      <div className="footwear-panel__loading">
        <Loader2 className="animate-spin" size={28} />
      </div>
    )
  }

  if (!config) return null

  return (
    <div className="footwear-panel">
      <p className="footwear-panel__notice">
        Saves to database via Nest API — changes appear on the storefront after cache revalidation.
      </p>

      <div className="footwear-panel__toolbar">
        <a
          href={`${WEB_BASE}/footwear`}
          target="_blank"
          rel="noopener noreferrer"
          className="footwear-panel__btn"
        >
          <ExternalLink size={12} />
          Preview
        </a>
        {dirty ? (
          <button type="button" onClick={reset} className="footwear-panel__btn">
            <RotateCcw size={12} />
            Reset
          </button>
        ) : null}
        <AdminButton variant="gold" onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Save size={13} className="mr-1.5" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </AdminButton>
      </div>

      {dirty ? (
        <div className="footwear-panel__dirty">
          <span className="footwear-panel__dirty-dot" />
          Unsaved changes — click Save to publish
        </div>
      ) : null}

      <div className="footwear-panel__layout">
        <SectionCard
          title="Hero Banner"
          badge="Full-width image"
          visible={config.heroBanner.visible}
          onToggle={(v) => update((c) => ({ ...c, heroBanner: { ...c.heroBanner, visible: v } }))}
        >
          <div className="footwear-section__fields footwear-section__fields--hero">
            <Field label="Title">
              <input
                className="admin-input"
                value={config.heroBanner.title}
                onChange={(e) => update((c) => ({ ...c, heroBanner: { ...c.heroBanner, title: e.target.value } }))}
              />
            </Field>
            <Field label="Subtitle">
              <input
                className="admin-input"
                value={config.heroBanner.subtitle}
                onChange={(e) => update((c) => ({ ...c, heroBanner: { ...c.heroBanner, subtitle: e.target.value } }))}
              />
            </Field>
            <Field label="Image URL" className="footwear-field--wide">
              <input
                className="admin-input font-mono"
                value={config.heroBanner.image}
                onChange={(e) => update((c) => ({ ...c, heroBanner: { ...c.heroBanner, image: e.target.value } }))}
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="Shop By Category"
          badge={`${config.shopByCategory.categories.filter((c) => c.visible).length} categories`}
          visible={config.shopByCategory.visible}
          onToggle={(v) => update((c) => ({ ...c, shopByCategory: { ...c.shopByCategory, visible: v } }))}
        >
          <div className="footwear-section__fields">
            <Field label="Section Title" className="footwear-field--wide">
              <input
                className="admin-input"
                value={config.shopByCategory.title}
                onChange={(e) =>
                  update((c) => ({
                    ...c,
                    shopByCategory: { ...c.shopByCategory, title: e.target.value },
                  }))
                }
              />
            </Field>

            <div className="footwear-field footwear-field--wide">
              <span className="footwear-field__label">Categories</span>
              <div className="footwear-categories-grid">
                {config.shopByCategory.categories.map((cat, i) => (
                  <div key={cat.id} className="footwear-list-item">
                    <span className={cn('footwear-section__dot shrink-0', cat.visible ? 'footwear-section__dot--on' : 'footwear-section__dot--off')} />
                    <span className="footwear-list-item__label">{cat.label}</span>
                    <span className="footwear-list-item__meta">{cat.href}</span>
                    <button
                      type="button"
                      onClick={() =>
                        update((c) => ({
                          ...c,
                          shopByCategory: {
                            ...c.shopByCategory,
                            categories: c.shopByCategory.categories.map((cc, j) =>
                              j === i ? { ...cc, visible: !cc.visible } : cc,
                            ),
                          },
                        }))
                      }
                      className={cn(
                        'footwear-visibility-btn',
                        cat.visible ? 'footwear-visibility-btn--on' : 'footwear-visibility-btn--off',
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

        <div className="footwear-panel__rows">
          {config.productRows.map((row, ri) => (
            <SectionCard
              key={row.id}
              title={row.title}
              badge={`${row.products.length} products`}
              visible={row.visible}
              onToggle={(v) =>
                update((c) => ({
                  ...c,
                  productRows: c.productRows.map((r, j) => (j === ri ? { ...r, visible: v } : r)),
                }))
              }
            >
              <div className="footwear-section__fields">
                <Field label="Title">
                  <input
                    className="admin-input"
                    value={row.title}
                    onChange={(e) =>
                      update((c) => ({
                        ...c,
                        productRows: c.productRows.map((r, j) =>
                          j === ri ? { ...r, title: e.target.value } : r,
                        ),
                      }))
                    }
                  />
                </Field>
                <Field label="Subtitle">
                  <input
                    className="admin-input"
                    value={row.subtitle}
                    onChange={(e) =>
                      update((c) => ({
                        ...c,
                        productRows: c.productRows.map((r, j) =>
                          j === ri ? { ...r, subtitle: e.target.value } : r,
                        ),
                      }))
                    }
                  />
                </Field>

                <div className="footwear-field footwear-field--wide">
                  <span className="footwear-field__label">Products in this row</span>
                  <div className="footwear-products-grid">
                    {row.products.map((p) => (
                      <div key={p.id} className="footwear-product-chip">
                        <span className="footwear-product-chip__code">{p.code}</span>
                        <span className="footwear-product-chip__name">{p.name}</span>
                        <span className="footwear-product-chip__meta">{p.colors} colors</span>
                        <span className="footwear-product-chip__price">৳{p.price.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      </div>
    </div>
  )
}
