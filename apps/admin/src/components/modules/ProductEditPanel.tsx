'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Loader2, Save, Package,
  ImageIcon, Star, Layers, AlertTriangle,
  CheckCircle2, Circle, Pencil, X, Link2,
  BarChart3, ShieldAlert,
} from 'lucide-react'
import { buildCategoryPicker } from '@/lib/admin/category-picker'
import {
  buildDescriptionDraft,
  formatBilingualDescription,
  polishBanglaDescription,
  splitBilingualDescription,
} from '@/lib/admin/product-description-draft'
import { AdminButton, AdminLinkButton } from '@/components/ui/AdminButton'
import { toastApiSaved, toastOk, toastFail } from '@/lib/admin/feedback'
import { isAiJobFailed, parseAiProductOutput } from '@/lib/admin/parse-ai-product'
import { useCategories, useCollections, useProduct, useUpdateProduct, useDeleteProduct, useUpdateProductVariant } from '@/lib/api/hooks'
import { ProductCreateTabbedForm, type ProductCreateTab } from '@/components/modules/product-form/ProductCreateTabbedForm'
import {
  displayPriceFields,
  formatTagsInput,
  mergeFitAndProductType,
  parseProductSchemaMarkup,
  parseTagsInput,
  resolveSellingPrices,
  splitFitAndProductType,
} from '@/lib/admin/product-form-utils'
import { generateAIProduct } from '@/lib/api/finance'
import { ProductAIAssist } from '@/components/agent/ProductAIAssist'
import { useAdminNavigate } from '@/lib/navigation/client-nav'
import { cn } from '@/lib/utils/cn'

interface ProductEditPanelProps {
  productId: string
  moduleHref: string
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-[#6B6B6B]">
      {children}
      {required && <span className="ml-1 text-[#5E7CFF]">*</span>}
    </span>
  )
}

function SectionNumber({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(200,169,126,0.18)] text-[10px] font-black text-[#9a7b52]">
      {n}
    </span>
  )
}

function FormSection({
  title, icon: Icon, children, number,
}: {
  title: string; icon: React.ElementType; children: React.ReactNode; number?: number
}) {
  return (
    <div className="admin-module-card space-y-4">
      <div className="flex items-center gap-2.5 border-b border-[rgba(17,17,17,0.06)] pb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(200,169,126,0.12)]">
          <Icon className="h-3.5 w-3.5 text-[#5E7CFF]" strokeWidth={2} />
        </div>
        <h3 className="flex-1 text-[0.875rem] font-black tracking-tight text-[#111111]">{title}</h3>
        {number !== undefined && <SectionNumber n={number} />}
      </div>
      {children}
    </div>
  )
}

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em]',
      published ? 'bg-emerald-100/80 text-emerald-700' : 'bg-[rgba(17,17,17,0.06)] text-[#6B6B6B]',
    )}>
      {published ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
      {published ? 'Live' : 'Draft'}
    </span>
  )
}

function Toggle({ on, onToggle, size = 'md' }: { on: boolean; onToggle: () => void; size?: 'sm' | 'md' }) {
  const w = size === 'sm' ? 'w-9' : 'w-11'
  const h = size === 'sm' ? 'h-5' : 'h-6'
  const knob = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  const shift = size === 'sm' ? 'translate-x-4' : 'translate-x-5'
  return (
    <button
      onClick={onToggle}
      className={cn('relative rounded-full transition-colors duration-200', w, h, on ? 'bg-emerald-500' : 'bg-[rgba(17,17,17,0.15)]')}
    >
      <span className={cn('absolute top-0.5 left-0.5 rounded-full bg-white shadow-sm transition-transform duration-200', knob, on ? shift : 'translate-x-0')} />
    </button>
  )
}

