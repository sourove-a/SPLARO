'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Loader2, Save, Package,
  Layers, AlertTriangle,
  CheckCircle2, Circle, Pencil, Link2,
  BarChart3, ShieldAlert, Copy, ExternalLink,
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
import { copyProductStorefrontUrl, productStorefrontUrl } from '@/lib/admin/product-storefront-url'
import { isAiJobFailed, parseAiProductOutput } from '@/lib/admin/parse-ai-product'
import { useCategories, useCollections, useProduct, useUpdateProduct, useDeleteProduct, useProductVersions, useRestoreProductVersion, useAdminSession, usePermission } from '@/lib/api/hooks'
import { ProductCreateTabbedForm, type ProductCreateTab } from '@/components/modules/product-form/ProductCreateTabbedForm'
import { ProductMediaPanel } from '@/components/modules/product-form/ProductMediaPanel'
import { ProductVariantManager } from '@/components/modules/product-form/ProductVariantManager'
import { parseProductMedia } from '@/lib/admin/product-media-utils'
import { AdminSwitchRow } from '@/components/ui/AdminSwitch'
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
import { fetchProductQR, fetchProductBarcode } from '@/lib/api/products'
import { ProductAIAssist } from '@/components/agent/ProductAIAssist'
import { ModuleReadinessBar } from '@/components/ui/connection/ModuleReadinessBar'
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

