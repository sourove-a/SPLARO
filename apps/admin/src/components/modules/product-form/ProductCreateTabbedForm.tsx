'use client'

import Image from 'next/image'
import { ChevronDown, ImagePlus, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminSwitchRow } from '@/components/ui/AdminSwitch'
import { BANGLA_PHRASE_CHIPS } from '@/lib/admin/product-description-draft'
import type { CategoryPickerRow } from '@/lib/admin/category-picker'
import { cn } from '@/lib/utils/cn'

export type ProductCreateTab = 'basic' | 'details' | 'seo'

export interface ProductCreateFormState {
  name: string
  nameBn: string
  shortDescription: string
  descriptionEn: string
  descriptionBn: string
  descriptionNotes: string
  basePrice: string
  compareAtPrice: string
  costPrice: string
  sku: string
  defaultStock: string
  categoryId: string
  collectionId: string
  productType: string
  fabricContent: string
  weavingType: string
  lowStockThreshold: string
  tags: string
  fitType: string
  occasion: string
  careInstructions: string
  season: string
  sizes: string
  metaTitle: string
  metaDescription: string
  isPublished: boolean
  status: string
  isHidden: boolean
  isFeatured: boolean
  isNewArrival: boolean
  isBestSeller: boolean
  weight: string
  badge: string
  rmCode: string
  barcode: string
  qrCode: string
  publishAt: string
}

type ColorRow = { id: string; name: string; hex: string; imageUrl: string }

const WEAVING_TYPES = ['Jamdani', 'Handloom', 'Power Loom', 'Embroidery', 'Block Print', 'Zari Work', 'Other']

interface ProductCreateTabbedFormProps {
  tab: ProductCreateTab
  onTabChange: (tab: ProductCreateTab) => void
  form: ProductCreateFormState
  set: <K extends keyof ProductCreateFormState>(key: K, value: ProductCreateFormState[K]) => void
  departmentId: string
  catsLoading: boolean
  departments: CategoryPickerRow[]
  subcategories: CategoryPickerRow[]
  subDepartmentId?: string
  subDepartments?: CategoryPickerRow[]
  selectedCategoryName?: string | undefined
  sizeList: string[]
  allSizeChips: string[]
  variantCount: number
  collections: { id: string; name: string }[]
  colorsOpen: boolean
  onColorsOpenToggle: () => void
  colorRows: ColorRow[]
  activeColorId: string
  imageUrls: string[]
  onDepartmentChange: (id: string) => void
  onSubcategoryChange: (id: string) => void
  onSubTypeChange?: (id: string) => void
  onNameBlur: () => void
  onNameChange?: (name: string) => void
  onApplyDescriptionDraft: () => void
  onApplyBanglaPolish: () => void
  onAIGenerate: () => void
  aiLoading: boolean
  onAddColorRow: () => void
  onActiveColor: (id: string) => void
  onUpdateColorRow: (id: string, patch: Partial<ColorRow>) => void
  onRemoveColorRow: (id: string) => void
  onAppendBanglaPhrase: (phrase: string) => void
  descriptionPlaceholderEn: string
  descriptionPlaceholderBn: string
  descriptionHintEn?: string
  descriptionHintBn?: string
  showVariantControls?: boolean
  headerSlot?: React.ReactNode
  /** Edit panel: publish toggle saves instantly via API */
  onInstantPublish?: (nextPublished: boolean) => void
  /** Edit panel: generate storefront QR via API */
  productId?: string
  onGenerateBarcode?: () => void
  barcodeGenerating?: boolean
  barcodePreviewUrl?: string
  onGenerateQr?: () => void
  qrGenerating?: boolean
  qrPreviewUrl?: string
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="product-form-label">
      {children}
      {required ? <span className="product-form-label__req"> *</span> : null}
    </span>
  )
}