export function ProductEditPanel({ productId, moduleHref }: ProductEditPanelProps) {
  const { navigate } = useAdminNavigate()
  const { data: product, isLoading, isError } = useProduct(productId)
  const { data: categories = [] } = useCategories()
  const { data: collectionsData } = useCollections()
  const collections = collectionsData?.collections ?? []
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()
  const updateVariant = useUpdateProductVariant()
  const [stockEdits, setStockEdits] = useState<Record<string, string>>({})
  const [skuEdits, setSkuEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [fillAllLoading, setFillAllLoading] = useState(false)
  const [slugEdited, setSlugEdited] = useState(false)
  const [departmentId, setDepartmentId] = useState('')
  const [activeTab, setActiveTab] = useState<ProductCreateTab>('basic')

  const [form, setForm] = useState({
    name: '',
    nameBn: '',
    slug: '',
    shortDescription: '',
    descriptionEn: '',
    descriptionBn: '',
    descriptionNotes: '',
    basePrice: '',
    compareAtPrice: '',
    costPrice: '',
    sku: '',
    defaultStock: '10',
    lowStockThreshold: '5',
    tags: '',
    weavingType: '',
    collectionId: '',
    productType: '',
    categoryId: '',
    sizes: '',
    imageUrl: '',
    isPublished: false,
    status: 'DRAFT',
    isHidden: false,
    isFeatured: false,
    isNewArrival: false,
    isBestSeller: false,
    fabricContent: '',
    fitType: '',
    season: '',
    occasion: '',
    metaTitle: '',
    metaDescription: '',
  })

  const categoryPicker = useMemo(() => buildCategoryPicker(categories), [categories])

  const subcategories = useMemo(
    () => (departmentId ? categoryPicker.subcategoriesForDepartment(departmentId) : []),
    [departmentId, categoryPicker],
  )

  const fullDescription = useMemo(
    () => formatBilingualDescription(form.descriptionEn, form.descriptionBn),
    [form.descriptionEn, form.descriptionBn],
  )

  useEffect(() => {
    if (!product) return
    const p = product
    const extra = p
    const { en, bn } = splitBilingualDescription(p.description ?? '')
    const categoryId = p.category?.id ?? p.categoryId ?? ''
    const schema = parseProductSchemaMarkup(extra.schemaMarkup)
    const prices = displayPriceFields(p.basePrice, extra.compareAtPrice)
    const fitSplit = splitFitAndProductType(p.fitType)
    setForm({
      name: p.name,
      nameBn: schema.nameBn,
      slug: String(extra.slug ?? slugify(p.name)),
      shortDescription: String(extra.shortDescription ?? ''),
      descriptionEn: en,
      descriptionBn: bn,
      descriptionNotes: '',
      basePrice: prices.regular,
      compareAtPrice: prices.sale,
      costPrice: extra.costPrice != null ? String(extra.costPrice) : '',
      sku: String(p.sku ?? ''),
      defaultStock: '10',
      lowStockThreshold: String(extra.lowStockThreshold ?? 5),
      tags: formatTagsInput(extra.tags),
      weavingType: schema.weavingType,
      collectionId: extra.collections?.[0]?.collectionId ?? '',
      productType: fitSplit.productType,
      categoryId,
      sizes: '',
      imageUrl: p.images?.[0]?.url ?? '',
      isPublished: p.isPublished,
      status: p.status ?? (p.isPublished ? 'PUBLISHED' : 'DRAFT'),
      isHidden: Boolean(extra.isHidden),
      isFeatured: Boolean(extra.isFeatured),
      isNewArrival: Boolean(extra.isNewArrival),
      isBestSeller: Boolean(extra.isBestSeller),
      fabricContent: String(p.fabricContent ?? ''),
      fitType: fitSplit.fitType,
      season: String(p.season ?? ''),
      occasion: String(p.occasion ?? ''),
      metaTitle: String(p.metaTitle ?? ''),
      metaDescription: String(p.metaDescription ?? ''),
    })
    const stocks: Record<string, string> = {}
    const skus: Record<string, string> = {}
    product.variants?.forEach((v) => {
      if (v.id) {
        stocks[v.id] = String(v.stock ?? v.stockQuantity ?? 0)
        skus[v.id] = String(v.sku ?? '')
      }
    })
    setStockEdits(stocks)
    setSkuEdits(skus)
    setSlugEdited(false)
    setDirty(false)
    if (categoryId && categories.length) {
      setDepartmentId(categoryPicker.departmentForCategory(categoryId))
    }
  }, [product, categories.length, categoryPicker])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: slugEdited ? prev.slug : slugify(name),
    }))
    setDirty(true)
  }

  const handleSlugChange = (slug: string) => {
    setSlugEdited(true)
    set('slug', slugify(slug))
  }

  const handleDepartmentChange = (deptId: string) => {
    setDepartmentId(deptId)
    set('categoryId', '')
  }

  const handleSubcategoryChange = (categoryId: string) => {
    set('categoryId', categoryId)
  }

  const appendBanglaPhrase = (phrase: string) => {
    setForm((prev) => ({
      ...prev,
      descriptionBn: prev.descriptionBn.trim() ? `${prev.descriptionBn.trim()}\n\n${phrase}` : phrase,
    }))
    setDirty(true)
  }

  const applyDescriptionDraft = () => {
    const categoryName = categories.find((c) => c.id === form.categoryId)?.name ?? ''
    const full = buildDescriptionDraft({
      name: form.name,
      notes: form.descriptionNotes,
      fabric: form.fabricContent,
      fit: form.fitType,
      occasion: form.occasion,
      category: categoryName,
    })
    const { en, bn } = splitBilingualDescription(full)
    setForm((prev) => ({ ...prev, descriptionEn: en, descriptionBn: bn }))
    setDirty(true)
    toastOk('Description draft ready', 'desc-draft-edit')
  }

  const applyBanglaPolish = () => {
    if (!form.name.trim() && !form.descriptionBn.trim()) {
      toast.error('Product name বা কিছু বাংলা লিখুন।')
      return
    }
    const bn = polishBanglaDescription({
      name: form.name,
      fabric: form.fabricContent,
      fit: form.fitType,
      occasion: form.occasion,
      notes: form.descriptionNotes,
      existing: form.descriptionBn,
    })
    set('descriptionBn', bn)
    toastOk('বাংলা বিবরণ polished', 'bn-polish-edit')
  }

  const handleGenerateDescription = useCallback(async () => {
    if (!form.name.trim()) { toast.error('Enter product name first.'); return }
    setAiLoading(true)
    try {
      const job = await generateAIProduct({
        productName: form.name,
        fabric: form.fabricContent,
        category: categories.find((c) => c.id === form.categoryId)?.name ?? '',
        price: form.basePrice,
        occasion: form.occasion,
      }, 'admin') as { status?: string; errorMsg?: string | null; outputData?: Record<string, unknown> }
      if (isAiJobFailed(job)) {
        toastFail(job.errorMsg ?? 'AI generation failed. Add API key in AI Command Brain.', 'ai-desc-fail')
        return
      }
      const parsed = parseAiProductOutput(job.outputData ?? {})
      const en = parsed.description ?? parsed.longDescription
      const bn = parsed.descriptionBn as string | undefined
      if (en || bn) {
        setForm((prev) => ({
          ...prev,
          ...(en ? { descriptionEn: en as string } : {}),
          ...(bn ? { descriptionBn: bn } : {}),
        }))
        setDirty(true)
        toastOk('AI description generated', 'ai-desc-ok')
      } else {
        toastFail('AI returned no description. Check API key in Command Brain.', 'ai-desc-empty')
      }
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'AI generation failed. Add key in /dashboard/ai-agent', 'ai-desc-fail')
    } finally {
      setAiLoading(false)
    }
  }, [form.name, form.fabricContent, form.categoryId, form.basePrice, form.occasion, categories])

  const handleFillAllWithAI = useCallback(async () => {
    if (!form.name.trim()) { toast.error('Enter product name first.'); return }
    setFillAllLoading(true)
    try {
      const job = await generateAIProduct({
        productName: form.name,
        fabric: form.fabricContent,
        category: categories.find((c) => c.id === form.categoryId)?.name ?? '',
        price: form.basePrice,
        occasion: form.occasion,
        fillSeo: true,
      }, 'admin') as { status?: string; errorMsg?: string | null; outputData?: Record<string, unknown> }
      if (isAiJobFailed(job)) {
        toastFail(job.errorMsg ?? 'AI fill failed. Add API key in AI Command Brain.', 'ai-fill-fail')
        return
      }
      const out = parseAiProductOutput(job.outputData ?? {})
      const en = out.description ?? out.longDescription
      const bn = out.descriptionBn as string | undefined
      setForm((prev) => ({
        ...prev,
        descriptionEn: (en as string) || prev.descriptionEn,
        descriptionBn: bn || prev.descriptionBn,
        metaTitle: out.metaTitle ?? (prev.metaTitle || `${prev.name} | SPLARO Bangladesh`).slice(0, 60),
        metaDescription: out.metaDescription ?? prev.metaDescription,
        slug: prev.slug || slugify(prev.name),
        fabricContent: out.fabric ?? prev.fabricContent,
        season: out.season ?? prev.season,
        occasion: out.occasion ?? prev.occasion,
      }))
      setDirty(true)
      toastOk('AI filled product fields', 'ai-fill-ok')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'AI fill failed. Add key in /dashboard/ai-agent', 'ai-fill-fail')
    } finally {
      setFillAllLoading(false)
    }
  }, [form.name, form.fabricContent, form.categoryId, form.basePrice, form.occasion, categories])

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Product name required.'); return }
    if (!form.nameBn.trim()) { toast.error('নাম (বাংলা) লিখুন।'); setActiveTab('basic'); return }
    const { sellingPrice, compareAt } = resolveSellingPrices(form.basePrice, form.compareAtPrice)
    if (!sellingPrice || sellingPrice <= 0) { toast.error('Enter a valid price.'); return }
    setSaving(true)
    try {
      const tags = parseTagsInput(form.tags)
      const costPrice = form.costPrice.trim() ? Number(form.costPrice) : undefined
      await updateProduct.mutateAsync({
        id: productId,
        name: form.name.trim(),
        slug: form.slug,
        nameBn: form.nameBn.trim(),
        shortDescription: form.shortDescription.trim(),
        description: fullDescription.trim(),
        basePrice: sellingPrice,
        compareAtPrice: compareAt ?? null,
        ...(costPrice && costPrice > 0 ? { costPrice } : {}),
        ...(form.sku.trim() ? { sku: form.sku.trim() } : {}),
        lowStockThreshold: Number(form.lowStockThreshold) || 5,
        tags,
        weavingType: form.weavingType,
        collectionId: form.collectionId || '',
        categoryId: form.categoryId,
        fabricContent: form.fabricContent,
        fitType: mergeFitAndProductType(form.productType, form.fitType),
        occasion: form.occasion,
        season: form.season,
        metaTitle: form.metaTitle,
        metaDescription: form.metaDescription,
        isPublished: form.isPublished,
        isHidden: form.isHidden,
        status: form.status,
        isFeatured: form.isFeatured,
        isNewArrival: form.isNewArrival,
        isBestSeller: form.isBestSeller,
        ...(form.imageUrl.trim() ? { imageUrl: form.imageUrl.trim() } : {}),
      })
      toastApiSaved('Product')
      setDirty(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!window.confirm(`Archive "${form.name}"? It will be hidden from storefront.`)) return
    try {
      await deleteProduct.mutateAsync(productId)
      toast.success('Product archived.')
      navigate(moduleHref)
    } catch {
      toast.error('Could not archive product.')
    }
  }

  const saveVariantRow = (variantId: string) => {
    const stock = Number(stockEdits[variantId])
    if (Number.isNaN(stock) || stock < 0) { toast.error('Invalid stock number.'); return }
    const sku = skuEdits[variantId]?.trim() ?? ''
    updateVariant.mutate(
      { productId, variantId, stock, ...(sku ? { sku } : {}) },
      {
        onSuccess: () => toastOk('Variant saved to server.'),
        onError: () => toastFail('Could not update variant.'),
      },
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(200,169,126,0.1)]">
          <Loader2 className="h-5 w-5 animate-spin text-[#5E7CFF]" />
        </div>
        <p className="text-sm font-bold text-[#6B6B6B]">Loading product…</p>
      </div>
    )
  }

  if (isError || !product) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <p className="text-sm font-bold text-red-700">Product not found or failed to load.</p>
        <AdminLinkButton href={moduleHref} variant="ghost">
          <ArrowLeft className="h-4 w-4" /> Back to products
        </AdminLinkButton>
      </div>
    )
  }

  const totalStock = product.variants?.reduce((s, v) => s + (v.stock ?? v.stockQuantity ?? 0), 0) ?? 0
  const lowStock = totalStock > 0 && totalStock < 10

  return (
    <div className="mx-auto max-w-5xl space-y-5">

      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <AdminLinkButton href={moduleHref} variant="ghost">
          <ArrowLeft className="h-4 w-4" /> Products
        </AdminLinkButton>
        <div className="flex items-center gap-2">
          <StatusBadge published={form.isPublished} />
          <AnimatePresence>
            {dirty && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-amber-700"
              >
                Unsaved
              </motion.span>
            )}
          </AnimatePresence>
          <AdminButton variant="gold" loading={saving} onClick={handleSave}>
            <Save className="h-3.5 w-3.5" /> Save changes
          </AdminButton>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">

        {/* LEFT */}
        <div className="space-y-5">

          {/* 1 — Product Info */}
          <FormSection title="Product Info" icon={Package} number={1}>
            <div className="product-form-shell">
              <ProductCreateTabbedForm
                tab={activeTab}
                onTabChange={setActiveTab}
                form={form}
                set={(key, value) => {
                  if (key === 'name') {
                    handleNameChange(String(value))
                    return
                  }
                  set(key as keyof typeof form, value as (typeof form)[typeof key])
                }}
                onNameChange={handleNameChange}
                departmentId={departmentId}
                catsLoading={false}
                departments={categoryPicker.departments}
                subcategories={subcategories}
                selectedCategoryName={categories.find((c) => c.id === form.categoryId)?.name}
                sizeList={[]}
                allSizeChips={[]}
                variantCount={product.variants?.length ?? 0}
                collections={collections}
                colorsOpen={false}
                onColorsOpenToggle={() => undefined}
                colorRows={[]}
                activeColorId=""
                imageUrls={form.imageUrl ? [form.imageUrl] : []}
                onDepartmentChange={handleDepartmentChange}
                onSubcategoryChange={handleSubcategoryChange}
                onNameBlur={() => undefined}
                onApplyDescriptionDraft={applyDescriptionDraft}
                onApplyBanglaPolish={applyBanglaPolish}
                onAIGenerate={handleGenerateDescription}
                aiLoading={aiLoading}
                onAddColorRow={() => undefined}
                onActiveColor={() => undefined}
                onUpdateColorRow={() => undefined}
                onRemoveColorRow={() => undefined}
                onAppendBanglaPhrase={appendBanglaPhrase}
                descriptionPlaceholderEn="Premium English description…"
                descriptionPlaceholderBn="বাংলায় সুন্দর বিবরণ…"
                showVariantControls={false}
                headerSlot={
                  form.slug ? (
                    <div className="product-form-slug-row">
                      <Link2 className="h-3.5 w-3.5 flex-shrink-0 text-[var(--admin-accent)]" strokeWidth={2} />
                      <span className="text-[11px] text-[var(--admin-text-muted)]">splaro.com.bd/products/</span>
                      <input
                        className="flex-1 bg-transparent text-[11px] font-black text-[var(--admin-text)] outline-none"
                        value={form.slug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                      />
                      {!slugEdited ? (
                        <span className="product-form-slug-row__auto">Auto</span>
                      ) : null}
                    </div>
                  ) : null
                }
              />
              <div className="mt-4">
                <ProductAIAssist
                  name={form.name}
                  description={fullDescription}
                  metaTitle={form.metaTitle}
                  metaDescription={form.metaDescription}
                  fabricContent={form.fabricContent}
                  occasion={form.occasion}
                  onFillAll={handleFillAllWithAI}
                  fillLoading={fillAllLoading}
                />
              </div>
              <label className="admin-field mt-4">
                <FieldLabel>Season</FieldLabel>
                <select className="admin-input admin-input--premium" value={form.season} onChange={(e) => set('season', e.target.value)}>
                  <option value="">All Season</option>
                  <option>Summer</option>
                  <option>Winter</option>
                  <option>Eid</option>
                  <option>Puja</option>
                </select>
              </label>
            </div>
          </FormSection>

          {/* 2 — Variants */}
          {product.variants && product.variants.length > 0 && (
            <FormSection title={`Variants & Stock${lowStock ? ' — ⚠ Low' : ''}`} icon={Layers} number={3}>
              <div className="overflow-hidden rounded-xl border border-[rgba(17,17,17,0.06)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(17,17,17,0.05)] bg-[rgba(17,17,17,0.02)]">
                      {['SKU', 'Size', 'Color', 'Stock', ''].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.1em] text-[#6B6B6B]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((v, i) => {
                      const stock = Number(v.id ? stockEdits[v.id] ?? '0' : '0')
                      return (
                        <tr key={v.id ?? i} className="border-b border-[rgba(17,17,17,0.04)] last:border-0 transition-colors hover:bg-[rgba(200,169,126,0.04)]">
                          <td className="px-3 py-2.5">
                            <input
                              className="admin-input w-full min-w-[100px] font-mono text-[11px]"
                              placeholder="Your SKU"
                              value={v.id ? skuEdits[v.id] ?? '' : ''}
                              onChange={(e) => v.id && setSkuEdits((prev) => ({ ...prev, [v.id!]: e.target.value }))}
                            />
                          </td>
                          <td className="px-3 py-2.5 text-sm font-semibold">{v.size ?? '—'}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {v.color && <span className="h-3 w-3 rounded-full border border-[rgba(17,17,17,0.1)]" style={{ background: v.color }} />}
                              <span className="text-sm font-semibold">{v.colorName ?? v.color ?? '—'}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <input
                                className={cn('admin-input w-20 text-center font-black',
                                  stock < 5 && '!border-red-200 !bg-red-50 !text-red-700',
                                  stock >= 5 && stock < 15 && '!border-amber-200 !bg-amber-50/60 !text-amber-700',
                                )}
                                type="number" min={0}
                                value={v.id ? stockEdits[v.id] ?? '0' : '0'}
                                onChange={(e) => v.id && setStockEdits((prev) => ({ ...prev, [v.id!]: e.target.value }))}
                              />
                              {stock < 5 && <span className="text-[10px] font-black text-red-600">LOW</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            {v.id && (
                              <button
                                onClick={() => saveVariantRow(v.id!)}
                                disabled={updateVariant.isPending}
                                className="rounded-lg bg-[rgba(200,169,126,0.12)] px-2.5 py-1 text-[11px] font-black text-[#9a7b52] transition-colors hover:bg-[rgba(200,169,126,0.22)] disabled:opacity-50"
                              >
                                Save
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-[#6B6B6B]">
                Total stock: <span className={cn('font-black', lowStock ? 'text-amber-600' : 'text-[#111111]')}>{totalStock} units</span>
              </p>
            </FormSection>
          )}

          {/* 4 — SEO */}
          <FormSection title="SEO & Meta" icon={Star} number={4}>
            <div className="space-y-3">
              <label className="admin-field">
                <FieldLabel>Meta title</FieldLabel>
                <input className="admin-input" value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} placeholder="SEO title (defaults to product name)" />
              </label>
              <label className="admin-field">
                <FieldLabel>Meta description</FieldLabel>
                <textarea className="admin-input min-h-[80px]" value={form.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} placeholder="SEO description…" />
              </label>
              {form.slug && (
                <div className="rounded-xl border border-[rgba(17,17,17,0.06)] bg-[rgba(17,17,17,0.02)] p-3">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-[#6B6B6B]">Google Preview</p>
                  <p className="text-sm font-bold text-blue-600 underline">{form.metaTitle || form.name}</p>
                  <p className="text-[11px] text-green-700">splaro.com.bd/products/{form.slug}</p>
                  <p className="mt-0.5 text-[11px] text-[#6B6B6B] line-clamp-2">{form.metaDescription || fullDescription || 'No description set.'}</p>
                </div>
              )}
            </div>
          </FormSection>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">

          {/* Image */}
          <div className="admin-module-card">
            <div className="flex items-center gap-2 border-b border-[rgba(17,17,17,0.06)] pb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(200,169,126,0.12)]">
                <ImageIcon className="h-3.5 w-3.5 text-[#5E7CFF]" strokeWidth={2} />
              </div>
              <h3 className="text-[0.875rem] font-black tracking-tight text-[#111111]">Product Image</h3>
            </div>
            <div className="mt-4 space-y-3">
              {form.imageUrl ? (
                <div className="group relative aspect-square w-full overflow-hidden rounded-xl border border-[rgba(17,17,17,0.08)]">
                  <Image src={form.imageUrl} alt={form.name} fill className="object-cover" sizes="320px" unoptimized />
                  <button
                    onClick={() => set('imageUrl', '')}
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex aspect-square w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[rgba(200,169,126,0.3)] bg-[rgba(200,169,126,0.04)]">
                  <ImageIcon className="h-8 w-8 text-[rgba(200,169,126,0.4)]" />
                  <p className="mt-2 text-[11px] font-semibold text-[#6B6B6B]">No image</p>
                </div>
              )}
              <label className="admin-field">
                <FieldLabel>Image URL</FieldLabel>
                <input className="admin-input text-xs" value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} placeholder="https://…" />
              </label>
            </div>
          </div>

          {/* Visibility */}
          <div className="admin-module-card space-y-3">
            <div className="flex items-center gap-2 border-b border-[rgba(17,17,17,0.06)] pb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(200,169,126,0.12)]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#5E7CFF]" strokeWidth={2} />
              </div>
              <h3 className="text-[0.875rem] font-black tracking-tight text-[#111111]">Visibility</h3>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[rgba(17,17,17,0.03)] px-4 py-3">
              <div>
                <p className="text-sm font-black text-[#111111]">{form.isPublished ? 'Live on store' : 'Draft'}</p>
                <p className="text-[11px] font-semibold text-[#6B6B6B]">{form.isPublished ? 'Visible to customers' : 'Hidden from storefront'}</p>
              </div>
              <Toggle on={form.isPublished} onToggle={() => set('isPublished', !form.isPublished)} />
            </div>
            {[
              { key: 'isFeatured' as const, label: 'Featured', desc: 'Show in featured section' },
              { key: 'isNewArrival' as const, label: 'New Arrival', desc: 'New arrivals section' },
              { key: 'isBestSeller' as const, label: 'Best Seller', desc: 'Best sellers section' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between rounded-xl px-4 py-2.5 hover:bg-[rgba(17,17,17,0.02)]">
                <div>
                  <p className="text-sm font-bold text-[#111111]">{label}</p>
                  <p className="text-[11px] font-semibold text-[#6B6B6B]">{desc}</p>
                </div>
                <Toggle on={form[key]} onToggle={() => set(key, !form[key])} size="sm" />
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="admin-module-card space-y-3">
            <div className="flex items-center gap-2 border-b border-[rgba(17,17,17,0.06)] pb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(200,169,126,0.12)]">
                <BarChart3 className="h-3.5 w-3.5 text-[#5E7CFF]" strokeWidth={2} />
              </div>
              <h3 className="text-[0.875rem] font-black tracking-tight text-[#111111]">Stats</h3>
            </div>
            {[
              { label: 'SKU', value: String((product as unknown as Record<string, unknown>).sku ?? '—') },
              { label: 'Variants', value: `${product.variants?.length ?? 0}` },
              { label: 'Total stock', value: `${totalStock} units` },
              { label: 'Status', value: String((product as unknown as Record<string, unknown>).status ?? (product.isPublished ? 'PUBLISHED' : 'DRAFT')) },
              { label: 'URL slug', value: form.slug || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between border-b border-[rgba(17,17,17,0.05)] pb-2.5 last:border-0 last:pb-0">
                <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[#6B6B6B]">{label}</span>
                <span className={cn('max-w-[160px] truncate text-right text-sm font-black text-[#111111]', label === 'URL slug' && 'font-mono text-[10px]')}>{value}</span>
              </div>
            ))}
          </div>

          {/* Danger zone */}
          <div className="rounded-2xl border border-red-100 bg-red-50/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-red-600">Danger Zone</p>
            </div>
            <p className="mb-3 text-xs font-semibold text-red-500">Hides product from storefront. Cannot be undone.</p>
            <AdminButton
              variant="ghost"
              className="!w-full !justify-center !border-red-200 !text-red-600 hover:!bg-red-100"
              loading={deleteProduct.isPending}
              onClick={handleArchive}
            >
              Archive product
            </AdminButton>
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-[rgba(200,169,126,0.3)] bg-white/95 px-5 py-3 shadow-[0_8px_32px_rgba(17,17,17,0.14)] backdrop-blur-xl"
          >
            <Pencil className="h-3.5 w-3.5 text-[#5E7CFF]" />
            <span className="text-sm font-bold text-[#111111]">Unsaved changes</span>
            <AdminButton variant="gold" loading={saving} onClick={handleSave}>
              <Save className="h-3.5 w-3.5" /> Save
            </AdminButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