function toDatetimeLocalValue(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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
    <div className="admin-module-card product-edit-card space-y-4">
      <div className="product-edit-card__head">
        <div className="product-edit-card__icon">
          <Icon className="h-3.5 w-3.5 text-[var(--admin-brand-gold)]" strokeWidth={2} />
        </div>
        <h3 className="product-edit-card__title">{title}</h3>
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
      published
        ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-400'
        : 'border border-[var(--admin-glass-border-subtle)] bg-[var(--admin-glass-soft)] text-[var(--admin-text-muted)]',
    )}>
      {published ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
      {published ? 'Live' : 'Draft'}
    </span>
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
  const { data: adminSession } = useAdminSession()
  const canEditProducts = usePermission('products', 'edit')
  const canDeleteProducts = usePermission('products', 'delete')
  const { data: versions = [] } = useProductVersions(productId)
  const restoreVersion = useRestoreProductVersion()
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [fillAllLoading, setFillAllLoading] = useState(false)
  const [visibilityBusy, setVisibilityBusy] = useState<string | null>(null)
  const [slugEdited, setSlugEdited] = useState(false)
  const [departmentId, setDepartmentId] = useState('')
  const [subDepartmentId, setSubDepartmentId] = useState('')
  const [activeTab, setActiveTab] = useState<ProductCreateTab>('basic')
  const [qrGenerating, setQrGenerating] = useState(false)
  const [qrPreviewUrl, setQrPreviewUrl] = useState('')
  const [barcodeGenerating, setBarcodeGenerating] = useState(false)
  const [barcodePreviewUrl, setBarcodePreviewUrl] = useState('')

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
    imageUrls: [] as string[],
    videoUrl: '',
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
    careInstructions: '',
    metaTitle: '',
    metaDescription: '',
    weight: '',
    badge: '',
    rmCode: '',
    barcode: '',
    qrCode: '',
    publishAt: '',
  })

  const categoryPicker = useMemo(() => buildCategoryPicker(categories), [categories])

  const subcategories = useMemo(
    () => (departmentId ? categoryPicker.subcategoriesForDepartment(departmentId) : []),
    [departmentId, categoryPicker],
  )

  const subDepartments = useMemo(
    () => (subDepartmentId ? categoryPicker.childrenOf(subDepartmentId) : []),
    [subDepartmentId, categoryPicker],
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
    const media = parseProductMedia(p.images)
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
      imageUrls: media.imageUrls,
      videoUrl: media.videoUrl,
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
      careInstructions: String(extra.careInstructions ?? ''),
      metaTitle: String(p.metaTitle ?? ''),
      metaDescription: String(p.metaDescription ?? ''),
      weight: p.weight != null ? String(p.weight) : '',
      badge: String(p.badge ?? ''),
      rmCode: String(p.rmCode ?? ''),
      barcode: String(p.barcode ?? ''),
      qrCode: String(p.qrCode ?? ''),
      publishAt: toDatetimeLocalValue(p.publishAt),
    })
    setSlugEdited(false)
    setDirty(false)
    if (categoryId && categories.length) {
      const dept = categoryPicker.departmentForCategory(categoryId)
      setDepartmentId(dept)
      const selected = categories.find((c) => c.id === categoryId)
      if (selected?.parentId && selected.parentId !== dept) {
        setSubDepartmentId(selected.parentId)
      } else {
        setSubDepartmentId('')
      }
    }
  }, [product, categories.length, categoryPicker, categories])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const saveVisibility = useCallback(
    async (updates: {
      isPublished?: boolean
      isFeatured?: boolean
      isNewArrival?: boolean
      isBestSeller?: boolean
    }) => {
      const busyKey =
        updates.isPublished !== undefined
          ? 'live'
          : updates.isFeatured !== undefined
            ? 'featured'
            : updates.isNewArrival !== undefined
              ? 'new'
              : 'best'
      const nextPublished = updates.isPublished ?? form.isPublished
      const nextStatus = nextPublished ? 'PUBLISHED' : 'DRAFT'

      setVisibilityBusy(busyKey)
      const prevForm = {
        isPublished: form.isPublished,
        status: form.status,
        isFeatured: form.isFeatured,
        isNewArrival: form.isNewArrival,
        isBestSeller: form.isBestSeller,
      }
      const nextForm = {
        isPublished: nextPublished,
        status: nextStatus as typeof form.status,
        isFeatured: updates.isFeatured ?? form.isFeatured,
        isNewArrival: updates.isNewArrival ?? form.isNewArrival,
        isBestSeller: updates.isBestSeller ?? form.isBestSeller,
        ...(updates.isPublished === true ? { isHidden: false } : {}),
      }
      setForm((prev) => ({ ...prev, ...nextForm }))

      try {
        await updateProduct.mutateAsync({
          id: productId,
          skipVersionSnapshot: true,
          ...updates,
          ...(updates.isPublished === true ? { isHidden: false } : {}),
        })
        if (updates.isPublished !== undefined) {
          toastOk(nextPublished ? 'Live on storefront' : 'Saved as draft')
        } else {
          toastOk('Visibility updated')
        }
      } catch (err) {
        setForm((prev) => ({ ...prev, ...prevForm }))
        toastFail(err instanceof Error ? err.message : 'Could not save visibility')
      } finally {
        setVisibilityBusy(null)
      }
    },
    [form, productId, updateProduct],
  )

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
    setSubDepartmentId('')
    set('categoryId', '')
  }

  const handleSubcategoryChange = (categoryId: string) => {
    if (!categoryId) {
      setSubDepartmentId('')
      set('categoryId', '')
      return
    }
    const children = categoryPicker.childrenOf(categoryId)
    if (children.length > 0) {
      setSubDepartmentId(categoryId)
      set('categoryId', '')
      return
    }
    setSubDepartmentId('')
    set('categoryId', categoryId)
  }

  const handleSubTypeChange = (categoryId: string) => {
    if (!categoryId) {
      set('categoryId', '')
      return
    }
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

  const handleGenerateQr = useCallback(async () => {
    setQrGenerating(true)
    try {
      const res = await fetchProductQR(productId)
      setQrPreviewUrl(res.qr)
      setForm((prev) => ({ ...prev, qrCode: res.qr }))
      setDirty(true)
      toastOk('QR generated — click Save to persist.', 'qr-gen-ok')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'QR generation failed.', 'qr-gen-fail')
    } finally {
      setQrGenerating(false)
    }
  }, [productId])

  const handleGenerateBarcode = useCallback(async () => {
    setBarcodeGenerating(true)
    try {
      const res = await fetchProductBarcode(productId)
      setBarcodePreviewUrl(res.barcode)
      setForm((prev) => ({ ...prev, barcode: res.barcode }))
      setDirty(true)
      toastOk('Barcode generated — click Save to persist.', 'barcode-gen-ok')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Barcode generation failed.', 'barcode-gen-fail')
    } finally {
      setBarcodeGenerating(false)
    }
  }, [productId])

  const handleSave = async () => {
    if (!canEditProducts) {
      toast.error('Your role cannot edit products.')
      return
    }
    if (!form.name.trim()) { toast.error('Product name required.'); return }
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
        ...(form.nameBn.trim() ? { nameBn: form.nameBn.trim() } : {}),
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
        careInstructions: form.careInstructions,
        season: form.season,
        metaTitle: form.metaTitle,
        metaDescription: form.metaDescription,
        isPublished: form.isPublished,
        isHidden: form.isHidden,
        status: form.status,
        isFeatured: form.isFeatured,
        isNewArrival: form.isNewArrival,
        isBestSeller: form.isBestSeller,
        weight: form.weight.trim() ? Number(form.weight) : null,
        badge: form.badge.trim() || null,
        rmCode: form.rmCode.trim() || null,
        barcode: form.barcode.trim() || null,
        qrCode: form.qrCode.trim() || null,
        publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : null,
        imageUrls: form.imageUrls,
        videoUrl: form.videoUrl.trim(),
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(200,169,126,0.1)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--admin-brand-gold)]" />
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
  const storefrontUrl = form.slug.trim() ? productStorefrontUrl(form.slug) : ''

  const handleCopyStorefrontUrl = async () => {
    if (!form.slug.trim()) {
      toast.error('Save a URL slug first.')
      return
    }
    if (!form.isPublished) {
      toast.error('Publish the product first — draft links do not work on the storefront.')
      return
    }
    const ok = await copyProductStorefrontUrl(form.slug)
    if (ok) toastOk('Storefront link copied')
    else toastFail('Could not copy link')
  }

  const handleOpenStorefront = () => {
    if (!form.slug.trim()) {
      toast.error('Save a URL slug first.')
      return
    }
    if (!form.isPublished) {
      toast.error('Publish first to view on the live storefront.')
      return
    }
    window.open(storefrontUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="product-edit-page admin-module-page product-page w-full">

      {/* Top bar */}
      <div className="product-edit-page__topbar">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <AdminLinkButton href={moduleHref} variant="ghost">
            <ArrowLeft className="h-4 w-4" /> Products
          </AdminLinkButton>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-black text-[var(--admin-text)]">{form.name || 'Edit product'}</p>
            {form.slug ? (
              <p className="truncate text-[10px] font-semibold text-[var(--admin-text-muted)]">/products/{form.slug}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
          {form.slug ? (
            <>
              <AdminButton variant="ghost" size="sm" onClick={() => void handleCopyStorefrontUrl()}>
                <Copy className="h-3.5 w-3.5" /> Copy link
              </AdminButton>
              <AdminButton variant="ghost" size="sm" onClick={handleOpenStorefront} disabled={!form.isPublished}>
                <ExternalLink className="h-3.5 w-3.5" /> View live
              </AdminButton>
            </>
          ) : null}
          <StatusBadge published={form.isPublished} />
          <AnimatePresence>
            {dirty && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-amber-400"
              >
                Unsaved
              </motion.span>
            )}
          </AnimatePresence>
          <AdminButton variant="gold" loading={saving} disabled={!canEditProducts} onClick={handleSave}>
            <Save className="h-3.5 w-3.5" /> Save changes
          </AdminButton>
        </div>
      </div>

      {!canEditProducts ? (
        <div className="mb-4 rounded-[16px] border border-amber-200/60 bg-amber-50/80 px-4 py-3 text-xs font-semibold text-amber-900">
          View-only — your role can browse this product but cannot save changes.
        </div>
      ) : null}

      <ModuleReadinessBar
        items={[
          {
            key: 'publish',
            label: form.isPublished ? 'Published on storefront' : 'Draft — not on storefront',
            ok: form.isPublished,
          },
          {
            key: 'variants',
            label: `${product.variants?.length ?? 0} variant${(product.variants?.length ?? 0) === 1 ? '' : 's'}`,
            ok: (product.variants?.length ?? 0) > 0,
          },
          {
            key: 'stock',
            label: `${totalStock} units in stock`,
            ok: totalStock > 0,
            highlight: !lowStock && totalStock > 0,
          },
          {
            key: 'dirty',
            label: dirty ? 'Unsaved changes' : 'Saved',
            ok: !dirty,
            highlight: !dirty,
          },
        ]}
      />

      <div className="product-edit-page__summary" aria-label="Product edit summary">
        <div>
          <span>Storefront URL</span>
          <strong>{form.slug ? `/products/${form.slug}` : 'Add slug before publishing'}</strong>
        </div>
        <div>
          <span>Variants</span>
          <strong>{product.variants?.length ?? 0}</strong>
        </div>
        <div>
          <span>Stock</span>
          <strong className={lowStock ? 'product-edit-page__summary-warn' : ''}>{totalStock} units</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{form.isPublished ? 'Live' : 'Draft'}</strong>
        </div>
      </div>

      {/* Two-column layout — full width, sidebar sticky */}
      <div className="product-edit-page__grid">

        {/* LEFT */}
        <div className="product-edit-page__main min-w-0 space-y-5">

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
                subDepartmentId={subDepartmentId}
                subDepartments={subDepartments}
                selectedCategoryName={categories.find((c) => c.id === form.categoryId)?.name}
                sizeList={[]}
                allSizeChips={[]}
                variantCount={product.variants?.length ?? 0}
                collections={collections}
                colorsOpen={false}
                onColorsOpenToggle={() => undefined}
                colorRows={[]}
                activeColorId=""
                imageUrls={form.imageUrls}
                onDepartmentChange={handleDepartmentChange}
                onSubcategoryChange={handleSubcategoryChange}
                onSubTypeChange={handleSubTypeChange}
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
                onInstantPublish={(next) => void saveVisibility({ isPublished: next })}
                productId={productId}
                onGenerateBarcode={() => void handleGenerateBarcode()}
                barcodeGenerating={barcodeGenerating}
                {...(barcodePreviewUrl || form.barcode.startsWith('data:image')
                  ? { barcodePreviewUrl: barcodePreviewUrl || form.barcode }
                  : {})}
                onGenerateQr={() => void handleGenerateQr()}
                qrGenerating={qrGenerating}
                {...(qrPreviewUrl || form.qrCode.startsWith('data:image')
                  ? { qrPreviewUrl: qrPreviewUrl || form.qrCode }
                  : {})}
                headerSlot={
                  form.slug ? (
                    <div className="product-form-slug-row">
                      <Link2 className="h-3.5 w-3.5 flex-shrink-0 text-[var(--admin-accent)]" strokeWidth={2} />
                      <span className="text-[11px] text-[var(--admin-text-muted)]">splaro.co/products/</span>
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
            </div>
          </FormSection>

          {/* 2 — Variants */}
          <FormSection title={`Variants & Stock${lowStock ? ' — ⚠ Low' : ''}`} icon={Layers} number={3}>
            <p className="mb-3 text-[11px] font-semibold text-[#6B6B6B]">
              Total stock: <span className={cn('font-black', lowStock ? 'text-amber-600' : 'text-[#111111]')}>{totalStock} units</span>
            </p>
            <ProductVariantManager productId={productId} variants={product.variants ?? []} productImages={form.imageUrls} />
          </FormSection>

          <FormSection title="Version history" icon={Layers}>
            <p className="mb-2 text-[10px] font-semibold text-[#6B6B6B]">
              A snapshot is saved automatically before each product save (max 20 versions).
            </p>
            {versions.length === 0 ? (
              <p className="text-[11px] font-semibold text-[#6B6B6B]">No saved versions yet — save the product once to create the first snapshot.</p>
            ) : (
              <div className="space-y-2">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-lg border border-[rgba(17,17,17,0.06)] px-3 py-2">
                    <div>
                      <p className="text-[11px] font-black text-[#111111]">v{v.version} · {v.changedBy}</p>
                      <p className="text-[10px] font-semibold text-[#6B6B6B]">
                        {new Date(v.createdAt).toLocaleString()}{v.changeNote ? ` · ${v.changeNote}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={restoreVersion.isPending}
                      onClick={() => {
                        if (!window.confirm(`Restore product to v${v.version}? Reverts catalog fields, pricing, SEO, codes, and visibility from that snapshot (variants/images unchanged).`)) return
                        restoreVersion.mutate(
                          { productId, versionId: v.id, restoredBy: adminSession?.email ?? adminSession?.name ?? 'admin' },
                          {
                            onSuccess: () => toastOk('Product restored from version history.'),
                            onError: (err) => toastFail(err instanceof Error ? err.message : 'Could not restore version.'),
                          },
                        )
                      }}
                      className="rounded-lg bg-[rgba(200,169,126,0.12)] px-2.5 py-1 text-[11px] font-black text-[#9a7b52] transition-colors hover:bg-[rgba(200,169,126,0.22)] disabled:opacity-50"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </FormSection>

        </div>

        {/* RIGHT — media (same as create), live toggles, stats */}
        <aside className="product-edit-page__aside space-y-4">

          <ProductMediaPanel
            imageUrls={form.imageUrls}
            videoUrl={form.videoUrl}
            onImageUrlsChange={(urls) => {
              setForm((prev) => ({ ...prev, imageUrls: urls }))
              setDirty(true)
            }}
            onVideoUrlChange={(url) => {
              setForm((prev) => ({ ...prev, videoUrl: url }))
              setDirty(true)
            }}
            className="product-edit-media !m-0"
          />

          {/* Visibility */}
          <div className="admin-module-card product-edit-card product-edit-side-card space-y-1">
            <div className="product-edit-card__head">
              <div className="product-edit-card__icon">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--admin-brand-gold)]" strokeWidth={2} />
              </div>
              <h3 className="product-edit-card__title">Visibility</h3>
            </div>
            <p className="pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-text-muted)]">
              Saves instantly · updates storefront
            </p>
            <AdminSwitchRow
              label={form.isPublished ? 'Live on store' : 'Draft'}
              desc={form.isPublished ? 'Visible on splaro.co' : 'Hidden until published'}
              checked={form.isPublished}
              disabled={visibilityBusy !== null}
              highlight
              onChange={() => void saveVisibility({ isPublished: !form.isPublished })}
            />
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
                disabled={visibilityBusy !== null}
                onChange={() => void saveVisibility({ [key]: !form[key] })}
              />
            ))}
          </div>

          {/* Stats */}
          <div className="admin-module-card product-edit-card product-edit-side-card space-y-3">
            <div className="product-edit-card__head">
              <div className="product-edit-card__icon">
                <BarChart3 className="h-3.5 w-3.5 text-[var(--admin-brand-gold)]" strokeWidth={2} />
              </div>
              <h3 className="product-edit-card__title">Stats</h3>
            </div>
            {[
              { label: 'SKU', value: String((product as unknown as Record<string, unknown>).sku ?? '—') },
              { label: 'Variants', value: `${product.variants?.length ?? 0}` },
              { label: 'Total stock', value: `${totalStock} units` },
              { label: 'Status', value: String((product as unknown as Record<string, unknown>).status ?? (product.isPublished ? 'PUBLISHED' : 'DRAFT')) },
              { label: 'URL slug', value: form.slug || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between border-b border-[rgba(17,17,17,0.05)] pb-2.5 last:border-0 last:pb-0">
                <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[var(--admin-text-muted)]">{label}</span>
                <span className={cn('max-w-[160px] truncate text-right text-sm font-black text-[var(--admin-text)]', label === 'URL slug' && 'font-mono text-[10px]')}>{value}</span>
              </div>
            ))}
            {form.slug ? (
              <div className="space-y-2 border-t border-[rgba(17,17,17,0.06)] pt-3">
                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--admin-text-muted)]">Storefront link</p>
                <p className="break-all font-mono text-[10px] font-semibold text-[var(--admin-text-secondary)]">{storefrontUrl}</p>
                <div className="flex flex-wrap gap-2">
                  <AdminButton variant="ghost" size="sm" onClick={() => void handleCopyStorefrontUrl()}>
                    <Copy className="h-3 w-3" /> Copy
                  </AdminButton>
                  <AdminButton variant="ghost" size="sm" onClick={handleOpenStorefront} disabled={!form.isPublished}>
                    <ExternalLink className="h-3 w-3" /> Open
                  </AdminButton>
                </div>
                {!form.isPublished ? (
                  <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Turn on Live on store to share this link.</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Danger zone */}
          {canDeleteProducts && (
            <div className="product-edit-page__danger">
              <div className="mb-3 flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                <p className="text-[11px] font-black uppercase tracking-[0.1em] text-red-600">Danger Zone</p>
              </div>
              <p className="mb-3 text-xs font-semibold text-red-400/90">Hides product from storefront. Cannot be undone.</p>
              <AdminButton
                variant="danger"
                className="w-full justify-center border border-red-500/25"
                loading={deleteProduct.isPending}
                onClick={handleArchive}
              >
                Archive product
              </AdminButton>
            </div>
          )}
        </aside>
      </div>

      {/* Sticky save bar */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="product-edit-page__savebar fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          >
            <Pencil className="h-3.5 w-3.5 text-[var(--admin-brand-gold)]" />
            <span className="text-sm font-bold text-[var(--admin-text)]">Unsaved changes</span>
            <AdminButton variant="gold" loading={saving} disabled={!canEditProducts} onClick={handleSave}>
              <Save className="h-3.5 w-3.5" /> Save
            </AdminButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