function FormSection({
  title,
  hint,
  children,
  variant = 'default',
  collapsible,
  open,
  onToggle,
}: {
  title: string
  hint?: string
  children: React.ReactNode
  variant?: 'default' | 'accent' | 'bengali'
  collapsible?: boolean
  open?: boolean
  onToggle?: () => void
}) {
  const head = (
    <header className={cn('product-form-section__head', collapsible && 'product-form-section__head--inline')}>
      <div>
        <h4 className="product-form-section__title">{title}</h4>
        {hint ? <p className="product-form-section__hint">{hint}</p> : null}
      </div>
      {collapsible ? (
        <ChevronDown className={cn('product-form-section__chevron', open && 'product-form-section__chevron--open')} />
      ) : null}
    </header>
  )

  return (
    <section className={cn('product-form-section', variant !== 'default' && `product-form-section--${variant}`)}>
      {collapsible ? (
        <button type="button" className="product-form-section__toggle" onClick={onToggle} aria-expanded={open}>
          {head}
        </button>
      ) : (
        head
      )}
      {!collapsible || open ? <div className="product-form-section__body">{children}</div> : null}
    </section>
  )
}

export function ProductCreateTabbedForm(props: ProductCreateTabbedFormProps) {
  const {
    tab,
    onTabChange,
    form,
    set,
    departmentId,
    catsLoading,
    departments,
    subcategories,
    subDepartmentId,
    subDepartments = [],
    selectedCategoryName,
    sizeList,
    allSizeChips,
    variantCount,
    collections,
    colorsOpen,
    onColorsOpenToggle,
    colorRows,
    activeColorId,
    imageUrls,
    onDepartmentChange,
    onSubcategoryChange,
    onSubTypeChange,
    onNameBlur,
    onNameChange,
    onApplyDescriptionDraft,
    onApplyBanglaPolish,
    onAIGenerate,
    aiLoading,
    onAddColorRow,
    onActiveColor,
    onUpdateColorRow,
    onRemoveColorRow,
    onAppendBanglaPhrase,
    descriptionPlaceholderEn,
    descriptionPlaceholderBn,
    descriptionHintEn,
    descriptionHintBn,
    showVariantControls = true,
    headerSlot,
    onInstantPublish,
    productId,
    onGenerateBarcode,
    barcodeGenerating = false,
    barcodePreviewUrl,
    onGenerateQr,
    qrGenerating = false,
    qrPreviewUrl,
  } = props

  const showGenerateHint = Boolean(productId && (onGenerateBarcode || onGenerateQr))
  const generateBtnClass =
    'rounded-lg bg-[rgba(200,169,126,0.12)] px-3 py-2 text-[11px] font-black text-[#9a7b52] transition-colors hover:bg-[rgba(200,169,126,0.22)] disabled:opacity-50 dark:text-[var(--admin-text-secondary)]'

  const tabs: { id: ProductCreateTab; label: string; hint: string }[] = [
    { id: 'basic', label: 'Basic & Pricing', hint: 'Name, descriptions, price' },
    { id: 'details', label: 'Catalog & Inventory', hint: 'Fit, codes, variants' },
    { id: 'seo', label: 'SEO & Publishing', hint: 'Meta, visibility, schedule' },
  ]

  return (
    <div className="product-form-tabs">
      {headerSlot ? <div className="product-form-tabs__header-slot">{headerSlot}</div> : null}
      <div className="product-form-tabs__nav" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={cn('product-form-tabs__tab', tab === t.id && 'product-form-tabs__tab--active')}
            onClick={() => onTabChange(t.id)}
            title={t.hint}
          >
            <span className="block truncate">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'basic' ? (
        <div className="product-form-tabs__panel" role="tabpanel">
          <div className="product-form-ai-banner">
            <div>
              <p className="product-form-ai-banner__title">AI Generate</p>
              <p className="product-form-ai-banner__hint">নাম + ক্যাটাগরি দিয়ে EN/বাংলা description auto লিখুন</p>
            </div>
            <AdminButton variant="gold" loading={aiLoading} onClick={onAIGenerate}>
              <Sparkles className="h-4 w-4" />
              AI Generate
            </AdminButton>
          </div>

          <FormSection title="Product identity">
            <label className="admin-field">
              <FieldLabel required>Product Name</FieldLabel>
              <input
                className="admin-input admin-input--premium"
                value={form.name}
                onChange={(e) => (onNameChange ? onNameChange(e.target.value) : set('name', e.target.value))}
                onBlur={onNameBlur}
                placeholder="Product name in English…"
              />
            </label>
          </FormSection>

          <FormSection title="Descriptions" {...(descriptionHintEn ? { hint: descriptionHintEn } : {})}>
            <label className="admin-field">
              <FieldLabel>Short Description</FieldLabel>
              <textarea
                className="admin-input admin-input--premium product-form-textarea--sm"
                value={form.shortDescription}
                onChange={(e) => set('shortDescription', e.target.value)}
                placeholder="Brief summary for cards & SEO…"
              />
            </label>
            <label className="admin-field">
              <FieldLabel>Full Description (EN)</FieldLabel>
              <textarea
                className="admin-input admin-input--premium product-form-textarea--md"
                value={form.descriptionEn}
                onChange={(e) => set('descriptionEn', e.target.value)}
                placeholder={descriptionPlaceholderEn}
              />
            </label>
          </FormSection>

          <FormSection title="Pricing" variant="accent">
            <div className="product-form-section__grid-3">
              <label className="admin-field">
                <FieldLabel required>Regular Price (৳)</FieldLabel>
                <input className="admin-input admin-input--premium" type="number" min={0} value={form.basePrice} onChange={(e) => set('basePrice', e.target.value)} placeholder="e.g. 2499" />
              </label>
              <label className="admin-field">
                <FieldLabel>Sale Price (৳)</FieldLabel>
                <input className="admin-input admin-input--premium" type="number" min={0} value={form.compareAtPrice} onChange={(e) => set('compareAtPrice', e.target.value)} placeholder="Optional" />
              </label>
              <label className="admin-field">
                <FieldLabel>Cost Price (৳)</FieldLabel>
                <input className="admin-input admin-input--premium" type="number" min={0} value={form.costPrice} onChange={(e) => set('costPrice', e.target.value)} placeholder="Internal" />
              </label>
            </div>
          </FormSection>

          <FormSection title="Inventory & category">
            <div className="product-form-section__grid-3">
              <label className="admin-field">
                <FieldLabel>SKU</FieldLabel>
                <input className="admin-input admin-input--premium" value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="Manual SKU" />
              </label>
              <label className="admin-field">
                <FieldLabel>Stock Qty</FieldLabel>
                <input className="admin-input admin-input--premium" type="number" min={0} value={form.defaultStock} onChange={(e) => set('defaultStock', e.target.value)} />
              </label>
              <label className="admin-field">
                <FieldLabel>Low Stock Alert</FieldLabel>
                <input className="admin-input admin-input--premium" type="number" min={0} value={form.lowStockThreshold} onChange={(e) => set('lowStockThreshold', e.target.value)} placeholder="5" />
              </label>
            </div>
            <div className="admin-field product-form-category-block">
              <FieldLabel required>Category</FieldLabel>
              <div className="product-form-category-block__selects">
                <div className="admin-premium-select">
                  <select className="admin-premium-select__input" value={departmentId} onChange={(e) => onDepartmentChange(e.target.value)} disabled={catsLoading}>
                    <option value="">Menu</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="admin-premium-select">
                  <select
                    className="admin-premium-select__input"
                    value={subDepartmentId || form.categoryId}
                    onChange={(e) => onSubcategoryChange(e.target.value)}
                    disabled={catsLoading || !departmentId}
                  >
                    <option value="">Type</option>
                    {subcategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.id === departmentId ? `All ${c.name}` : c.name}</option>
                    ))}
                  </select>
                </div>
                {subDepartments.length > 0 ? (
                  <div className="admin-premium-select">
                    <select
                      className="admin-premium-select__input"
                      value={form.categoryId}
                      onChange={(e) => onSubTypeChange?.(e.target.value)}
                      disabled={catsLoading}
                    >
                      <option value="">Choose one</option>
                      {subDepartments.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
              {selectedCategoryName ? <p className="product-category-cascade__picked">✓ {selectedCategoryName}</p> : null}
            </div>
          </FormSection>

          <FormSection title="Material & tags">
            <div className="product-form-section__grid-2">
              <label className="admin-field">
                <FieldLabel>Fabric</FieldLabel>
                <input className="admin-input admin-input--premium" value={form.fabricContent} onChange={(e) => set('fabricContent', e.target.value)} placeholder="e.g. Cotton, silk blend…" />
              </label>
              <label className="admin-field">
                <FieldLabel>Weaving Type</FieldLabel>
                <div className="admin-premium-select">
                  <select className="admin-premium-select__input" value={form.weavingType} onChange={(e) => set('weavingType', e.target.value)}>
                    <option value="">Select…</option>
                    {WEAVING_TYPES.map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
              </label>
            </div>
            <label className="admin-field">
              <FieldLabel>Product Tags</FieldLabel>
              <input className="admin-input admin-input--premium" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="eid, wedding, new" />
              <span className="product-form-field-hint">Comma separated</span>
            </label>
          </FormSection>

          <FormSection title="বাংলা বিবরণ" variant="bengali" {...(descriptionHintBn ? { hint: descriptionHintBn } : {})}>
            <div className="product-desc-bn__toolbar">
              <p className="product-desc-bn__toolbar-label">Quick phrases</p>
              <div className="flex gap-1">
                <button type="button" className="product-form-mini-btn" onClick={onApplyDescriptionDraft}>
                  <Wand2 className="h-3 w-3" /> Draft
                </button>
                <button type="button" className="product-form-mini-btn product-form-mini-btn--gold" onClick={onApplyBanglaPolish}>
                  <Sparkles className="h-3 w-3" /> Polish
                </button>
              </div>
            </div>
            <div className="product-desc-chips" role="list">
              {BANGLA_PHRASE_CHIPS.map((phrase) => (
                <button key={phrase} type="button" className="product-desc-chip" onClick={() => onAppendBanglaPhrase(phrase)}>
                  + {phrase}
                </button>
              ))}
            </div>
            <textarea
              className="admin-input admin-input--premium product-desc-bn__input"
              value={form.descriptionBn}
              onChange={(e) => set('descriptionBn', e.target.value)}
              placeholder={descriptionPlaceholderBn}
            />
          </FormSection>
        </div>
      ) : null}

      {tab === 'details' ? (
        <div className="product-form-tabs__panel" role="tabpanel">
          <FormSection title="Catalog & fit">
            <div className="product-form-section__grid-2">
            <label className="admin-field">
              <FieldLabel>Collection</FieldLabel>
              <div className="admin-premium-select mt-1">
                <select className="admin-premium-select__input" value={form.collectionId} onChange={(e) => set('collectionId', e.target.value)}>
                  <option value="">No collection</option>
                  {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </label>
            <label className="admin-field">
              <FieldLabel>Fit</FieldLabel>
              <input className="admin-input admin-input--premium" value={form.fitType} onChange={(e) => set('fitType', e.target.value)} />
            </label>
            <label className="admin-field">
              <FieldLabel>Occasion</FieldLabel>
              <input className="admin-input admin-input--premium" value={form.occasion} onChange={(e) => set('occasion', e.target.value)} placeholder="Eid, Wedding, Party…" />
            </label>
            <label className="admin-field">
              <FieldLabel>Season</FieldLabel>
              <div className="admin-premium-select mt-1">
                <select className="admin-premium-select__input" value={form.season} onChange={(e) => set('season', e.target.value)}>
                  <option value="">All Season</option>
                  <option>Summer</option>
                  <option>Winter</option>
                  <option>Eid</option>
                  <option>Puja</option>
                </select>
              </div>
            </label>
            </div>
            <label className="admin-field mt-3">
              <FieldLabel>Care instructions</FieldLabel>
              <input className="admin-input admin-input--premium" value={form.careInstructions} onChange={(e) => set('careInstructions', e.target.value)} placeholder="Hand wash cold, dry in shade…" />
            </label>
          </FormSection>

          <FormSection title="Identifiers & logistics" hint="SKU-adjacent codes, weight for shipping, scheduled publish">
            <div className="product-form-section__grid-2">
              <label className="admin-field">
                <FieldLabel>Weight (kg)</FieldLabel>
                <input
                  className="admin-input admin-input--premium"
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.weight}
                  onChange={(e) => set('weight', e.target.value)}
                  placeholder="0.450"
                />
              </label>
              <label className="admin-field">
                <FieldLabel>RM code</FieldLabel>
                <input className="admin-input admin-input--premium" value={form.rmCode} onChange={(e) => set('rmCode', e.target.value)} placeholder="RM-2026-001" />
              </label>
              <label className="admin-field">
                <FieldLabel>Card badge</FieldLabel>
                <input className="admin-input admin-input--premium" value={form.badge} onChange={(e) => set('badge', e.target.value)} placeholder="Limited drop, Eid special…" />
              </label>
              <label className="admin-field md:col-span-2">
                <FieldLabel>Barcode</FieldLabel>
                <div className="flex flex-wrap items-start gap-2">
                  <input
                    className="admin-input admin-input--premium min-w-[200px] flex-1"
                    value={form.barcode}
                    onChange={(e) => set('barcode', e.target.value)}
                    placeholder={productId ? 'Generate or paste data URL' : 'Manual entry'}
                  />
                  {productId && onGenerateBarcode ? (
                    <button
                      type="button"
                      disabled={barcodeGenerating}
                      onClick={onGenerateBarcode}
                      className={generateBtnClass}
                    >
                      {barcodeGenerating ? 'Generating…' : 'Generate'}
                    </button>
                  ) : null}
                </div>
                {barcodePreviewUrl || (form.barcode.startsWith('data:image') ? form.barcode : '') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={barcodePreviewUrl || form.barcode}
                    alt="Barcode preview"
                    className="mt-2 h-12 max-w-[220px] rounded border border-black/8 dark:border-white/10"
                  />
                ) : null}
              </label>
              <label className="admin-field md:col-span-2">
                <FieldLabel>QR data URL</FieldLabel>
                <div className="flex flex-wrap items-start gap-2">
                  <input
                    className="admin-input admin-input--premium min-w-[200px] flex-1"
                    value={form.qrCode}
                    onChange={(e) => set('qrCode', e.target.value)}
                    placeholder={productId ? 'Generate or paste data URL' : 'Manual entry'}
                  />
                  {productId && onGenerateQr ? (
                    <button
                      type="button"
                      disabled={qrGenerating}
                      onClick={onGenerateQr}
                      className={generateBtnClass}
                    >
                      {qrGenerating ? 'Generating…' : 'Generate'}
                    </button>
                  ) : null}
                </div>
                {qrPreviewUrl || (form.qrCode.startsWith('data:image') ? form.qrCode : '') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrPreviewUrl || form.qrCode}
                    alt="QR preview"
                    className="mt-2 h-20 w-20 rounded border border-black/8 dark:border-white/10"
                  />
                ) : null}
              </label>
              {showGenerateHint ? (
                <p className="md:col-span-2 text-[10px] font-semibold text-[var(--admin-text-muted)]">
                  Generated locally — click Save to persist.
                </p>
              ) : null}
              <label className="admin-field">
                <FieldLabel>Publish at</FieldLabel>
                <input
                  className="admin-input admin-input--premium"
                  type="datetime-local"
                  value={form.publishAt}
                  onChange={(e) => set('publishAt', e.target.value)}
                />
              </label>
            </div>
          </FormSection>

          {showVariantControls ? (
            <>
              <FormSection title={`Sizes · ${variantCount} variant(s)`} hint="Tap chips or type comma-separated sizes">
              <div className="admin-field">
                <div className="product-size-chips">
                  {allSizeChips.map((size) => {
                    const active = sizeList.includes(size)
                    return (
                      <button
                        key={size}
                        type="button"
                        className={cn('product-size-chip', active && 'product-size-chip--active')}
                        onClick={() => {
                          const next = active ? sizeList.filter((s) => s !== size) : [...sizeList, size]
                          set('sizes', next.join(', '))
                        }}
                      >
                        {size}
                      </button>
                    )
                  })}
                </div>
                <input className="admin-input admin-input--premium" value={form.sizes} onChange={(e) => set('sizes', e.target.value)} />
              </div>
              </FormSection>

              <FormSection
                title="Colours"
                hint="Select row → gallery thumb to assign image"
                collapsible
                open={colorsOpen}
                onToggle={onColorsOpenToggle}
              >
                <div className="product-color-builder product-color-builder--flat">
                  <div className="product-color-builder__head">
                    <p className="product-color-builder__label">Variant colours</p>
                    <button type="button" className="product-color-add" onClick={onAddColorRow}>
                      <Plus className="h-3.5 w-3.5" />
                      Add colour
                    </button>
                  </div>
                  <div className="product-color-list">
                    {colorRows.map((row, index) => (
                      <article
                        key={row.id}
                        className={cn('product-color-row', row.id === activeColorId && 'product-color-row--active')}
                        onClick={() => onActiveColor(row.id)}
                      >
                        <div className="product-color-row__preview relative">
                          {row.imageUrl ? (
                            <Image src={row.imageUrl} alt="" fill unoptimized sizes="48px" className="object-cover" />
                          ) : (
                            <ImagePlus className="h-4 w-4 text-[var(--admin-text-muted)]" />
                          )}
                        </div>
                        <div className="product-color-row__fields">
                          <input className="admin-input admin-input--premium" value={row.name} onChange={(e) => onUpdateColorRow(row.id, { name: e.target.value })} placeholder="Royal Blue" />
                          <div className="product-color-row__meta">
                            <label className="product-color-hex">
                              <span className="product-color-hex__swatch" style={{ backgroundColor: row.hex }} aria-hidden />
                              <input type="color" value={row.hex} onChange={(e) => onUpdateColorRow(row.id, { hex: e.target.value })} aria-label={`Colour ${index + 1}`} />
                            </label>
                            <select className="admin-input admin-input--premium product-color-row__select" value={row.imageUrl} onChange={(e) => onUpdateColorRow(row.id, { imageUrl: e.target.value })}>
                              <option value="">Image…</option>
                              {imageUrls.map((url, imageIndex) => <option key={url} value={url}>Image {imageIndex + 1}</option>)}
                            </select>
                          </div>
                        </div>
                        <button type="button" className="product-color-row__remove" onClick={(e) => { e.stopPropagation(); onRemoveColorRow(row.id) }} disabled={colorRows.length <= 1} aria-label="Remove colour">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              </FormSection>
            </>
          ) : (
            <p className="product-form-variant-hint">Sizes, colours & stock — edit in <strong>Variants & Stock</strong> below.</p>
          )}

          {showVariantControls !== false ? (
          <FormSection title="Publishing & visibility" hint="Draft, live, scheduled, hidden, merchandising flags">
          <div className="product-form-section__grid-2">
            <label className="admin-field">
              <FieldLabel>Status</FieldLabel>
              <div className="admin-premium-select mt-1">
                <select className="admin-premium-select__input" value={form.status} onChange={(e) => {
                  set('status', e.target.value)
                  set('isPublished', e.target.value === 'PUBLISHED')
                }}>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="SCHEDULED">Scheduled</option>
                </select>
              </div>
            </label>
            <label className="admin-field">
              <FieldLabel>Visibility</FieldLabel>
              <div className="admin-premium-select mt-1">
                <select className="admin-premium-select__input" value={form.isHidden ? 'hidden' : 'public'} onChange={(e) => set('isHidden', e.target.value === 'hidden')}>
                  <option value="public">Public</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
            </label>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[
              { key: 'isFeatured' as const, label: 'Featured', desc: 'Featured section' },
              { key: 'isNewArrival' as const, label: 'New Arrival', desc: 'New arrivals' },
              { key: 'isBestSeller' as const, label: 'Best Seller', desc: 'Best sellers' },
            ].map(({ key, label, desc }) => (
              <AdminSwitchRow
                key={key}
                label={label}
                desc={desc}
                checked={form[key]}
                onChange={() => set(key, !form[key])}
              />
            ))}
          </div>
          </FormSection>
          ) : null}
        </div>
      ) : null}

      {tab === 'seo' ? (
        <div className="product-form-tabs__panel" role="tabpanel">
          <FormSection title="Search preview">
          <label className="admin-field">
            <FieldLabel>Meta title</FieldLabel>
            <input className="admin-input admin-input--premium" value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} placeholder="Product | SPLARO Bangladesh" />
          </label>
          <label className="admin-field">
            <FieldLabel>Meta description</FieldLabel>
            <textarea className="admin-input admin-input--premium min-h-[90px]" value={form.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} placeholder="140–160 chars for Google…" />
          </label>
          {(form.metaTitle || form.metaDescription) ? (
            <div className="product-seo-preview">
              <p className="product-seo-preview__url">splaro.co › products</p>
              <p className="product-seo-preview__title">{form.metaTitle || form.name}</p>
              <p className="product-seo-preview__desc">{form.metaDescription}</p>
            </div>
          ) : null}
          </FormSection>
          <AdminSwitchRow
            label="Publish on storefront"
            desc={onInstantPublish ? 'Saves instantly · updates storefront' : 'Product goes live after you save.'}
            checked={form.isPublished}
            highlight
            onChange={() => {
              const next = !form.isPublished
              if (onInstantPublish) {
                onInstantPublish(next)
                return
              }
              set('isPublished', next)
              set('status', next ? 'PUBLISHED' : 'DRAFT')
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
