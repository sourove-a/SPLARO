'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Loader2, Save, Package,
  ImageIcon, Tag, Star, Layers, AlertTriangle,
  CheckCircle2, Circle, Pencil, X, Sparkles, Link2,
  BarChart3, ShieldAlert,
} from 'lucide-react'
import { AdminButton, AdminLinkButton } from '@/components/ui/AdminButton'
import { toastApiSaved, toastOk, toastFail } from '@/lib/admin/feedback'
import { isAiJobFailed, parseAiProductOutput } from '@/lib/admin/parse-ai-product'
import { useCategories, useProduct, useUpdateProduct, useDeleteProduct, useUpdateProductVariant } from '@/lib/api/hooks'
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
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()
  const updateVariant = useUpdateProductVariant()
  const [stockEdits, setStockEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [fillAllLoading, setFillAllLoading] = useState(false)
  const [slugEdited, setSlugEdited] = useState(false)

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    basePrice: '',
    compareAtPrice: '',
    categoryId: '',
    imageUrl: '',
    isPublished: false,
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

  useEffect(() => {
    if (!product) return
    const p = product as unknown as Record<string, unknown>
    setForm({
      name: product.name,
      slug: String(p.slug ?? slugify(product.name)),
      description: product.description ?? '',
      basePrice: String(product.basePrice),
      compareAtPrice: String(p.compareAtPrice ?? ''),
      categoryId: product.category?.id ?? product.categoryId ?? '',
      imageUrl: product.images?.[0]?.url ?? '',
      isPublished: product.isPublished,
      isFeatured: p.isFeatured === true,
      isNewArrival: p.isNewArrival === true,
      isBestSeller: p.isBestSeller === true,
      fabricContent: String(p.fabricContent ?? ''),
      fitType: String(p.fitType ?? ''),
      season: String(p.season ?? ''),
      occasion: String(p.occasion ?? ''),
      metaTitle: String(p.metaTitle ?? ''),
      metaDescription: String(p.metaDescription ?? ''),
    })
    const stocks: Record<string, string> = {}
    product.variants?.forEach((v) => {
      if (v.id) stocks[v.id] = String(v.stock ?? v.stockQuantity ?? 0)
    })
    setStockEdits(stocks)
    setSlugEdited(false)
    setDirty(false)
  }, [product])

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
      if (parsed.description) {
        set('description', parsed.description)
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
      setForm((prev) => ({
        ...prev,
        description: out.description ?? prev.description,
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
    const price = Number(form.basePrice)
    if (!price || price <= 0) { toast.error('Enter a valid price.'); return }
    setSaving(true)
    try {
      await updateProduct.mutateAsync({
        id: productId,
        name: form.name.trim(),
        basePrice: price,
        isPublished: form.isPublished,
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        ...(form.categoryId ? { categoryId: form.categoryId } : {}),
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

  const saveVariantStock = (variantId: string) => {
    const stock = Number(stockEdits[variantId])
    if (Number.isNaN(stock) || stock < 0) { toast.error('Invalid stock number.'); return }
    updateVariant.mutate(
      { productId, variantId, stock },
      {
        onSuccess: () => toast.success('Stock updated.'),
        onError: () => toast.error('Could not update stock.'),
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
            <div className="space-y-4">

              {/* Name + auto-slug */}
              <div>
                <label className="admin-field">
                  <FieldLabel required>Product name</FieldLabel>
                  <input
                    className="admin-input text-[15px] font-bold"
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Silk Blend Anarkali Dress"
                  />
                </label>
                {form.slug && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-[rgba(17,17,17,0.03)] px-3 py-2">
                    <Link2 className="h-3 w-3 flex-shrink-0 text-[#9a7b52]" strokeWidth={2} />
                    <span className="text-[11px] text-[#6B6B6B]">splaro.com.bd/products/</span>
                    <input
                      className="flex-1 bg-transparent text-[11px] font-black text-[#111111] outline-none"
                      value={form.slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                    />
                    {!slugEdited && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-600">Auto</span>
                    )}
                  </div>
                )}
              </div>

              {/* Description + AI */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <FieldLabel>Description</FieldLabel>
                  <button
                    type="button"
                    onClick={handleGenerateDescription}
                    disabled={aiLoading}
                    className="flex items-center gap-1.5 rounded-full bg-[rgba(200,169,126,0.14)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#9a7b52] transition-all hover:bg-[rgba(200,169,126,0.26)] disabled:opacity-50"
                  >
                    {aiLoading
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Sparkles className="h-3 w-3" />
                    }
                    {aiLoading ? 'Generating…' : 'AI Write'}
                  </button>
                </div>
                <textarea
                  className="admin-input min-h-[110px] resize-y"
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Product description — or click AI Write to auto-generate"
                />
                <ProductAIAssist
                  name={form.name}
                  description={form.description}
                  metaTitle={form.metaTitle}
                  metaDescription={form.metaDescription}
                  fabricContent={form.fabricContent}
                  occasion={form.occasion}
                  onFillAll={handleFillAllWithAI}
                  fillLoading={fillAllLoading}
                />
              </div>

              {/* Price */}
              <div className="grid grid-cols-2 gap-3">
                <label className="admin-field">
                  <FieldLabel required>Price (BDT)</FieldLabel>
                  <input className="admin-input font-black" type="number" min="0" value={form.basePrice} onChange={(e) => set('basePrice', e.target.value)} placeholder="0" />
                </label>
                <label className="admin-field">
                  <FieldLabel>Compare at (BDT)</FieldLabel>
                  <input className="admin-input" type="number" min="0" value={form.compareAtPrice} onChange={(e) => set('compareAtPrice', e.target.value)} placeholder="0" />
                </label>
              </div>

              <label className="admin-field">
                <FieldLabel>Category</FieldLabel>
                <select className="admin-input" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </FormSection>

          {/* 2 — Product Details */}
          <FormSection title="Product Details" icon={Tag} number={2}>
            <div className="grid grid-cols-2 gap-3">
              <label className="admin-field">
                <FieldLabel>Fabric / Material</FieldLabel>
                <input className="admin-input" value={form.fabricContent} onChange={(e) => set('fabricContent', e.target.value)} placeholder="e.g. 100% Silk" />
              </label>
              <label className="admin-field">
                <FieldLabel>Fit type</FieldLabel>
                <input className="admin-input" value={form.fitType} onChange={(e) => set('fitType', e.target.value)} placeholder="e.g. Regular, Loose" />
              </label>
              <label className="admin-field">
                <FieldLabel>Season</FieldLabel>
                <select className="admin-input" value={form.season} onChange={(e) => set('season', e.target.value)}>
                  <option value="">All Season</option>
                  <option>Summer</option><option>Winter</option><option>Eid</option><option>Puja</option>
                </select>
              </label>
              <label className="admin-field">
                <FieldLabel>Occasion</FieldLabel>
                <select className="admin-input" value={form.occasion} onChange={(e) => set('occasion', e.target.value)}>
                  <option value="">Any</option>
                  <option>Casual</option><option>Formal</option><option>Eid</option><option>Wedding</option><option>Party</option>
                </select>
              </label>
            </div>
          </FormSection>

          {/* 3 — Variants & Stock */}
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
                          <td className="px-3 py-2.5 font-mono text-[11px] text-[#6B6B6B]">{v.sku ?? '—'}</td>
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
                                onClick={() => saveVariantStock(v.id!)}
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
                  <p className="mt-0.5 text-[11px] text-[#6B6B6B] line-clamp-2">{form.metaDescription || form.description || 'No description set.'}</p>
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
